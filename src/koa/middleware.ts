import type { Middleware } from 'koa'

import { getHeaderValue, type KoaCoolDownProps } from './types'
import {
  DEFAULT_METHODS,
  DEFAULT_TIMEOUT,
  REQ_BODY_METHODS,
} from '../constants'
import type { ReqCooldownResolver, ResolveResponse, StoreEntry } from '../types'

const defaultOptions = {
  methods: DEFAULT_METHODS,
  timeout: DEFAULT_TIMEOUT,
  logger: console,
}

export function koaCoolDown<StateT = unknown, CustomT extends object = object>(
  opts?: KoaCoolDownProps<StateT, CustomT>
): Middleware<StateT, CustomT> {
  const promiseStore: Record<string, StoreEntry> = {}
  const options = Object.assign({}, defaultOptions, opts)

  return async (ctx, next) => {
    if (!options.methods.includes(ctx.method)) return next()

    const logger =
      typeof options.logger === 'function'
        ? options.logger(ctx)
        : options.logger

    if (ctx.request.get('content-type') && ctx.request.body === undefined) {
      logger.warn('Will not Cool-Down without body middleware')
      return next()
    }

    const reqId =
      options?.getRequestId?.(ctx) ?? Math.random().toString(36).slice(2)

    const key =
      options?.getKey?.(ctx) ??
      JSON.stringify({
        user: options?.getUserKey?.(ctx) ?? ctx.ip,
        method: ctx.method,
        url: ctx.url,
        // TODO Handle streams
        body: REQ_BODY_METHODS.includes(ctx.method.toUpperCase())
          ? ctx.request.body
          : undefined,
      })

    const cached = promiseStore[key]

    if (!cached) {
      let reqCooldownTimedOut = false
      let reqCooldownResolve: ReqCooldownResolver = () => {
        throw new Error('Request Cool-Down promise not initialized')
      }

      const cached: Omit<StoreEntry, 'coolDown'> & {
        coolDown?: StoreEntry['coolDown']
      } = { reqId, cacheHits: 0 }

      function getPromise(this: Pick<StoreEntry, 'cacheHits'>) {
        return new Promise<ResolveResponse>((resolve) => {
          const timeout = setTimeout(() => {
            logger.warn({ hits: this.cacheHits }, 'Cool-Down timeout')

            // Cleanup
            delete promiseStore[key]

            reqCooldownTimedOut = true
            resolve({ timeout: true })
          }, options.timeout)

          reqCooldownResolve = (value) => {
            clearTimeout(timeout)
            delete promiseStore[key]

            if (this.cacheHits > 0) {
              logger.info({ reqId, hits: this.cacheHits }, 'Cooled-Down')
            }
            resolve(value)
          }
        })
      }

      cached.coolDown = getPromise.bind(cached)()
      promiseStore[key] = cached as StoreEntry

      // Continue with the request
      try {
        await next()

        // Handle response
        if (ctx.status < 200 || ctx.status >= 300) {
          reqCooldownResolve({
            badReply: {
              statusCode: ctx.status,
              payload: ctx.body,
              type: ctx.response.get('Content-Type') ?? null,
              headers: ctx.response.headers,
            },
          })
        } else {
          reqCooldownResolve({
            payload: ctx.body,
            type: ctx.response.get('Content-Type') ?? null,
            lastModified: ctx.response.get('Last-Modified') ?? null,
            headers: ctx.response.headers,
          })
        }

        if (reqCooldownTimedOut) {
          logger.warn('Got results after req-cooldown timeout')
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        reqCooldownResolve({
          badReply: {
            statusCode: 500,
            payload: { error: message },
            type: 'application/json',
            headers: ctx.response.headers,
          },
        })
        throw error
      }

      return
    }

    // Handle cached request
    cached.cacheHits++
    logger.debug({ coolReqId: cached.reqId }, 'Cool-Down')

    const result = await cached.coolDown

    if ('timeout' in result) {
      if (options?.onTimeout) return options.onTimeout(ctx, next)
      throw new Error('Timeout')
    }

    if ('badReply' in result) {
      if (options?.onBadReply)
        return options.onBadReply(ctx, result.badReply, next)

      for (const [key, value] of Object.entries(result.badReply.headers)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const v of value) ctx.set(key, v)
          continue
        }
        ctx.set(key, `${value}`)
      }

      ctx.status = result.badReply.statusCode
      if (result.badReply.type)
        ctx.set(
          'Content-Type',
          typeof result.badReply.type === 'number'
            ? result.badReply.type.toString()
            : result.badReply.type
        )
      ctx.body = result.badReply.payload
      return
    }

    for (const [key, value] of Object.entries(result.headers)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const v of value) ctx.set(key, v)
        continue
      }
      ctx.set(key, `${value}`)
    }

    if (result.type) ctx.set('Content-Type', getHeaderValue(result.type))
    if (result.lastModified)
      ctx.set('Last-Modified', getHeaderValue(result.lastModified))

    ctx.body = result.payload

    logger.debug({ coolReqId: cached.reqId }, 'Cool response')
  }
}
