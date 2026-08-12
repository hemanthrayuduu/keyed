import { cellToString, hasLeadingZero, looksNumeric, normalizeKey } from './normalize'
import type {
  CellValue,
  ColumnProfile,
  MatchOptions,
  MergeResult,
  MergeRow,
  Notice,
  SheetData,
} from './types'

export type MergeInput = {
  base: SheetData
  lookup: SheetData
  baseKeyIndex: number
  lookupKeyIndex: number
  pullIndex: number
  options: MatchOptions
}

const MAX_LISTED_ROWS = 5

function listRows(rowNumbers: number[]): string {
  const shown = rowNumbers.slice(0, MAX_LISTED_ROWS).join(', ')
  const rest = rowNumbers.length - MAX_LISTED_ROWS
  return rest > 0 ? `${shown} and ${rest.toLocaleString()} more` : shown
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** Append the pulled column without silently overwriting a base column of the same name. */
export function resolveColumnName(baseHeaders: string[], desired: string): string {
  const taken = new Set(baseHeaders.map((h) => h.toLowerCase()))
  if (!taken.has(desired.toLowerCase())) return desired
  let n = 2
  while (taken.has(`${desired} (${n})`.toLowerCase())) n += 1
  return `${desired} (${n})`
}

type LookupIndex = {
  /** First occurrence wins. */
  map: Map<string, CellValue>
  duplicateKeyCount: number
  droppedRowCount: number
  duplicateExamples: { key: string; rows: number[] }[]
  emptyKeyRows: number[]
}

function buildLookupIndex(
  lookup: SheetData,
  keyIndex: number,
  pullIndex: number,
  options: MatchOptions,
): LookupIndex {
  const map = new Map<string, CellValue>()
  const seenRows = new Map<string, number[]>()
  const emptyKeyRows: number[] = []
  let duplicateKeyCount = 0
  let droppedRowCount = 0

  for (let i = 0; i < lookup.rows.length; i += 1) {
    const row = lookup.rows[i]
    const key = normalizeKey(row[keyIndex] ?? null, options)
    const rowNumber = lookup.sourceRowNumbers[i]

    if (key === '') {
      emptyKeyRows.push(rowNumber)
      continue
    }

    const previous = seenRows.get(key)
    if (previous) {
      if (previous.length === 1) duplicateKeyCount += 1
      droppedRowCount += 1
      if (previous.length < 4) previous.push(rowNumber)
      continue
    }

    seenRows.set(key, [rowNumber])
    map.set(key, row[pullIndex] ?? null)
  }

  const duplicateExamples: { key: string; rows: number[] }[] = []
  for (const [key, rows] of seenRows) {
    if (rows.length > 1) {
      duplicateExamples.push({ key, rows })
      if (duplicateExamples.length === 2) break
    }
  }

  return { map, duplicateKeyCount, droppedRowCount, duplicateExamples, emptyKeyRows }
}

/**
 * Flags the classic silent failure: one file stores the key as a number and the
 * other stores it as text (or keeps leading zeros), so nothing matches.
 */
function numericStorageNotice(
  baseCol: ColumnProfile,
  lookupCol: ColumnProfile,
  options: MatchOptions,
  matchedCount: number,
): Notice | null {
  const mixedStorage =
    (baseCol.nativeNumberCount > 0 && lookupCol.textNumericCount > 0) ||
    (lookupCol.nativeNumberCount > 0 && baseCol.textNumericCount > 0)
  const leadingZeros = baseCol.samples.some(hasLeadingZero) || lookupCol.samples.some(hasLeadingZero)

  if (!mixedStorage && !leadingZeros) return null

  const cause = mixedStorage
    ? `"${baseCol.name}" and "${lookupCol.name}" do not agree on whether the key is a number or text`
    : `keys like "${[...baseCol.samples, ...lookupCol.samples].find(hasLeadingZero)}" keep leading zeros`

  if (options.coerceNumeric) {
    return {
      id: 'NUM-AS-TEXT',
      code: 'NUM-AS-TEXT',
      headline: 'Numbers stored as text — being coerced',
      detail: `${cause}. "Coerce numbers" is on, so 00123 and 123 are treated as the same key. Turn it off if those should stay distinct.`,
    }
  }

  return {
    id: 'NUM-AS-TEXT',
    code: 'NUM-AS-TEXT',
    headline: 'Numbers stored as text — not being coerced',
    detail: `${cause}, and "coerce numbers" is off${
      matchedCount === 0 ? ', which is likely why nothing matched' : ''
    }. Turn it on to match 00123 with 123.`,
  }
}

export function mergeSheets(input: MergeInput): MergeResult {
  const { base, lookup, baseKeyIndex, lookupKeyIndex, pullIndex, options } = input

  const index = buildLookupIndex(lookup, lookupKeyIndex, pullIndex, options)
  const baseHeaders = base.columns.map((c) => c.name)
  const pulledColumnName = resolveColumnName(baseHeaders, lookup.columns[pullIndex].name)

  const rows: MergeRow[] = new Array(base.rows.length)
  const emptyBaseKeyRows: number[] = []
  let matchedCount = 0

  for (let i = 0; i < base.rows.length; i += 1) {
    const cells = base.rows[i]
    const sourceRowNumber = base.sourceRowNumbers[i]
    const key = normalizeKey(cells[baseKeyIndex] ?? null, options)

    if (key === '') {
      emptyBaseKeyRows.push(sourceRowNumber)
      rows[i] = { cells, pulled: null, matched: false, sourceRowNumber }
      continue
    }

    const hit = index.map.get(key)
    if (hit === undefined) {
      rows[i] = { cells, pulled: null, matched: false, sourceRowNumber }
    } else {
      matchedCount += 1
      rows[i] = { cells, pulled: hit, matched: true, sourceRowNumber }
    }
  }

  const notices: Notice[] = []

  if (index.duplicateKeyCount > 0) {
    const example = index.duplicateExamples[0]
    const exampleText = example
      ? ` For example "${cellToString(example.key)}" appears on rows ${example.rows.join(', ')}${
          example.rows.length >= 4 ? ' and others' : ''
        }.`
      : ''
    notices.push({
      id: 'DUP-KEYS',
      code: 'DUP-KEYS',
      headline: `${index.duplicateKeyCount.toLocaleString()} duplicate ${plural(
        index.duplicateKeyCount,
        'key',
        'keys',
      )} in the lookup file`,
      detail: `The first match wins — the other ${index.droppedRowCount.toLocaleString()} ${plural(
        index.droppedRowCount,
        'row was',
        'rows were',
      )} ignored, in file order.${exampleText}`,
    })
  }

  if (emptyBaseKeyRows.length > 0) {
    notices.push({
      id: 'EMPTY-KEY-BASE',
      code: 'EMPTY-KEY',
      headline: `${emptyBaseKeyRows.length.toLocaleString()} ${plural(
        emptyBaseKeyRows.length,
        'row has',
        'rows have',
      )} an empty key in the base file`,
      detail: `${plural(emptyBaseKeyRows.length, 'Row', 'Rows')} ${listRows(
        emptyBaseKeyRows,
      )} — these can never match and will be counted as unmatched.`,
    })
  }

  if (index.emptyKeyRows.length > 0) {
    notices.push({
      id: 'EMPTY-KEY-LOOKUP',
      code: 'EMPTY-KEY',
      headline: `${index.emptyKeyRows.length.toLocaleString()} ${plural(
        index.emptyKeyRows.length,
        'row has',
        'rows have',
      )} an empty key in the lookup file`,
      detail: `${plural(index.emptyKeyRows.length, 'Row', 'Rows')} ${listRows(
        index.emptyKeyRows,
      )} — skipped when building the lookup.`,
    })
  }

  const numeric = numericStorageNotice(
    base.columns[baseKeyIndex],
    lookup.columns[lookupKeyIndex],
    options,
    matchedCount,
  )
  if (numeric) notices.push(numeric)

  if (pulledColumnName !== lookup.columns[pullIndex].name) {
    notices.push({
      id: 'NAME-CLASH',
      code: 'NAME-CLASH',
      headline: `The base file already has a column called "${lookup.columns[pullIndex].name}"`,
      detail: `The pulled column was named "${pulledColumnName}" instead, so nothing is overwritten.`,
    })
  }

  const total = base.rows.length
  return {
    headers: [...baseHeaders, pulledColumnName],
    pulledColumnName,
    rows,
    matchedCount,
    unmatchedCount: total - matchedCount,
    matchRate: total === 0 ? 0 : matchedCount / total,
    notices,
  }
}

/** Sample values for a column dropdown option, drawn from the first rows that have one. */
export function sampleColumn(rows: CellValue[][], index: number, limit = 3): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < rows.length && out.length < limit; i += 1) {
    const s = cellToString(rows[i][index] ?? null).trim()
    if (s === '' || seen.has(s)) continue
    seen.add(s)
    out.push(s.length > 24 ? `${s.slice(0, 23)}…` : s)
  }
  return out
}

export { looksNumeric }
