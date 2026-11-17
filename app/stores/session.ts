import type { FeaturesPayload, SessionUser } from '~/types/api'

export const useSessionStore = defineStore('session', {
  state: () => ({
    user: null as SessionUser | null,
    features: null as FeaturesPayload | null,
    checked: false, // have we asked the server "who am I?" yet
  }),

  getters: {
    loggedIn: (s) => s.user !== null,
    choicePending: (s) => s.user?.credentialChoicePending === true,
    subscriptionState: (s) => s.features?.subscription?.state ?? 'active',
    readOnly: (s) => (s.features?.subscription?.state ?? 'active') === 'expired',
  },

  actions: {
    can(permission: string): boolean {
      const p = this.user?.permissions ?? []
      return p.includes('*') || p.includes(permission)
    },

    hasFeature(feature: string | undefined): boolean {
      if (!feature || feature === 'core') return true
      return this.features?.features.includes(feature) ?? false
    },

    markChoicePending() {
      if (this.user) this.user.credentialChoicePending = true
    },

    clear() {
      this.user = null
      this.features = null
      this.checked = true
    },

    async login(company: string, username: string, password: string) {
      const api = useApi()
      storeCompany(company.trim().toLowerCase())
      await api.ensureCsrf(true)
      this.user = await api.post<SessionUser>('/auth/login', { username, password })
      this.checked = true
      await this.loadFeatures()
    },

    /** Is there a session already? (used on first load and page refresh) */
    async restore() {
      try {
        this.user = await useApi().get<SessionUser>('/auth/me')
        await this.loadFeatures()
      } catch {
        this.user = null
      }
      this.checked = true
    },

    async loadFeatures() {
      if (this.choicePending) return // the backend refuses it until the password is decided
      this.features = await useApi().get<FeaturesPayload>('/auth/features')
    },

    async keepPassword() {
      await useApi().post('/auth/keep-password')
      await this.afterChoice()
    },

    async changePassword(currentPassword: string, newPassword: string) {
      await useApi().post('/auth/change-password', { currentPassword, newPassword })
      await this.afterChoice()
    },

    async afterChoice() {
      this.user = await useApi().get<SessionUser>('/auth/me')
      await this.loadFeatures()
    },

    async logout() {
      try { await useApi().post('/auth/logout') } catch { /* already out */ }
      this.clear()
      await navigateTo('/login')
    },
  },
})
