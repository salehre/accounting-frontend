/** What the platform panel API answers (see routes/platform.php in the backend). */

export interface PlatformAdmin {
    id: number
    username: string
    fullName: string
}

export interface PlatformLogin {
    token: string
    expiresAt: string
    admin: PlatformAdmin
}

export type SubscriptionState = 'active' | 'grace' | 'expired'

export interface PlatformSubscription {
    state: SubscriptionState
    endsAt: string | null
    graceEndsAt: string | null
}

export interface PlatformCompany {
    code: string
    name: string
    database: string
    status: 'active' | 'suspended'
    createdAt: string
    plan: { code: string; name: string } | null
    subscription: PlatformSubscription
    license: { active: boolean; hint: string | null; issuedAt: string | null }
}

export interface PlatformOverride {
    kind: 'feature' | 'limit'
    code: string
    enabled: boolean | null
    value: number | null
    until: string | null
    reason: string
    createdAt: string
}

export interface PlatformLicense {
    id: number
    hint: string
    status: 'active' | 'revoked'
    note: string | null
    createdAt: string
    revokedAt: string | null
    lastCheckedAt: string | null
}

export interface PlatformCompanyDetail extends PlatformCompany {
    features: string[]
    limits: Record<string, number | null>
    overrides: PlatformOverride[]
    licenses: PlatformLicense[]
}

export interface PlatformPlan {
    code: string
    name: string
    features: string[]
    limits: Record<string, number | null>
    companies: number // how many companies are on this plan
}

export interface PlatformPlans {
    data: PlatformPlan[]
    catalog: { features: Record<string, string>; limits: Record<string, string> }
}

export interface PlatformAuditRow {
    id: number
    action: string
    company: string | null
    details: Record<string, unknown> | null
    by: string | null
    at: string
}

export interface PlatformCreated {
    company: PlatformCompanyDetail
    admin: { username: string; password: string | null } | null
}