import fastifyPlugin from 'fastify-plugin'

import type { FastifyCoolDownProps } from './types'
import {
  DEFAULT_METHODS,
  DEFAULT_TIMEOUT,
  REQ_BODY_METHODS,
} from '../constants'
import type { ResolveResponse, StoreEntry } from '../types'

const defaultOptions = {
  methods: DEFAULT_METHODS,
  timeout: DEFAULT_TIMEOUT,
  logLevel: 'info',
}

export const fastifyCoolDown = fastifyPlugin<FastifyCoolDownProps>(
  (app, opts, done) => {
    const promiseStore: Record<string, StoreEntry> = {}
    const options = Object.assign({}, defaultOptions, opts)

    app.addHook('preHandler', async (req, reply) => {
      if (!options.methods.includes(req.method)) return done()

      const logger =
        options.logLevel !== 'silent'
          ? req.log.child(
              { plugin: 'req-cooldown' },
              { level: options.logLevel }
            )
          : undefined

      const key =
        options.getKey?.(req) ??
        JSON.stringify({
          user: options.getUserKey?.(req) ?? req.ip,
          method: req.method,
          url: req.originalUrl,
          // TODO Handle streams
          body: REQ_BODY_METHODS.includes(req.method.toUpperCase())
            ? req.body
            : undefined,
        })

      const cached = promiseStore[key]

      if (!cached) {
        const cached: Omit<StoreEntry, 'coolDown'> & {
          coolDown?: StoreEntry['coolDown']
        } = { reqId: req.id, cacheHits: 0 }

        function getPromise(this: Pick<StoreEntry, 'cacheHits'>) {
          return new Promise<ResolveResponse>((resolve) => {
            const timeout = setTimeout(() => {
              // Don't warn if no cache hits
              if (this.cacheHits > 0) {
                req.reqCooldownTimedOut = true
                logger?.warn({ hits: this.cacheHits }, 'Cool-Down timeout')
              }

              // Cleanup
              delete promiseStore[key]
              delete req['reqCooldownResolve']

              resolve({ timeout: true })
            }, options.timeout)

            req.reqCooldownResolve = (value) => {
              clearTimeout(timeout)
              delete promiseStore[key]
              delete req['reqCooldownResolve']

              if (this.cacheHits > 0) {
                logger?.info({ hits: this.cacheHits }, 'Cooled-Down')
              }
              resolve(value)
            }
          })
        }

        // NOTE: There could be a better way of binding the function to cached object, but this works.
        cached.coolDown = getPromise.bind(cached)()
        promiseStore[key] = cached as StoreEntry

        return done()
      }

      cached.cacheHits++
      logger?.debug('Cool-Down')
      const result = await cached.coolDown

      if ('timeout' in result) {
        if (options.onTimeout) return options.onTimeout(req, reply, done)
        throw new Error('Timeout')
      }

      if ('badReply' in result) {
        if (options.onBadReply)
          return options.onBadReply(req, reply, result.badReply, done)

        reply.headers(result.badReply.headers)
        reply.header('Content-Type', result.badReply.type)
        reply.status(result.badReply.statusCode)
        reply.send(result.badReply.payload)
        return
      }

      reply.headers(result.headers)
      reply.header('Content-Type', result.type)
      reply.header('Last-Modified', result.lastModified)
      reply.send(result.payload)

      logger?.debug({ coolReqId: cached.reqId }, 'Cool response')
    })

    app.addHook('onSend', async (req, reply, payload) => {
      const logger =
        options.logLevel !== 'silent'
          ? req.log.child(
              { plugin: 'req-cooldown' },
              { level: options.logLevel }
            )
          : undefined

      if (reply.statusCode < 200 || reply.statusCode >= 300) {
        return req.reqCooldownResolve?.({
          badReply: {
            statusCode: reply.statusCode,
            payload: payload,
            type: reply.getHeader('Content-Type') ?? null,
            headers: reply.getHeaders(),
          },
        })
      }

      req.reqCooldownResolve?.({
        payload: payload,
        type: reply.getHeader('Content-Type') ?? null,
        lastModified: reply.getHeader('Last-Modified') ?? null,
        headers: reply.getHeaders(),
      })

      if (req.reqCooldownTimedOut) {
        logger?.warn('Got results after req-cooldown timeout')
      }
    })

    done()
  },
  { fastify: '5.x', name: 'req-cooldown' }
)
