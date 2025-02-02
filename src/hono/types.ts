import type { Context } from 'hono/dist/types/context'
import type { Env, Input, Next } from 'hono/types'

import type { AccessPluginOptions, BadReply, Logger } from '../types'

export type HonoCoolDownProps<
  E extends Env = object,
  P extends string = string,
  I extends Input = object
> = AccessPluginOptions & {
  onBadReply?: (
    ctx: Context<E, P, I>,
    badReply: BadReply,
    next: Next
  ) => Promise<void> | void
  onTimeout?: (ctx: Context<E, P, I>, next: Next) => Promise<void> | void
  getKey?: (context: Context<E, P, I>) => string
  getUserKey?: (context: Context<E, P, I>) => string
  getRequestId?: (context: Context<E, P, I>) => string
  logger?: Logger | ((context: Context<E, P, I>) => Logger)
}
