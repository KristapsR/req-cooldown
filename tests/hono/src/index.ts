import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import pinoLogger from 'pino'
import { honoCoolDown } from 'req-cooldown'

declare module 'hono' {
  interface ContextVariableMap {
    result: string
  }
}

const app = new Hono()
app.use('*', requestId())
app.use(logger())

app.use(
  '*',
  createMiddleware<{
    Variables: {
      user: { id: number; name: string }
    }
  }>(async (ctx, next) => {
    ctx.set('user', { id: 1, name: 'John' })
    // const body = await ctx.req.text()
    // console.log('middleware', ctx.get('requestId'), ctx.req.method, body)
    // await next()
    // console.log(ctx.res.status, ctx.res.body, ctx.header('Content-Type'))
    return next()
  }),
  honoCoolDown<{
    Variables: {
      user: { id: number; name: string }
    }
  }>({
    methods: ['GET', 'POST'],
    timeout: 15000,
    getUserKey: (req) => JSON.stringify(req.var.user),
    onBadReply: async (ctx, badReply) => {
      console.log('onBadReply', badReply)
      ctx.json(badReply)
    },

    onTimeout: async (ctx) => {
      console.log('onTimeout')
      ctx.status(408)
      ctx.json({ error: 'Request timeout' })
    },
    // logger: console,
    logger: pinoLogger(),
    getRequestId: (ctx) => ctx.var.requestId,
  })
)

app.all('/', async (c) => {
  await sleep(5000)
  return c.json({ message: 'Hello World!' })
})

serve({ fetch: app.fetch, port: 3000 })

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
