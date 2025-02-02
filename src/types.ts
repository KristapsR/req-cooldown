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

type LogFn = (message?: any, ...optionalParams: any[]) => void
export type Logger = {
  info: LogFn
  warn: LogFn
  error: LogFn
  debug: LogFn
}
