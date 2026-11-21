/** The three built-in roles have translated names; a custom role shows the name it was given. */
export function useRoleLabel() {
    const { t, te } = useI18n()
    return (name: string): string => (te(`roles.builtIn.${name}`) ? t(`roles.builtIn.${name}`) : name)
}

/** "accounts.read" -> "accounts_read": the key used in the translation files */
export const permKey = (code: string): string => code.replace(/[.-]/g, '_')