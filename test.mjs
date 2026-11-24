import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { search, excerpt } from './lark.js'
import { apply } from './index.js'
import { avatarUrl, documentIcon } from './visuals.js'
import { modifiedTime } from './document-metadata.js'

const signal = new AbortController().signal
const doc = { title_highlighted: '<h>读书</h>计划', result_meta: { doc_types: 'DOCX', token: 'docToken', url: 'https://example.feishu.cn/wiki/nodeToken' } }
const image = 'https://s1-imfile.feishucdn.com/static/test?signature=avatar-test'
const chat = { title: '读书群', kind: 'chat', chat_id: 'oc_demo', image }
const person = { localized_name: '示例用户甲', open_id: 'ou_demo', department: '示例组' }

test('Wiki node and underlying document identities survive highlighted search', async () => {
  const [row] = await search('drive', '读书', signal, async args => {
    if (args[0] === 'wiki') return {}
    assert.deepEqual(args.slice(0, 4), ['drive', '+search', '--query', '读书'])
    return { results: [doc] }
  })
  assert.deepEqual([row.title, row.kind, row.type, row.token, row.url], ['读书计划', 'wiki', 'docx', 'docToken', doc.result_meta.url])
})

test('bare @ uses joined chats, prior contacts, and recently opened files', async () => {
  const observed = []
  const run = async args => { observed.push(args); return { chats: [], users: [person], results: [] } }
  for (const source of ['chat', 'person', 'drive']) await search(source, '', signal, run)
  assert.ok(observed[0].includes('active_time'))
  assert.ok(observed[1].includes('--has-chatted'))
  assert.ok(observed.find(args => args[0] === 'drive').includes('open_time'))
})

test('contact avatars join on open_id and missing or inaccessible avatars preserve candidates', async () => {
  const users = [person, { localized_name: '示例用户乙', open_id: 'ou_2' }, { localized_name: '示例用户丙', open_id: 'ou_3' }]
  const rows = await search('person', '', signal, async args => {
    if (args[0] === 'contact') return { users }
    assert.equal(args[2], '/open-apis/contact/v3/users/batch')
    assert.deepEqual(JSON.parse(args[4]).user_ids, users.map(u => u.open_id))
    return { items: [{ open_id: 'ou_3', avatar: image }, { open_id: 'ou_2', avatar: 'http://bad.example/photo' }] }
  })
  assert.deepEqual(rows.map(row => row.image), [undefined, undefined, image])
  assert.deepEqual(rows.map(row => row.department), ['示例组', undefined, undefined])
  const fallback = await search('person', '', signal, async args => {
    if (args[0] === 'contact') return { users }
    throw new Error('permission denied')
  })
  assert.deepEqual(fallback.map(row => row.open_id), users.map(u => u.open_id))
  const controller = new AbortController()
  await assert.rejects(search('person', '', controller.signal, async args => {
    if (args[0] === 'contact') return { users }
    controller.abort()
    controller.signal.throwIfAborted()
  }), { name: 'AbortError' })
})

test('Feishu supplies the group avatar for recent and searched groups', async () => {
  for (const query of ['', '读书']) {
    const [row] = await search('chat', query, signal, async () => ({ chats: [{ chat_id: chat.chat_id, name: chat.title, avatar: image }] }))
    assert.equal(row.image, image)
  }
  for (const bad of ['data:text/html,a', 'https://feishucdn.com.example.net/a', 'https://name:pass@s1.feishucdn.com/a']) {
    assert.equal(avatarUrl(bad), undefined)
  }
})

test('type artwork preserves Wiki object type and distinguishes native, uploaded and unknown files', async () => {
  const rows = await search('drive', '读书', signal, async () => ({ results: ['DOCX', 'SHEET', 'BITABLE', 'WIKI'].map(type => ({
    ...doc, result_meta: { ...doc.result_meta, doc_types: type, icon_info: '{"obj_type":3}' },
  })) }))
  assert.ok(rows.every(row => row.kind === 'wiki' && row.image.startsWith('data:image/svg+xml;base64,PHN2Zy')))
  assert.equal(new Set(rows.map(row => row.image)).size, 3)
  assert.equal(rows[1].image, rows[3].image)
  assert.notEqual(documentIcon('file', '上传件.docx'), rows[0].image)
  assert.notEqual(documentIcon('file', '目录.pdf'), documentIcon('unknown', '无扩展名', 'invalid metadata'))
})

test('space name can match after page one', async () => {
  const pages = [{ spaces: [], has_more: true, page_token: 'next' }, { spaces: [{ space_id: '100', name: '读书' }] }]
  const rows = await search('space', '读书', signal, async args => {
    if (pages.length === 1) assert.ok(args.includes('next'))
    return pages.shift()
  })
  assert.equal(rows[0].space_id, '100')
})

test('creation and modification evidence follows document identities, including ownership transfers', async () => {
  const result = (token, wiki) => ({ title: token, result_meta: {
    doc_types: 'DOCX', url: 'https://example.feishu.cn/' + (wiki ? 'wiki/' : 'docx/') + token, token,
    owner_id: 'ou_owner', owner_name: '现所有者', edit_user_id: 'ou_editor', edit_user_name: '编辑者',
    update_time: Date.UTC(2024, 1, 3, 4, 5, 6) / 1000, last_open_time: Date.UTC(2024, 1, 4) / 1000,
  } })
  const results = [result('A', false), result('B', true), result('C', false)]
  const rows = await search('drive', '读书', signal, async args => {
    if (args[0] === 'wiki') return { creator: 'ou_author', node_creator: 'ou_editor' }
    if (args[0] === 'contact') return { users: [{ open_id: 'ou_author', localized_name: '原作者' }] }
    if (args.includes('--original-creator-ids')) return { results: args.includes('ou_editor') ? [results[0]] : [] }
    return { results }
  })
  assert.deepEqual(rows.map(row => row.author), ['编辑者', '原作者', undefined])
  assert.ok(rows.every(row => row.owner === '现所有者' && row.modified_at === '2024-02-03T04:05:06.000Z'))
  assert.equal(modifiedTime({ update_time: 0, update_time_iso: '1970-01-01T08:00:00+08:00' }), undefined)
  assert.equal(modifiedTime({ update_time_iso: '2024-02-03T12:05:06+08:00' }), rows[0].modified_at)
})

test('optional author lookup failures preserve all base results and propagate parent cancellation', async () => {
  const run = async args => {
    if (args[0] === 'wiki') throw new Error('permission denied')
    return { results: [doc] }
  }
  const [row] = await search('drive', '读书', signal, run)
  assert.equal(row.title, '读书计划')
  assert.equal(row.author, undefined)
  const controller = new AbortController()
  await assert.rejects(search('drive', '读书', controller.signal, args => {
    if (args[0] === 'wiki') controller.abort()
    return run(args)
  }), { name: 'AbortError' })
})

test('document excerpt preserves unicode, revision and truncation. Unsupported ID never reaches CLI', async () => {
  const result = await excerpt(new URLSearchParams({ kind: 'wiki', id: 'nodeToken' }), signal, async args => {
    assert.ok(args.includes('https://www.feishu.cn/wiki/nodeToken'))
    return { document: { revision_id: 7, content: '🎉'.repeat(6001) } }
  })
  assert.equal([...result.text].length, 6000)
  assert.equal(result.truncated, true)
  assert.equal(result.revision, 7)
  await assert.rejects(excerpt(new URLSearchParams({ kind: 'chat', id: '--help' }), signal, assert.fail))
})

test('recent messages are ordered oldest to newest and older history is identified', async () => {
  const result = await excerpt(new URLSearchParams({ kind: 'chat', id: chat.chat_id }), signal, async args => {
    assert.ok(args.includes('10'))
    return { has_more: true, messages: [{ content: '新' }, { content: '旧' }] }
  })
  assert.equal(result.text, '旧\n新')
  assert.equal(result.has_more, true)
})

test('Host rejects unknown search source and overlong strings', async () => {
  const routes = []
  apply({ effect: cb => cb(), connection: { fetch: { register: r => routes.push(r) } } })
  for (const qs of ['source=invalid', 'source=person&q=' + '文'.repeat(65)]) {
    const response = await routes[0].fetch(new Request('http://localhost/' + '?' + qs))
    assert.equal(response.status, 400)
  }
})

async function clientSources(fetch, react = {}, dateClass = Date) {
  const sources = []
  const code = await readFile(new URL('./client.js', import.meta.url), 'utf8')
  const ctx = { inputTriggers: { registerSource: s => sources.push(s) }, effect: f => f() }
  runInNewContext(code, {
    window: { __ModuleLoader__: { load: m => m.factory(name => {
      assert.equal(name, 'react')
      return react
    }).apply(ctx) } },
    document: { baseURI: 'http://localhost/', createElement: () => ({}), head: { append() {} } },
    URL, URLSearchParams, setTimeout, clearTimeout, fetch, Date: dateClass,
  })
  return sources
}

test('document menu uses local calendar days across midnight, DST and New Year, preserving reference timestamps', async () => {
  let now = new Date(2026, 10, 2, 0, 5)
  class LocalDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])) }
  }
  let rows
  const sources = await clientSources(() => Response.json({ data: rows }), {}, LocalDate)
  const drive = sources.find(s => s.name === 'feishu-drive')
  async function verify(cases, query) {
    rows = cases.map(([value]) => ({ kind: 'docx', detail: '文档', title: '项目记录', token: 'demo', author: '示例用户甲', modified_at: value }))
    const candidates = await drive.candidates({}, { query, signal })
    for (const [i, [value, expected]] of cases.entries()) {
      const item = candidates[i]
      const parts = ['作者 示例用户甲', expected, query.startsWith('摘录:') && '附正文前 6000 字'].filter(Boolean)
      assert.equal(item.description, parts.join(' · '))
      assert.equal(JSON.parse(drive.onPick({ candidate: item }).insert.ref).modified_at, value)
    }
  }
  const local = (year, month, day, hour, minute) => new Date(year, month - 1, day, hour, minute).toISOString()
  await verify([
    [local(2026, 11, 2, 0, 1), '今天 00:01'], [local(2026, 11, 1, 0, 3), '昨天 00:03'],
    [local(2026, 10, 31, 23, 59), '前天 23:59'], [local(2026, 10, 30, 9, 5), '10月30日 09:05'],
    [local(2025, 11, 2, 15, 30), '2025年11月2日 15:30'], [undefined, undefined], ['invalid', undefined],
  ], '文档:项目')
  now = new Date(2027, 0, 1, 0, 5)
  await verify([
    [local(2026, 12, 31, 23, 58), '昨天 23:58'], [local(2026, 12, 30, 8, 0), '前天 08:00'],
    [local(2026, 12, 29, 8, 0), '2026年12月29日 08:00'],
  ], '摘录:项目')
})

test('independent native sources, cancellation, label restoration, failure and send-time excerpt', async () => {
  const calls = []
  let imageFailed = false
  const sources = await clientSources(async url => {
    calls.push(url)
    if (url.includes('q=failed')) return Response.json({ error: '读取权限不足' }, { status: 502 })
    if (url.includes('source=person')) return Response.json({ data: [
      { kind: 'person', title: '示例用户甲', department: '示例组', open_id: 'ou_one' },
      { kind: 'person', title: '示例用户乙', open_id: 'ou_two' },
    ] })
    return Response.json({ data: url.includes('/excerpt?') ? { text: '样例消息' } : [chat] })
  }, { createElement: (type, props, child) => ({ type, props, child }), useState: () => [imageFailed, value => { imageFailed = value }] })
  assert.equal(sources.length, 4)
  const group = sources.find(s => s.name === 'feishu-chat')
  const ask = (query, requestSignal = signal) => group.candidates({}, { query, signal: requestSignal })
  await ask('文档:读书')
  await ask('./private/path')
  const cancel = new AbortController()
  const pending = ask('过期搜索', cancel.signal)
  cancel.abort()
  await assert.rejects(pending)
  assert.equal(calls.length, 0)
  const [row] = await ask('读书')
  const { insert } = group.onPick({ candidate: row })
  assert.equal(row.icon().props.style.clipPath, 'circle(50%)')
  assert.equal(row.icon().child.props.src, image)
  assert.equal(row.icon().child.props.referrerPolicy, 'no-referrer')
  row.icon().child.props.onError()
  assert.equal(row.icon().child.child, '群')
  assert.equal(insert.appearance, 'session')
  assert.doesNotMatch(JSON.stringify(insert), /avatar-test|feishucdn|data:image/)
  assert.equal(group.codec.clipboardText(insert.ref), insert.clipboardText)
  assert.match(await group.codec.serialize(insert.ref, signal), /oc_demo/)
  assert.equal(calls.length, 1)
  const [withExcerpt] = await ask('摘录:读书')
  assert.match(await group.codec.serialize(withExcerpt.value, signal), /样例消息/)
  assert.equal(calls.length, 3)
  const [error] = await ask('failed')
  assert.equal(error.description, '读取权限不足')
  assert.equal(group.onPick({ candidate: error }), undefined)
  const people = sources.find(s => s.name === 'feishu-person')
  const [withDepartment, withoutDepartment] = await people.candidates({}, { query: '', signal })
  assert.equal(withDepartment.description, '示例组')
  assert.equal(withoutDepartment.description, undefined)
  assert.equal(people.onPick({ candidate: withDepartment }).insert.label, '@示例用户甲')
})

test('repeat searches reuse rows across modes until expiry or session change', async () => {
  let now = 1000
  let calls = 0
  class Clock extends Date { static now() { return now } }
  const sources = await clientSources(() => {
    calls++
    return Response.json({ data: [chat] })
  }, {}, Clock)
  const group = sources.find(source => source.name === 'feishu-chat')
  const session = {}
  const ask = (query, scope = session) => group.candidates(scope, { query, signal })
  await ask('群:演示')
  const [row] = await ask('摘录:演示')
  assert.equal(JSON.parse(row.value).withExcerpt, true)
  assert.equal(calls, 1)
  now += 15001
  await ask('群:演示')
  await ask('群:演示', {})
  assert.equal(calls, 3)
})

test('null chat lists produce normal empty menu states', async () => {
  const sources = await clientSources(async url => {
    const query = new URL(url).searchParams.get('q')
    return Response.json({ data: await search('chat', query, signal, async () => ({ chats: null })) })
  })
  const group = sources.find(source => source.name === 'feishu-chat')
  for (const query of ['', '示例']) {
    assert.equal((await group.candidates({}, { query, signal })).length, 0)
  }
  const [empty] = await group.candidates({}, { query: '群:示例', signal })
  assert.equal(empty.name, '没有匹配的飞书群聊')
  assert.equal(group.onPick({ candidate: empty }), undefined)
})

test('all search sources tolerate empty lists and isolate malformed rows', async () => {
  const cases = [
    ['person', 'users', { ...person, department: {} }, { ...person, localized_name: 7 }],
    ['chat', 'chats', { chat_id: chat.chat_id, name: chat.title, description: false }, { name: 1 }],
    ['drive', 'results', doc, { title: 7, result_meta: {} }],
    ['space', 'spaces', { space_id: '123', name: '示例空间', description: {} }, { space_id: '123', name: 1 }],
  ]
  for (const [source, key, valid, invalid] of cases) {
    for (const payload of [{}, { [key]: null }, { [key]: [] }]) {
      assert.deepEqual(await search(source, '', signal, async () => payload), [])
    }
    for (const payload of [null, { [key]: {} }]) {
      await assert.rejects(search(source, '', signal, async () => payload), /无法识别的搜索结果/)
    }
    const rows = await search(source, '', signal, async () => ({ [key]: [null, invalid, valid] }))
    assert.equal(rows.length, 1)
    assert.equal(typeof rows[0].title, 'string')
  }
})

test('excerpt handles null rows and rejects unreadable content clearly', async () => {
  const params = new URLSearchParams({ kind: 'chat', id: chat.chat_id })
  const result = await excerpt(params, signal, async () => ({ messages: [null, { content: '可读消息' }] }))
  assert.equal(result.text, '可读消息')
  await assert.rejects(excerpt(params, signal, async () => ({ messages: [{ content: {} }] })), /无法识别的消息内容/)
  await assert.rejects(excerpt(params, signal, async () => null), /无法识别的消息格式/)
  await assert.rejects(excerpt(new URLSearchParams({kind: 'docx', id: 'demo'}), signal, async () => null), /未返回可摘录/)
})

test('malformed host replies are retryable and invalid wiki rows do not hide valid excerpts', async () => {
  let response = null
  const sources = await clientSources(() => Response.json(response))
  const drive = sources.find(s => s.name === 'feishu-drive')
  const ask = () => drive.candidates(signal, {query: '摘录:', signal})
  assert.match((await ask())[0].description, /无法识别的数据/)
  response = {data: [null, {kind: 'wiki', type: 'docx', title: '异常', url: 'invalid'},
    {kind: 'docx', title: '示例', token: 'demo'}]}
  const rows = await ask()
  assert.deepEqual(Array.from(rows, r => r.name), ['示例'])
})
