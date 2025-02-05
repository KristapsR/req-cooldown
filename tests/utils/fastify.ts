import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type LightMyRequestResponse,
  type RouteHandlerMethod,
} from 'fastify'

import { sleep } from './general'
import { fastifyCoolDown } from '../../src'
import type { FastifyCoolDownProps } from '../../src/fastify/types'

export const REQUEST_DELAY = 10

export const getApp = async (props?: FastifyCoolDownProps) => {
  const assertionError: { error?: Error | undefined } = {}

  const fastify = Fastify()
  fastify.setErrorHandler((error, request, reply) => {
    if (error.name === 'AssertionError') {
      assertionError.error = error
      reply.status(500).send({ assertionError: error.message })
      return
    }
    throw error
  })
  if (props) {
    await fastify.register(fastifyCoolDown, props)
  } else {
    await fastify.register(fastifyCoolDown)
  }
  return { fastify, assertionError }
}

export const getRequestHandler =
  (
    before?: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void> | void,
    after?: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void> | void
  ): RouteHandlerMethod =>
  async (request, reply) => {
    await before?.(request, reply)
    if (reply.sent) {
      return
    }

    await sleep(REQUEST_DELAY)

    await after?.(request, reply)
    if (reply.sent) {
      return
    }

    reply.send(request.headers['x-request-id'])
  }

export const delayRequest = (
  delayMs: number,
  requestFn: () => Promise<LightMyRequestResponse>
) =>
  new Promise<LightMyRequestResponse>((resolve, reject) =>
    setTimeout(() => requestFn().then(resolve, reject), delayMs)
  )
