import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js'

export const JALALI_MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-18" -> { jy: 1405, jm: 8, jd: 27 } (null if the text is not a date) */
export function isoToJalali(iso: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    if (!m) return null
    return toJalaali(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** Jalali y/m/d -> "2026-11-18", or null when the date does not exist (e.g. 1403/12/31) */
export function jalaliToIso(jy: number, jm: number, jd: number): string | null {
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return null
    if (!isValidJalaaliDate(jy, jm, jd)) return null
    const g = toGregorian(jy, jm, jd)
    return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`
}

export function toPersianDigits(s: string): string {
    return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)
}

/** What the person sees: Jalali in Persian, ISO (Gregorian) in the other languages */
export function formatDate(iso: string | null | undefined, locale: string): string {
    if (!iso) return ''
    if (locale === 'fa') {
        const j = isoToJalali(iso)
        return j ? toPersianDigits(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`) : iso
    }
    return iso.slice(0, 10)
}

export function formatMoney(n: number | string | null | undefined, locale: string): string {
    if (n === null || n === undefined || n === '') return ''
    return Number(n).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 0 })
}