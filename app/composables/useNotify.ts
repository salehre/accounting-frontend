import { toast } from 'vue-sonner'

/**
 * The one place that shows toasts: "saved", "deleted"... Use it like
 *   const notify = useNotify()
 *   notify.success(t('toast.accountCreated', { name }))
 * Errors that belong to a form stay inside the form; a toast is for the result of an action.
 */
export function useNotify() {
    return {
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message, { duration: 6000 }),
        warning: (message: string) => toast.warning(message, { duration: 6000 }),
        info: (message: string) => toast.info(message),
    }
}