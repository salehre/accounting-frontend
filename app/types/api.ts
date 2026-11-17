export interface SessionUser {
  id: number
  username: string
  fullName: string
  role: string
  permissions: string[]
  credentialChoicePending?: boolean
}

export interface Subscription {
  state: 'active' | 'grace' | 'expired' | 'suspended'
  endsAt: string | null
  graceEndsAt: string | null
}

export interface FeaturesPayload {
  plan: { code?: string; name?: string } | string | null
  subscription: Subscription | null
  features: string[]
  limits: Record<string, { max: number | null; used: number }>
}
