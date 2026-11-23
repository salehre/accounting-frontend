/**
 * A user can type any address. The menu already hides what they may not use; this guard also
 * stops the direct address, with the same two checks the backend makes (permission and plan feature).
 * The longest matching prefix wins. Pages not listed here (home, profile) are open to every signed-in user.
 */
const RULES: Array<{ prefix: string; permission?: string; feature?: string }> = [
    { prefix: '/accounts', permission: 'accounts.read' },
    { prefix: '/detail-accounts', permission: 'accounts.read' },
    { prefix: '/settings/accounting', permission: 'accounts.read' },
    { prefix: '/entries', permission: 'entries.read' },
    { prefix: '/entries/new', permission: 'entries.write' },
    { prefix: '/fiscal-years', permission: 'entries.read' },
    { prefix: '/locks', permission: 'entries.read' },
    { prefix: '/reports', permission: 'reports.read' },
    { prefix: '/reports/income-statement', permission: 'reports.read', feature: 'reports.statements' },
    { prefix: '/reports/balance-sheet', permission: 'reports.read', feature: 'reports.statements' },
    { prefix: '/bank', permission: 'bank.read', feature: 'bank-reconciliation' },
    { prefix: '/bank/new', permission: 'bank.manage', feature: 'bank-reconciliation' },
    { prefix: '/opening-balance', permission: 'entries.write', feature: 'opening-balance' },
    { prefix: '/users', permission: 'users.manage' },
    { prefix: '/roles', permission: 'users.manage' },
]

function ruleFor(path: string) {
    let best: (typeof RULES)[number] | undefined
    for (const r of RULES) {
        if ((path === r.prefix || path.startsWith(r.prefix + '/')) && (!best || r.prefix.length > best.prefix.length)) best = r
    }
    // year-end entries are managed from the fiscal years, by those who manage them
    if (/^\/fiscal-years\/[^/]+\/year-end/.test(path)) return { prefix: path, permission: 'fiscal-years.manage' }
    return best
}

export default defineNuxtRouteMiddleware((to) => {
    const session = useSessionStore()
    if (!session.loggedIn || session.choicePending) return
    const rule = ruleFor(to.path)
    if (!rule) return
    if (rule.permission && !session.can(rule.permission)) return deny()
    if (rule.feature && !session.hasFeature(rule.feature)) return deny()
})

function deny() {
    if (import.meta.client) {
        const nuxt = useNuxtApp()
        const notify = useNotify()
        const show = () => { notify.warning(nuxt.$i18n.t('toast.noAccess')) }
        // on the very first load the toaster is not on the screen yet
        if (nuxt.isHydrating) nuxt.hooks.hookOnce('app:suspense:resolve', show)
        else show()
    }
    return navigateTo('/')
}