import Koa, { type Middleware, type Next, type ParameterizedContext } from 'koa'
import { koaBody } from 'koa-body'
import Router from 'koa-router'
import logger from 'pino'
import supertest from 'supertest'

import { sleep } from './general'
import { koaCoolDown } from '../../src'
import type { KoaCoolDownProps } from '../../src/koa/types'

export const REQUEST_DELAY = 20

export const getApp = async (props?: KoaCoolDownProps) => {
  const assertionError: { error?: Error | undefined } = {}

  const app = new Koa({ proxy: true })
  const router = new Router()
  app.use(koaBody())
  app.use(koaCoolDown({ logger: logger({ level: 'fatal' }), ...props }))

  const request = supertest(app.callback())

  return { app, router, request, assertionError }
}

export const getRequestHandler =
  (
    before?: (
      ctx: ParameterizedContext,
      next: Next,
      sent: () => void
    ) => Promise<void> | void,
    after?: (
      ctx: ParameterizedContext,
      next: Next,
      sent: () => void
    ) => Promise<void> | void
  ): Middleware =>
  async (ctx, next) => {
    let sent = false

    await before?.(ctx, next, () => (sent = true))
    if (sent) {
      return
    }

    await sleep(REQUEST_DELAY)

    await after?.(ctx, next, () => (sent = true))
    if (sent) {
      return
    }

    ctx.set('x-request-id', `${ctx.request.header['x-request-id']}`)
    ctx.body = ctx.request.header['x-request-id']
  }

export const delayRequest = (
  delayMs: number,
  requestFn: () => Promise<Response>
) =>
  new Promise<Response>((resolve, reject) =>
    setTimeout(() => requestFn().then(resolve, reject), delayMs)
  )
