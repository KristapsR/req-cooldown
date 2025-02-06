export type StoreEntry = {
  reqId: string
  cacheHits: number
  coolDown: Promise<ResolveResponse>
}

export type ReqCooldownResolver = (
  value: ResolveResponse | Promise<ResolveResponse>
) => void

export type BadReply = {
  statusCode: number
  payload: unknown
  type?: string | string[] | number | null
  headers: Record<string, number | string | string[] | undefined>
}

export type ResolveResponse =
  | {
      payload: unknown
      type?: string | string[] | number | null
      lastModified?: string | string[] | number | null
      headers: Record<string, number | string | string[] | undefined>
    }
  | {
      badReply: BadReply
    }
  | { timeout: true }

export type AccessPluginOptions = {
  methods?: string[]
  timeout?: number
}

type LogFn = (message?: unknown, ...optionalParams: unknown[]) => void
export type Logger = {
  info: LogFn
  warn: LogFn
  error: LogFn
  debug: LogFn
}
