/** Turns a failure of the platform API into a sentence in the current language (by the "code" the backend sends). */
export function usePlatformError() {
    const { t, te } = useI18n()
    return {
        of(e: unknown): string {
            const err = toApiError(e)
            if (err.status === 0) return t('errors.network')
            if (err.code && te(`platform.err.${err.code}`)) return t(`platform.err.${err.code}`)
            if (err.status === 429) return t('errors.tooManyAttempts')
            if (err.status === 404 && !err.code) return t('platform.err.notAvailable')
            return err.message || t('errors.generic')
        },
        /** The message of one field of a form (the field names are the ones of the backend, e.g. "admin.password") */
        field(e: unknown, name: string): string | null {
            const err = toApiError(e)
            const first = err.field(name)
            if (!first) return null
            return err.code && te(`platform.err.${err.code}`) ? t(`platform.err.${err.code}`) : first
        },
    }
}