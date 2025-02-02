import { getConnInfo } from '@hono/node-server/conninfo'
import { createMiddleware } from 'hono/factory'
import type { Env, Input } from 'hono/types'

import type { HonoCoolDownProps } from './types'
import { DEFAULT_METHODS, DEFAULT_TIMEOUT } from '../constants'
import type { StoreEntry } from '../types'

const defaultOptions = {
  methods: DEFAULT_METHODS,
  timeout: DEFAULT_TIMEOUT,
  logger: console,
}

export function honoCoolDown<
  E extends Env = object,
  P extends string = string,
  I extends Input = object
>(opts?: HonoCoolDownProps<E, P, I>) {
  const options = Object.assign({}, defaultOptions, opts)
  const promiseStore: Record<string, StoreEntry> = {}

  return createMiddleware<E, P, I>(async (ctx, next) => {
    if (!options.methods.includes(ctx.req.method)) return next()

    const logger =
      typeof options.logger === 'function'
        ? options.logger(ctx)
        : options.logger

    const reqId =
      options?.getRequestId?.(ctx) ?? Math.random().toString(36).slice(2)

    const body = await ctx.req.text()

    const key =
      options?.getKey?.(ctx) ??
      JSON.stringify({
        user: options?.getUserKey?.(ctx) ?? getConnInfo(ctx).remote.address,
        method: ctx.req.method,
        url: ctx.req.url,
        body,
      })

    const cached = promiseStore[key]

    logger.debug(key, reqId, cached)
    // XXX Finish this

    await next()

    logger.debug(ctx.res.status, ctx.res.body, ctx.header('Content-Type'))
  })
}
