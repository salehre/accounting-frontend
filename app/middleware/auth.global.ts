const PUBLIC = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  // The platform panel (the people who run the software) has its own sign-in: see middleware/platform-auth.ts
  if (to.path === '/platform' || to.path.startsWith('/platform/')) return

  const session = useSessionStore()
  if (!session.checked) await session.restore()

  const isPublic = PUBLIC.includes(to.path)

  if (!session.loggedIn) {
    return isPublic ? undefined : navigateTo('/login')
  }
  if (session.choicePending) {
    return to.path === '/choose-password' ? undefined : navigateTo('/choose-password')
  }
  if (isPublic || to.path === '/choose-password') return navigateTo('/')
})