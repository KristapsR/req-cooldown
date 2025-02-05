import Koa from 'koa'
import { koaBody } from 'koa-body'
import Router from 'koa-router'
import logger from 'pino'
import { koaCoolDown } from 'req-cooldown'
import { v4 as uuid4 } from 'uuid'

type AppContext = { user: { id: number; name: string }; requestId: string }

declare module 'koa' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface BaseContext extends AppContext {}
}

const app = new Koa()
const router = new Router()
app.use(koaBody())
app.use(
  koaCoolDown({
    methods: ['GET', 'POST'],
    timeout: 15000,
    getUserKey: (req) => JSON.stringify(req.user),
    onBadReply: async (ctx, badReply) => {
      console.log('onBadReply', badReply)
      ctx.body = badReply
    },

    onTimeout: async (ctx) => {
      console.log('onTimeout')
      ctx.status = 408
      ctx.body = { error: 'Request timeout' }
    },
    // logger: console,
    logger: logger(),
    getRequestId: (ctx) => ctx.requestId,
  })
)

// Add request cooldown middleware to specific routes
router.all(
  '/',
  (ctx, next) => {
    ctx.user = { id: 1, name: 'John' }
    ctx.requestId = uuid4()
    return next()
  },

  async (ctx) => {
    // Simulate some delay
    await new Promise((resolve) => setTimeout(resolve, 10000))
    ctx.body = { message: 'Hello World!' }
  }
)

// Add router middleware
app.use(router.routes())
app.use(router.allowedMethods())

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
