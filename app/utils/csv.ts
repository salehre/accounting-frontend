/**
 * A small, careful CSV reader (quotes, doubled quotes, line breaks inside quotes, BOM).
 * The separator is guessed from the first line: comma, semicolon or tab, whichever is used most.
 */
export function parseCsv(input: string): { rows: string[][]; delimiter: string } {
    const text = input.replace(/^﻿/, '')
    const delimiter = guessDelimiter(text)

    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false

    for (let i = 0; i < text.length; i++) {
        const c = text[i]!

        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
            } else {
                cell += c
            }
            continue
        }

        if (c === '"') quoted = true
        else if (c === delimiter) { row.push(cell); cell = '' }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++
            row.push(cell); cell = ''
            rows.push(row); row = []
        } else cell += c
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row) }

    return { rows: rows.filter((r) => r.some((x) => x.trim() !== '')), delimiter }
}

function guessDelimiter(text: string): string {
    const first = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
    let best = ','
    let bestCount = -1
    for (const d of [',', ';', '\t']) {
        let n = 0
        let q = false
        for (const c of first) { if (c === '"') q = !q; else if (c === d && !q) n++ }
        if (n > bestCount) { best = d; bestCount = n }
    }
    return best
}

/**
 * Text of a file: UTF-8 first; if that produced broken characters, the old Windows Arabic/Persian
 * encoding (many bank exports use it).
 */
export async function readTextFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const utf8 = new TextDecoder('utf-8').decode(buffer)
    if (!utf8.includes('�')) return utf8
    try { return new TextDecoder('windows-1256').decode(buffer) } catch { return utf8 }
}