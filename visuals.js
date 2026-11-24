import { readFileSync } from 'node:fs'

const types = new Map(Object.entries({
  doc: 'doc', docx: 'doc', sheet: 'sheet', bitable: 'bitable', base: 'bitable',
  slide: 'slides', slides: 'slides', folder: 'folder', space: 'folder', app: 'app',
  mindnote: 'mindnote', board: 'board', whiteboard: 'board', shortcut: 'link', link: 'link',
}))
const fileTypes = new Map(Object.entries({
  pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', csv: 'csv',
  ppt: 'ppt', pptx: 'ppt', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image',
  gif: 'image', svg: 'image', mp4: 'video', mov: 'video', mp3: 'audio', wav: 'audio',
  m4a: 'audio', zip: 'zip', rar: 'zip', '7z': 'zip', txt: 'text', md: 'text',
}))
const objectTypes = new Map([[22, 'doc'], [3, 'sheet'], [8, 'bitable']])
const icons = new Map()

export function documentIcon(type, title, info) {
  let key = types.get(type)
  if (!key && info) {
    try {
      const meta = typeof info === 'string' ? JSON.parse(info) : info
      key = objectTypes.get(meta.obj_type)
    } catch { /* Some Drive results omit typed icon metadata. */ }
  }
  key ??= fileTypes.get(/\.([a-z0-9]+)$/i.exec(title)?.[1].toLowerCase()) ?? 'file'
  if (!icons.has(key)) {
    const svg = readFileSync(new URL('./icons/' + key + '.svg', import.meta.url))
    icons.set(key, 'data:image/svg+xml;base64,' + svg.toString('base64'))
  }
  return icons.get(key)
}

export function avatarUrl(value) {
  if (typeof value !== 'string') return
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        /(^|\.)(feishucdn\.com|larksuitecdn\.com|larksuitecdn\.cn|larksuite\.com|feishu\.cn)$/.test(url.hostname)) return url.href
  } catch { /* The contact or chat can still be cited without an avatar. */ }
}
