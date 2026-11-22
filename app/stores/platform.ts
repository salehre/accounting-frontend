import type { PlatformAdmin, PlatformLogin } from '~/types/platform'
import {usePlatformApi} from "~/composables/usePlatformApi.ts";

const TOKEN_KEY = 'acc_platform_token'

function readToken(): string {
    try { return sessionStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}
function writeToken(token: string) {
    try {
        if (token) sessionStorage.setItem(TOKEN_KEY, token)
        else sessionStorage.removeItem(TOKEN_KEY)
    } catch { /* private mode: the sign-in lasts until the page is reloaded */ }
}

/**
 * The sign-in of the platform panel. It is separate from the session of the companies' users: its own token,
 * kept only for the life of the browser tab (sessionStorage), never in a cookie.
 */
export const usePlatformStore = defineStore('platform', {
    state: () => ({
        token: '',
        admin: null as PlatformAdmin | null,
        checked: false,
    }),

    getters: {
        loggedIn: (s) => s.admin !== null && s.token !== '',
    },

    actions: {
        clear() {
            this.token = ''
            this.admin = null
            this.checked = true
            writeToken('')
        },

        async login(username: string, password: string) {
            const res = await $fetch<PlatformLogin>('/platform/auth/login', {
                method: 'POST',
                baseURL: useRuntimeConfig().public.apiBase,
                headers: { Accept: 'application/json' },
                body: { username, password },
            }).catch((e) => { throw toApiError(e) })
            this.token = res.token
            this.admin = res.admin
            this.checked = true
            writeToken(res.token)
        },

        /** Is there a sign-in already? (first load and page refresh) */
        async restore() {
            this.token = readToken()
            this.admin = null
            if (this.token) {
                try {
                    this.admin = await usePlatformApi().get<PlatformAdmin>('/platform/auth/me')
                } catch {
                    this.clear()
                }
            }
            this.checked = true
        },

        async logout() {
            try { await usePlatformApi().post('/platform/auth/logout') } catch { /* already out */ }
            this.clear()
            await navigateTo('/platform/login')
        },
    },
})