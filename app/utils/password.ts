/** A random password without look-alike characters (0/O, 1/l/I), for the administrator who gives it to a user. */
export function generatePassword(length = 14): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    const bytes = new Uint32Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** The server counts bytes (bcrypt ignores everything after 72 bytes), so we count bytes too. */
export const byteLength = (s: string): number => new TextEncoder().encode(s).length