import type { CellValue, MatchOptions } from './types'

const INTEGER_RE = /^[+-]?\d+$/
const DECIMAL_RE = /^[+-]?(\d+\.\d*|\.\d+)$/

/** Text that a spreadsheet would happily have stored as a number. */
export function looksNumeric(raw: string): boolean {
  const s = raw.trim()
  if (s === '') return false
  return INTEGER_RE.test(s) || DECIMAL_RE.test(s)
}

export function hasLeadingZero(raw: string): boolean {
  const s = raw.trim().replace(/^[+-]/, '')
  return /^0\d/.test(s)
}

/**
 * Canonical numeric form without going through Number(), so 20-digit account
 * numbers keep every digit instead of being rounded to a float.
 */
function canonicalNumber(raw: string): string {
  let s = raw.trim()
  let sign = ''
  if (s[0] === '+' || s[0] === '-') {
    sign = s[0] === '-' ? '-' : ''
    s = s.slice(1)
  }

  let intPart = s
  let fracPart = ''
  const dot = s.indexOf('.')
  if (dot !== -1) {
    intPart = s.slice(0, dot)
    fracPart = s.slice(dot + 1)
  }

  intPart = intPart.replace(/^0+(?=\d)/, '')
  if (intPart === '') intPart = '0'
  fracPart = fracPart.replace(/0+$/, '')

  const body = fracPart === '' ? intPart : `${intPart}.${fracPart}`
  // -0 and 0 are the same key.
  if (sign === '-' && /^0(\.0*)?$/.test(body)) return body
  return sign + body
}

export function cellToString(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(value)
  }
  return String(value)
}

/**
 * Reduce a cell to the string two rows must share to be considered a match.
 * Returns '' for keys that are empty under the current options.
 */
export function normalizeKey(value: CellValue, options: MatchOptions): string {
  let s = cellToString(value)
  if (options.trim) s = s.trim()
  if (s === '') return ''
  if (options.coerceNumeric && looksNumeric(s)) {
    // Numbers have no case, so this branch is already case-stable.
    return canonicalNumber(s)
  }
  if (options.ignoreCase) s = s.toLowerCase()
  return s
}

/** True when the cell is blank once trimmed — always trimmed, blank is blank. */
export function isEmptyCell(value: CellValue): boolean {
  return cellToString(value).trim() === ''
}
