import type { FetchOptions } from 'ofetch'

const COMPANY_KEY = 'acc_company'

export function getStoredCompany(): string {
  try { return localStorage.getItem(COMPANY_KEY) ?? '' } catch { return '' }
}
export function storeCompany(code: string) {
  try { localStorage.setItem(COMPANY_KEY, code) } catch { /* private mode: not remembered */ }
}

function xsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]!) : null
}

/**
 * The one door to the backend.
 * - cookie session (Sanctum): asks for the CSRF cookie first and sends it back as X-XSRF-TOKEN
 * - sends the company code (X-Company) when several companies share the system
 * - turns every failure into an ApiError, and handles "not logged in" and "must choose password" centrally
 */
export function useApi() {
  const config = useRuntimeConfig()

  async function ensureCsrf(force = false) {
    if (force || !xsrfToken()) {
      await $fetch('/sanctum/csrf-cookie', { headers: companyHeaders() })
    }
  }

  function companyHeaders(): Record<string, string> {
    const code = getStoredCompany()
    return config.public.tenancy === 'multi' && code ? { 'X-Company': code } : {}
  }

  async function request<T>(path: string, options: FetchOptions<'json'> = {}, retried = false): Promise<T> {
    const method = String(options.method ?? 'GET').toUpperCase()
    const unsafe = method !== 'GET' && method !== 'HEAD'

    if (unsafe) await ensureCsrf()

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...companyHeaders(),
      ...((options.headers as Record<string, string>) ?? {}),
    }
    const token = xsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token

    try {
      return await $fetch<T>(path, { ...(options as any), baseURL: config.public.apiBase, headers }) as T
    } catch (e) {
      const err = toApiError(e)

      // the CSRF token expired: get a new one and try once more
      if (err.status === 419 && !retried) {
        await ensureCsrf(true)
        return request<T>(path, options, true)
      }

      const session = useSessionStore()
      if (err.status === 401 && !path.startsWith('/auth/login')) {
        session.clear()
        if (useRoute().path !== '/login') await navigateTo('/login')
      }
      if (err.status === 403 && err.code === 'credential_choice_required') {
        session.markChoicePending()
        await navigateTo('/choose-password')
      }
      throw err
    }
  }

  /** Downloads a file (an Excel report) and gives it to the browser to save. */
  async function download(path: string, query?: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = { Accept: '*/*', ...companyHeaders() }
    const token = xsrfToken()
    if (token) headers['X-XSRF-TOKEN'] = token

    let res
    try {
      res = await $fetch.raw<Blob>(path, { baseURL: config.public.apiBase, headers, query: query as any, responseType: 'blob' })
    } catch (e) {
      // with a blob response an error body is a blob too: read the JSON out of it
      const err = e as { data?: unknown; response?: { _data?: unknown; status?: number } }
      const body = err?.data ?? err?.response?._data
      if (body instanceof Blob) {
        let json: any = {}
        try { json = JSON.parse(await body.text()) } catch { /* not JSON */ }
        const status = (e as any)?.status ?? (e as any)?.statusCode ?? err?.response?.status ?? 0
        const apiErr = toApiError({ status, data: json, message: (e as any)?.message })
        if (apiErr.status === 401) { useSessionStore().clear(); await navigateTo('/login') }
        throw apiErr
      }
      throw toApiError(e)
    }

    const disposition = res.headers.get('content-disposition') ?? ''
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1]
    const url = URL.createObjectURL(res._data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name ? decodeURIComponent(name) : 'report.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return {
    download,
    get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { query: query as any }),
    post: <T>(path: string, body?: Record<string, unknown> | FormData) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PATCH', body }),
    put: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PUT', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    ensureCsrf,
  }
}