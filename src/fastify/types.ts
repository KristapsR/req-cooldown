import type { FastifyReply } from 'fastify/types/reply'
import type { FastifyRequest } from 'fastify/types/request'

import type { AccessPluginOptions, BadReply, ResolveResponse } from '../types'

type CoolDownContext = {
  reqCooldownResolve?: (
    value: ResolveResponse | PromiseLike<ResolveResponse>
  ) => void
  reqCooldownTimedOut?: boolean
}

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface FastifyRequest extends CoolDownContext {}
}

export type FastifyCoolDownProps = AccessPluginOptions & {
  onBadReply?: (
    req: FastifyRequest,
    reply: FastifyReply,
    badReply: BadReply,
    done: (err?: Error) => Promise<void> | void
  ) => void
  /**
   * Fires when the innitial request execution timeos out.
   * If nothing is sent using req.send(...) then request will continue with original handler.
   */
  onTimeout?: (
    req: FastifyRequest,
    reply: FastifyReply,
    done: (err?: Error) => Promise<void> | void
  ) => void
  getKey?: (req: FastifyRequest) => string
  getUserKey?: (req: FastifyRequest) => string
  logLevel?: 'info' | 'warn' | 'error' | 'debug' | 'silent'
}
