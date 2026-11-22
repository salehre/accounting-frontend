import {usePlatformStore} from "~/stores/platform.ts";

/** Pages of the platform panel (named middleware, used by definePageMeta in each of them). */
export default defineNuxtRouteMiddleware(async (to) => {
    const platform = usePlatformStore()
    if (!platform.checked) await platform.restore()

    const isLogin = to.path === '/platform/login'
    if (!platform.loggedIn) return isLogin ? undefined : navigateTo('/platform/login')
    if (isLogin) return navigateTo('/platform')
})