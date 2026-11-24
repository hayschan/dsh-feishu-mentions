import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { avatarUrl, documentIcon } from './visuals.js'
import { documentAuthors, modifiedTime } from './document-metadata.js'

const execute = promisify(execFile)
const commonBins = ['/opt/homebrew/bin/lark-cli', '/usr/local/bin/lark-cli']
const configuredBin = process.env.DSH_FEISHU_CLI
const binary = configuredBin && isAbsolute(configuredBin) ? configuredBin : commonBins.find(existsSync) ?? 'lark-cli'
const sources = ['person', 'chat', 'drive', 'space']
const typeLabels = new Map(Object.entries({
  doc: '文档', docx: '文档', sheet: '电子表格', bitable: '多维表格', base: '多维表格',
  slide: '幻灯片', slides: '幻灯片', folder: '文件夹', wiki: '知识库', file: '文件',
  mindnote: '思维笔记', board: '画板', whiteboard: '画板', shortcut: '快捷方式', app: '应用',
}))
export const isSource = value => sources.includes(value)

export async function cli(args, signal) {
  let stdout
  try {
    const result = await execute(binary, [...args, '--as', 'user', '--format', 'json'], {
      signal, timeout: 15000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    })
    stdout = result.stdout
  } catch (error) {
    signal?.throwIfAborted()
    if (error.code === 'ENOENT') throw new Error('找不到 lark-cli，请安装飞书 CLI 并登录。')
    if (error.killed) throw new Error('飞书响应超时，请稍后重试。')
    if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new Error('内容过大，请使用普通引用分段读取。')
    // CLI diagnostics may include authorization URLs. Return only its machine code.
    let code
    for (const body of [error.stdout, error.stderr]) {
      try { code = JSON.parse(body).error?.code; if (code) break } catch {}
    }
    const detail = /^[a-zA-Z0-9_-]{1,40}$/.test(String(code ?? '')) ? '（' + code + '）' : ''
    throw new Error('飞书读取失败' + detail + '，请检查 lark-cli 的用户登录和读取权限。')
  }
  let envelope
  try { envelope = JSON.parse(stdout) } catch { throw new Error('飞书 CLI 未返回 JSON，请检查版本。') }
  if (!envelope.ok || !envelope.data) throw new Error('飞书 CLI 没有返回有效结果。')
  return envelope.data
}

function docReference(row, authors) {
  const meta = row.result_meta ?? {}
  const title = (row.title ?? row.title_highlighted ?? '').replace(/<\/?hb?>/gi, '')
  if (!title || !meta.url || !meta.token) return
  let url
  try { url = new URL(meta.url) } catch { return }
  if (url.protocol !== 'https:') return
  const type = String(meta.doc_types || row.entity_type).toLowerCase()
  const kind = url.pathname.startsWith('/wiki/') ? 'wiki' : type
  // The Wiki search token can identify the underlying object. Keep the node URL too.
  return { kind, title, token: meta.token, url: url.href, type, image: documentIcon(type, title, meta.icon_info),
    author: authors.get(meta.token), owner: meta.owner_name || undefined, modified_at: modifiedTime(meta),
    detail: typeLabels.get(type) || '文件' }
}

async function contactAvatars(users, signal, run) {
  const ids = users.map(user => user.open_id)
  if (!ids.length) return new Map()
  try {
    const params = JSON.stringify({ user_id_type: 'open_id', user_ids: ids })
    const rows = await run(['api', 'GET', '/open-apis/contact/v3/users/batch', '--params', params,
      '--jq', '{ok:.ok,data:{items:[.data.items[]|{open_id,avatar:.avatar.avatar_72}]}}'], signal)
    return new Map(rows.items.map(row => [row.open_id, avatarUrl(row.avatar)]))
  } catch {
    signal?.throwIfAborted()
    return new Map()
  }
}

export async function search(source, query, signal, run = cli) {
  const page = ['--page-size', query ? '8' : '3']
  switch (source) {
    case 'person': {
      const data = await run(['contact', '+search-user', ...(query ? ['--query', query] : ['--has-chatted']), ...page], signal)
      const users = data.users.filter(u => u.open_id && u.localized_name)
      const avatars = await contactAvatars(users, signal, run)
      return users.map(u => ({
        kind: 'person', title: u.localized_name, open_id: u.open_id, image: avatars.get(u.open_id),
        ...(u.p2p_chat_id && { p2p_chat_id: u.p2p_chat_id }), department: u.department?.trim() || undefined,
      }))
    }
    case 'chat': {
      const action = query ? ['+chat-search', '--query', query, '--disable-search-by-user'] : ['+chat-list', '--sort', 'active_time']
      const data = await run(['im', ...action, ...page], signal)
      return data.chats.filter(c => c.chat_id && c.name).map(c => ({
        kind: 'chat', title: c.name, chat_id: c.chat_id, image: avatarUrl(c.avatar), detail: c.description?.slice(0, 70) || undefined,
      }))
    }
    case 'drive': {
      if ([...query].length > 30) throw new Error('文档搜索最多支持 30 个字，请缩短关键词。')
      const action = query ? ['--query', query] : ['--opened-since', '1m', '--sort', 'open_time']
      const data = await run(['drive', '+search', ...action, ...page], signal)
      const authors = await documentAuthors(data.results, action, signal, run)
      return data.results.map(row => docReference(row, authors)).filter(Boolean)
    }
    case 'space': {
      const result = []
      let cursor
      const seen = new Set()
      do {
        const data = await run(['wiki', '+space-list', '--page-size', '50', ...(cursor ? ['--page-token', cursor] : [])], signal)
        for (const s of data.spaces) {
          if (s.space_id && s.name && s.name.toLowerCase().includes(query.toLowerCase())) {
            result.push({ kind: 'space', title: s.name, space_id: s.space_id, image: documentIcon('space'), detail: s.description?.slice(0, 70) || undefined })
          }
          if (result.length >= (query ? 8 : 3)) return result
        }
        cursor = data.has_more && data.page_token
        if (seen.has(cursor)) break
        seen.add(cursor)
      } while (cursor)
      return result
    }
    default: throw new Error('未知的飞书搜索类别。')
  }
}

const maxChars = 6000
function bounded(text) {
  const chars = Array.from(text)
  return { text: chars.slice(0, maxChars).join(''), truncated: chars.length > maxChars }
}

export async function excerpt(params, signal, run = cli) {
  const id = params.get('id') ?? ''
  if (params.get('kind') === 'chat' && /^oc_[A-Za-z0-9_-]{1,120}$/.test(id)) {
    const data = await run(['im', '+chat-messages-list', '--chat-id', id, '--page-size', '10', '--order', 'desc', '--no-reactions'], signal)
    if (!Array.isArray(data.messages)) throw new Error('群聊返回了无法识别的消息格式。')
    const lines = data.messages.slice(0, 10).reverse().map(m => [m.create_time, m.sender?.name, m.content].filter(Boolean).join(' '))
    return { scope: '最近最多 10 条群消息，按时间正序', ...bounded(lines.join('\n')), has_more: Boolean(data.has_more) }
  }
  if (['wiki', 'docx', 'doc'].includes(params.get('kind')) && /^[A-Za-z0-9]{1,128}$/.test(id)) {
    // docs +fetch accepts a Wiki node URL and resolves it to the document.
    const target = params.get('kind') === 'wiki' ? 'https://www.feishu.cn/wiki/' + id : id
    const data = await run(['docs', '+fetch', '--doc', target, '--doc-format', 'markdown'], signal)
    if (typeof data.document?.content !== 'string') throw new Error('此对象未返回可摘录的文档正文。')
    return { scope: '文档正文前 6000 个字符', revision: data.document.revision_id, ...bounded(data.document.content) }
  }
  throw new Error('此引用不支持正文摘录，请选择飞书文档或群聊。')
}
