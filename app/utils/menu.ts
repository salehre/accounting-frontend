export interface MenuItem {
  key: string          // translation key: menu.<key>
  to: string
  icon: string         // key of an icon in app/components/AppIcon.vue
  permission?: string
  feature?: string
  ready: boolean       // false = the screen is not built yet (shown dimmed)
}

/**
 * The whole menu in one place. An item is shown when the USER has the permission
 * and the COMPANY plan has the feature, the same two checks the backend makes.
 */
export const MENU: MenuItem[] = [
  { key: 'dashboard', to: '/', icon: 'home', ready: true },
  { key: 'accounts', to: '/accounts', icon: 'list', permission: 'accounts.read', ready: false },
  { key: 'entries', to: '/entries', icon: 'book', permission: 'entries.read', ready: false },
  { key: 'reports', to: '/reports', icon: 'chart', permission: 'reports.read', ready: false },
  { key: 'fiscalYears', to: '/fiscal-years', icon: 'calendar', permission: 'entries.read', ready: false },
  { key: 'locks', to: '/locks', icon: 'lock', permission: 'entries.read', ready: false },
  { key: 'users', to: '/users', icon: 'users', permission: 'users.manage', ready: false },
]
