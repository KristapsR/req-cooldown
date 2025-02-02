export type StoreEntry = {
  reqId: string
  cacheHits: number
  coolDown: Promise<ResolveResponse>
}

export type BadReply = {
  statusCode: number
  payload: unknown
  type?: string | string[] | number | null
}

export type ResolveResponse =
  | {
      payload: unknown
      type?: string | string[] | number | null
      lastModified?: string | string[] | number | null
      etag?: string | string[] | number | null
    }
  | {
      badReply: BadReply
    }
  | { timeout: true }

export type AccessPluginOptions = {
  methods?: string[]
  timeout?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogFn = (message?: unknown, ...optionalParams: any[]) => void
export type Logger = {
  info: LogFn
  warn: LogFn
  error: LogFn
  debug: LogFn
}
