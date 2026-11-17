/** One shape for every failure, so pages never have to look inside raw fetch errors. */
export class ApiError extends Error {
  status: number
  code: string | null
  errors: Record<string, string[]>

  constructor(status: number, message: string, code: string | null = null, errors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }

  /** First message of a field, or null */
  field(name: string): string | null {
    return this.errors[name]?.[0] ?? null
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  const err = e as { status?: number; statusCode?: number; data?: any; message?: string }
  const status = err?.status ?? err?.statusCode ?? 0
  const data = err?.data ?? {}
  return new ApiError(status, data.message ?? err?.message ?? 'Request failed', data.code ?? null, data.errors ?? {})
}
