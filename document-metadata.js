// Drive search returns the owner and last editor. Obtain evidence of original
// creation before showing either person as the author.
export async function documentAuthors(results, searchArgs, signal, run) {
  const authors = new Map()
  const names = new Map()
  const creatorIds = new Map()
  const standalone = new Set()
  const possibleCreators = new Set()
  const tasks = []
  const deadline = AbortSignal.timeout(3500)
  const optional = signal ? AbortSignal.any([signal, deadline]) : deadline

  for (const result of results) {
    const m = result.result_meta
    if (!m?.token || !m.url) continue
    const wikiToken = /^https:\/\/[^/]+\/wiki\/([a-z0-9]+)(?=[/?#]|$)/i.exec(m.url)?.[1]
    const people = [[m.owner_id, m.owner_name], [m.edit_user_id, m.edit_user_name]]
    for (const [id, name] of people) if (id && name) names.set(id, name)
    if (m.original_creator_name) {
      authors.set(m.token, m.original_creator_name)
    } else if (m.original_creator_id) {
      creatorIds.set(m.token, m.original_creator_id)
    } else if (wikiToken) {
      tasks.push(async () => {
        const node = await run(['wiki', '+node-get', '--node-token', wikiToken], optional)
        if (node.creator) creatorIds.set(m.token, node.creator)
      })
    } else if (m.doc_types === 'DOC' && /^[a-zA-Z0-9]+$/.test(m.token)) {
      tasks.push(async () => {
        const doc = await run(['api', 'GET', '/open-apis/doc/v2/meta/' + m.token], optional)
        if (doc.create_user_name) authors.set(m.token, doc.create_user_name)
        else if (doc.creator) creatorIds.set(m.token, doc.creator)
      })
    } else {
      standalone.add(m.token)
      for (const [id, name] of people) if (name && /^ou_[a-zA-Z0-9_-]+$/.test(id)) possibleCreators.add(id)
    }
  }

  // Verify once per distinct person across this page. Only a token returned
  // under that exact original-creator filter establishes authorship.
  for (const id of possibleCreators) {
    tasks.push(async () => {
      const data = await run(['drive', '+search', ...searchArgs, '--original-creator-ids', id, '--page-size', '30'], optional)
      for (const result of data.results) {
        const token = result.result_meta?.token
        if (standalone.has(token)) authors.set(token, names.get(id))
      }
    })
  }
  const queue = tasks.values()
  async function worker() {
    for (const task of queue) {
      if (optional.aborted) break
      try { await task() } catch { /* Preserve accessible search metadata. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, worker))
  const unknown = [...new Set(creatorIds.values())].filter(id => !names.has(id) && /^ou_[a-zA-Z0-9_-]+$/.test(id))
  if (unknown.length && !optional.aborted) {
    try {
      const data = await run(['contact', '+search-user', '--user-ids', unknown.join(',')], optional)
      for (const u of data.users) if (u.localized_name) names.set(u.open_id, u.localized_name)
    } catch { /* Directory visibility can differ from document visibility. */ }
  }
  signal?.throwIfAborted()
  for (const [token, id] of creatorIds) if (names.has(id)) authors.set(token, names.get(id))
  return authors
}

export function modifiedTime(meta) {
  const seconds = Number(meta.update_time)
  const time = seconds > 0 ? seconds * 1000 : Date.parse(meta.update_time_iso)
  const date = new Date(time)
  if (time > 0 && Number.isFinite(date.valueOf())) return date.toISOString()
}
