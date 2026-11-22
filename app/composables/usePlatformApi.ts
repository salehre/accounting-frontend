import type { FetchOptions } from 'ofetch'
import {usePlatformStore} from "~/stores/platform.ts";

/**
 * The door to the platform panel of the backend. It is not useApi: the panel has its own sign-in
 * (a bearer token), no company header and no cookie session.
 */
export function usePlatformApi() {
    const config = useRuntimeConfig()
    const store = usePlatformStore()

    async function request<T>(path: string, options: FetchOptions<'json'> = {}): Promise<T> {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (store.token) headers.Authorization = `Bearer ${store.token}`

        try {
            return await $fetch<T>(path, { ...(options as any), baseURL: config.public.apiBase, headers }) as T
        } catch (e) {
            const err = toApiError(e)
            if (err.status === 401 && store.token) {
                store.clear()
                if (useRoute().path !== '/platform/login') await navigateTo('/platform/login')
            }
            throw err
        }
    }

    return {
        get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { query: query as any }),
        post: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'POST', body }),
        patch: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PATCH', body }),
        put: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PUT', body }),
        del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    }
}