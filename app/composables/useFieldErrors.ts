/**
 * The messages of a dialog's own checks (before anything is sent to the server).
 *   const fe = useFieldErrors()
 *   fe.clear()
 *   if (!ok) fe.fail('code', t('...'))
 *   if (!fe.ok()) return          // nothing was wrong → go on and call the API
 * A message disappears when the field is edited: fe.drop('code').
 */
export function useFieldErrors() {
    const errs = ref<Record<string, string>>({})
    const clear = () => { errs.value = {} }
    const fail = (name: string, message: string) => { if (!errs.value[name]) errs.value[name] = message }
    const drop = (name: string) => { if (name in errs.value) { const { [name]: _gone, ...rest } = errs.value; errs.value = rest } }
    const ok = () => Object.keys(errs.value).length === 0
    return { errs, clear, fail, drop, ok }
}