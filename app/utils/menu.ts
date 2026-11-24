export interface MenuChild {
  label: string        // full translation key, e.g. reports.trialBalance.name
  to: string
  permission?: string
  feature?: string
}

export interface MenuItem {
  key: string          // translation key: menu.<key>
  to: string           // for a group: the address prefix of its pages (used to open it when one of them is shown)
  icon: string         // key of an icon in app/components/ui/AppIcon.vue
  permission?: string
  feature?: string
  ready: boolean       // false = the screen is not built yet (shown dimmed)
  children?: MenuChild[] // a group: it opens in the sidebar and shows these pages
}

/**
 * The whole menu in one place. An item is shown when the USER has the permission
 * and the COMPANY plan has the feature, the same two checks the backend makes.
 * A group is shown when at least one of its pages is allowed.
 */
export const MENU: MenuItem[] = [
  { key: 'dashboard', to: '/', icon: 'home', ready: true },
  { key: 'accounts', to: '/accounts', icon: 'list', permission: 'accounts.read', ready: true },
  { key: 'detailAccounts', to: '/detail-accounts', icon: 'users', permission: 'accounts.read', ready: true },
  { key: 'entries', to: '/entries', icon: 'book', permission: 'entries.read', ready: true },
  {
    key: 'reports', to: '/reports', icon: 'chart', permission: 'reports.read', ready: true,
    children: [
      { label: 'reports.trialBalance.name', to: '/reports/trial-balance' },
      { label: 'reports.ledger.name', to: '/reports/ledger' },
      { label: 'reports.journal.name', to: '/reports/journal' },
      { label: 'reports.incomeStatement.name', to: '/reports/income-statement', feature: 'reports.statements' },
      { label: 'reports.balanceSheet.name', to: '/reports/balance-sheet', feature: 'reports.statements' },
    ],
  },
  { key: 'bank', to: '/bank', icon: 'book', permission: 'bank.read', feature: 'bank-reconciliation', ready: true },
  {
    key: 'treasury', to: '/treasury', icon: 'book', permission: 'treasury.read', feature: 'treasury', ready: true,
    children: [
      { label: 'treasury.cheques', to: '/treasury' },
      { label: 'treasury.settings.title', to: '/treasury/settings', permission: 'treasury.manage' },
    ],
  },
  { key: 'fiscalYears', to: '/fiscal-years', icon: 'calendar', permission: 'entries.read', ready: true },
  { key: 'openingBalance', to: '/opening-balance', icon: 'download', permission: 'entries.write', feature: 'opening-balance', ready: true },
  { key: 'accountingSettings', to: '/settings/accounting', icon: 'menu', permission: 'accounts.read', ready: true },
  { key: 'locks', to: '/locks', icon: 'lock', permission: 'entries.read', ready: true },
  {
    key: 'users', to: '/users', icon: 'users', permission: 'users.manage', ready: true,
    children: [
      { label: 'users.title', to: '/users' },
      { label: 'roles.title', to: '/roles' },
    ],
  },
]