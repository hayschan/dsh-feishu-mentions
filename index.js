import { excerpt, isSource, search } from './lark.js'

export const inject = ['connection']
const headers = { 'Cache-Control': 'no-store' }

export function apply(ctx) {
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  for (const action of ['search', 'excerpt']) {
    ctx.connection.fetch.register({
      path: '/api/feishu-mentions/' + action, methods: ['GET'], requestBody: 'buffered',
      async fetch(request) {
        const params = new URL(request.url).searchParams
        const signal = AbortSignal.any([request.signal, lifetime.signal, AbortSignal.timeout(20000)])
        const query = (params.get('q') ?? '').trim()
        if (action === 'search' && (!isSource(params.get('source')) || [...query].length > 64)) {
          return Response.json({ error: '请输入 64 字以内的关键词。' }, { status: 400, headers })
        }
        try {
          const data = action === 'search' ? await search(params.get('source'), query, signal) : await excerpt(params, signal)
          return Response.json({ data }, { headers })
        } catch (error) {
          return Response.json({ error: signal.aborted ? '读取已取消或超时。' : error.message }, { status: 502, headers })
        }
      },
    })
  }
}
