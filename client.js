window.__ModuleLoader__.load({
  id: '@local/dsh-feishu-mentions',
  factory(require) {
    const React = require('react')
    const groups = {
      person: ['飞书联系人', '人', 'session'], chat: ['飞书群聊', '群', 'session'],
      drive: ['飞书云盘与知识库文档', '文档', 'file'], space: ['飞书知识空间', '知识库', 'folder'],
    }

    function debounce(signal) {
      return new Promise((resolve, reject) => {
        signal.throwIfAborted()
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', cancel)
          resolve()
        }, 100)
        function cancel() { clearTimeout(timer); reject(signal.reason) }
        signal.addEventListener('abort', cancel, { once: true })
      })
    }

    async function request(action, params, signal) {
      const url = new URL('api/feishu-mentions/' + action, document.baseURI)
      url.search = new URLSearchParams(params).toString()
      const transport = globalThis.__DSH_TRANSPORT__?.fetch ?? globalThis.fetch
      const response = await transport(url.href, { signal, credentials: 'same-origin', cache: 'no-store' })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('飞书插件未连接，请重新打开 Harness 工作区。')
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error || '读取失败，请重试。')
      if (action === 'search' ? !Array.isArray(result?.data) : typeof result?.data?.text !== 'string') {
        throw new Error('飞书插件返回了无法识别的数据，请重试。')
      }
      return result.data
    }

    function excerptId(item) {
      if (item.kind === 'chat') return item.chat_id
      if (item.kind === 'wiki' && ['wiki', 'docx', 'doc'].includes(item.type)) {
        try { return new URL(item.url).pathname.match(/^\/wiki\/([A-Za-z0-9]+)\/?$/)?.[1] } catch { return }
      }
      if (['doc', 'docx'].includes(item.kind)) return item.token
    }

    function label(item) { return (item.withExcerpt ? '@摘录:' : '@') + item.title }

    function calendarDay(date) {
      // Comparing local calendar dates keeps midnight and DST boundaries correct.
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    }

    function modifiedTimeLabel(value) {
      if (!value) return
      const date = new Date(value)
      if (!Number.isFinite(date.getTime())) return
      const today = new Date()
      const daysAgo = (calendarDay(today) - calendarDay(date)) / 86_400_000
      const relative = ['今天', '昨天', '前天'][daysAgo]
      const year = date.getFullYear() === today.getFullYear() ? '' : date.getFullYear() + '年'
      const day = relative ?? (year + (date.getMonth() + 1) + '月' + date.getDate() + '日')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return day + ' ' + hours + ':' + minutes
    }
    function description(source, ref, detail, withExcerpt) {
      if (source === 'person') return ref.department || undefined
      if (source === 'drive') {
        const credit = ref.author ? '作者 ' + ref.author : ref.owner ? '所有者 ' + ref.owner : '作者未提供'
        const modified = modifiedTimeLabel(ref.modified_at)
        return [credit, modified, withExcerpt && '附正文前 6000 字'].filter(Boolean).join(' · ')
      }
      return withExcerpt ? '随提示词附最近 10 条群消息' : detail
    }

    const menuStyles = `
      [role="option"]:has(.dsh-feishu-icon) {
        display: grid;
        flex: none;
        grid-template-columns: 26px var(--feishu-text-columns, minmax(0, 1fr));
        gap: 2px 9px;
        align-items: center;
        text-align: start;

        & > [aria-hidden] {
          grid-area: 1 / 1;
          justify-self: stretch;
          width: auto;
          height: auto;
        }
        &:not(:has(.dsh-feishu-person)):has(> span:nth-child(3)) > [aria-hidden] { grid-row: 1 / span 2; }
        & > span:nth-child(2) {
          grid-area: 1 / 2;
          max-width: 100%;
          line-height: 18px;
        }
        & > span:nth-child(3) {
          grid-area: 2 / 2;
          text-align: start;
          line-height: 16px;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        &:has(.dsh-feishu-person):has(> span:nth-child(3)) {
          --feishu-text-columns: fit-content(60%) minmax(0, 1fr);
          & > span:nth-child(3) {
            grid-area: 1 / 3;
            font-size: 11px;
            color: var(--dsw-alias-label-tertiary);
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
          }
        }
      }
    `

    function rowIcon(source, title, image) {
      const isAvatar = source === 'person' || source === 'chat'
      const size = isAvatar ? 26 : 18
      const style = { width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center',
        ...(isAvatar && { borderRadius: '50%', overflow: 'hidden', clipPath: 'circle(50%)', backgroundColor: 'var(--dsw-alias-interactive-bg-hover)' }) }
      return function FeishuIcon() {
        const [failed, setFailed] = React.useState(false)
        let content
        if (image && !failed) {
          content = React.createElement('img', {
            src: image, alt: '', draggable: false, referrerPolicy: 'no-referrer',
            style: { display: 'block', width: '100%', height: '100%', objectFit: isAvatar ? 'cover' : 'contain' }, onError: () => setFailed(true),
          })
        } else {
          const letters = source === 'person' ? Array.from(title.trim()).slice(-2).join('') : source === 'chat' ? '群' : '▤'
          content = React.createElement('span', { style: {
            width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'white', fontSize: 11, fontWeight: 600,
            backgroundColor: source === 'chat' ? '#6867b8' : '#42668d',
          } }, letters)
        }
        return React.createElement('span', { className: 'dsh-feishu-icon dsh-feishu-' + source + (isAvatar ? ' dsh-feishu-face' : ''), style }, content)
      }
    }

    function makeSource(source, order) {
      const [section, prefix, icon] = groups[source]
      const name = 'feishu-' + source
      const recent = new Map()
      let activeSession
      return {
        trigger: '@', name, order, showGroupTitle: false,
        async candidates(session, { query, drilled, signal }) {
          if (drilled || /[\\/]/.test(query) || query.startsWith('~')) return []
          const tag = /^(人|群|文档|知识库|摘录)[:：](.*)$/u.exec(query)
          const withExcerpt = tag?.[1] === '摘录'
          if (withExcerpt && !['drive', 'chat'].includes(source)) return []
          if (tag && !withExcerpt && tag[1] !== prefix) return []
          const term = (tag ? tag[2] : query).trim()
          signal.throwIfAborted()
          if (activeSession !== session) {
            recent.clear()
            activeSession = session
          }
          try {
            const cached = recent.get(term)
            let rows
            if (cached && cached.expires > Date.now()) {
              rows = cached.rows
            } else {
              if (term) await debounce(signal)
              rows = await request('search', { source, q: term }, signal)
              signal.throwIfAborted()
              if (activeSession === session) {
                recent.delete(term)
                if (recent.size >= 32) recent.delete(recent.keys().next().value)
                recent.set(term, { rows, expires: Date.now() + 15000 })
              }
            }
            const items = rows.filter(item => typeof item?.title === 'string' && item.title && typeof item.kind === 'string' && (!withExcerpt || excerptId(item))).map(item => {
              const { detail, image, ...ref } = item
              return {
                section, name: ref.title, icon: rowIcon(source, ref.title, image),
                description: description(source, ref, detail, withExcerpt),
                value: JSON.stringify({ ...ref, ...(withExcerpt && { withExcerpt: true }) }),
              }
            })
            if (!query && source === 'drive') {
              items.push({ section, name: '附上飞书摘录…', description: '选择文档正文或最近群消息', value: 'choose-excerpt' })
            }
            if (tag && !items.length) items.push({ section, name: '没有匹配的' + section, description: '试试更短的关键词' })
            return items
          } catch (error) {
            signal.throwIfAborted()
            return [{ section, name: '暂时无法读取' + section, description: error.message }]
          }
        },
        onPick({ candidate }) {
          if (!candidate.value) return
          if (candidate.value === 'choose-excerpt') return { text: '@摘录:', continue: true }
          const ref = JSON.parse(candidate.value)
          const appearance = ['folder', 'space'].includes(ref.kind) ? 'folder' : icon
          return { insert: { source: name, ref: candidate.value, appearance, label: label(ref), clipboardText: label(ref) } }
        },
        codec: {
          clipboardText: raw => label(JSON.parse(raw)),
          async serialize(raw, signal) {
            signal.throwIfAborted()
            const { withExcerpt, ...ref } = JSON.parse(raw)
            if (withExcerpt) ref.excerpt = await request('excerpt', { kind: ref.kind, id: excerptId(ref) }, signal)
            if (!withExcerpt) {
              const readVia = { person: 'contact +search-user --user-ids', chat: 'im +chat-messages-list --chat-id', doc: 'docs +fetch --doc', docx: 'docs +fetch --doc', wiki: 'wiki +node-get --node-token', space: 'wiki +node-list --space-id' }
              if (Object.hasOwn(readVia, ref.kind)) ref.lookup = 'lark-cli ' + readVia[ref.kind] + ' <对象标识或链接> --as user'
            }
            return '【飞书引用】' + JSON.stringify(ref)
          },
        },
      }
    }

    const packageName = '@hayschan/dsh-feishu-mentions'
    const installedName = '@local/dsh-feishu-mentions'

    function unwrap(reply) {
      if (!reply?.ok) throw new Error(reply?.error?.message || '无法连接插件管理器。')
      return reply.value
    }

    async function check(manager) {
      if (!manager) throw new Error('此工作区未提供插件管理服务。')
      const bundles = unwrap(await manager.listBundles())
      const installed = bundles.find(b => b.name === installedName && b.installed)
      if (!installed) throw new Error('无法确定当前安装来源。')
      if (installed.name !== packageName || installed.update !== 'registry') {
        const info = unwrap(await manager.inspect(packageName, {}))
        const latest = info.status === 'accepted' && info.version ? '，npm 版本 ' + info.version : '，暂时无法确认 npm 版本'
        return { message: '已安装 ' + installed.version + latest + '。当前安装来源仅支持检查版本。' }
      }
      const list = unwrap(await manager.listVersions(packageName, {}))
      if (list.status !== 'listed') throw new Error(list.reason || '无法读取版本列表。')
      const next = list.versions.find(v => v.tags.includes('latest') && v.bundle && !v.prerelease && !v.incompatible && !v.deprecated)
      return next ? { message: '已安装 ' + list.installed, version: next.version, registry: list.registry }
        : { message: '已安装 ' + list.installed + '，暂无可用的稳定更新。' }
    }

    function UpdateRow({ manager }) {
      const [state, setState] = React.useState({ message: '' })
      const busy = React.useRef(false)
      async function act() {
        if (busy.current) return
        busy.current = true
        const target = state.version
        setState({ busy: true, message: target ? '正在安装 ' + target : '正在检查…' })
        try {
          if (!target) {
            setState(await check(manager))
            return
          }
          const outcome = unwrap(await manager.updateBundle(packageName, target, {
            registry: state.registry, requestId: crypto.randomUUID(),
          }))
          const result = outcome.result
          if (outcome.step !== 'install' || result.version !== target || result.error) {
            throw new Error('更新未完成，请在插件管理器核对当前版本。')
          }
          if (result.application === 'applied') setState({ message: target + ' 已安装并生效。' })
          else if (result.application === 'restart-required') setState({ message: target + ' 已安装，重启 Harness 后生效。' })
          else throw new Error('更新尚未生效，请查看插件管理器。')
        } catch (error) {
          setState({ message: error.message || '请重新检查插件状态。' })
        } finally {
          busy.current = false
        }
      }
      return React.createElement('div', null,
        React.createElement('strong', null, '飞书引用 '),
        React.createElement('button', { type: 'button', disabled: state.busy, onClick: act },
          state.version ? '确认安装 ' + state.version : '检查更新'),
        React.createElement('span', { role: 'status' }, ' ' + state.message))
    }

    return {
      inject: ['inputTriggers', 'slots', 'remote', 'remote.pluginManager'],
      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.textContent = menuStyles
          document.head.append(style)
          return () => style.remove()
        })
        ctx.slots?.inject('settings.general.item', () => ctx.slots.register({
          name: 'settings.general.item', id: 'feishu-mentions.update', order: 110,
        }, () => React.createElement(UpdateRow, { manager: ctx.remote?.pluginManager })))
        Object.keys(groups).forEach((key, index) => {
          ctx.effect(() => ctx.inputTriggers.registerSource(makeSource(key, index - 4)))
        })
      },
    }
  },
})
