export type CellValue = string | number | boolean | null

export type FileFormat = 'csv' | 'xlsx'

export type ColumnProfile = {
  /** Header text as written in the file. */
  name: string
  index: number
  /** 2-3 non-empty sample values, for telling "ID" from "ID". */
  samples: string[]
  /** Cells that are text but look like numbers, e.g. "00123". */
  textNumericCount: number
  /** Cells stored as a true number type (xlsx only; CSV is always text). */
  nativeNumberCount: number
  emptyCount: number
}

export type SheetData = {
  name: string
  columns: ColumnProfile[]
  /** Data rows only; header row already removed. Aligned to columns by index. */
  rows: CellValue[][]
  /** 1-based line/row number in the original file, for error messages. */
  sourceRowNumbers: number[]
  /** Rows skipped before the header (blank leading rows). */
  headerOffset: number
}

export type ParsedFile = {
  fileName: string
  format: FileFormat
  /** Delimiter guessed for CSV files, e.g. ";" — surfaced in the UI. */
  delimiter?: string
  hadBom: boolean
  sheetNames: string[]
  sheets: Record<string, SheetData>
}

export type MatchOptions = {
  trim: boolean
  ignoreCase: boolean
  coerceNumeric: boolean
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  trim: true,
  ignoreCase: true,
  coerceNumeric: true,
}

export type MergeRow = {
  cells: CellValue[]
  pulled: CellValue
  matched: boolean
  sourceRowNumber: number
}

export type NoticeCode = 'DUP-KEYS' | 'NUM-AS-TEXT' | 'EMPTY-KEY' | 'NAME-CLASH'

export type Notice = {
  id: string
  code: NoticeCode
  headline: string
  detail: string
}

export type MergeResult = {
  /** Base columns plus the pulled column appended last. */
  headers: string[]
  /** Name given to the appended column (de-duplicated if it clashed). */
  pulledColumnName: string
  rows: MergeRow[]
  matchedCount: number
  unmatchedCount: number
  matchRate: number
  notices: Notice[]
}
