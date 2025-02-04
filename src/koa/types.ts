import type { Next, ParameterizedContext } from 'koa'

import type { BadReply, AccessPluginOptions, Logger } from '../types'

declare module 'koa' {
  interface Request {
    body?: unknown
  }
}

export type KoaCoolDownProps<
  StateT = unknown,
  CustomT extends object = object
> = AccessPluginOptions & {
  onBadReply?: (
    ctx: ParameterizedContext<StateT, CustomT>,
    badReply: BadReply,
    next: Next
  ) => Promise<void> | void
  onTimeout?: (
    ctx: ParameterizedContext<StateT, CustomT>,
    next: Next
  ) => Promise<void> | void
  getKey?: (context: ParameterizedContext<StateT, CustomT>) => string
  getUserKey?: (context: ParameterizedContext<StateT, CustomT>) => string
  getRequestId?: (context: ParameterizedContext<StateT, CustomT>) => string
  logger?: Logger | ((context: ParameterizedContext<StateT, CustomT>) => Logger)
}
