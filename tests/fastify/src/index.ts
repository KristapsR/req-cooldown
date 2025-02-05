import Fastify from 'fastify'
import { fastifyCoolDown } from 'req-cooldown'

type Context = { user: { id: number; name: string } }

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface FastifyRequest extends Context {}
}

const fastify = Fastify({ logger: true })

fastify.addHook(
  'onRequest',
  async (req) => (req.user = { id: 1, name: 'John' })
)

fastify.register(fastifyCoolDown, {
  methods: ['GET', 'POST'],
  timeout: 15000,
  getUserKey: (req) => JSON.stringify(req.user),
  onBadReply: (req, reply, badReply) => {
    console.log('onBadReply', badReply)
    reply.send(badReply)
  },
  onTimeout: () => {
    console.log('onTimeout')
  },
})

fastify.all('/', async (request, reply) => {
  await sleep(10000)
  // throw new Error('test')
  reply.send({ hello: 'world' })
})

fastify.listen({ port: 3000 })

await fastify.ready()

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
