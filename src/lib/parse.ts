import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { looksNumeric } from './normalize'
import type { CellValue, ColumnProfile, FileFormat, ParsedFile, SheetData } from './types'

const SAMPLE_LIMIT = 3

export function detectFormat(fileName: string): FileFormat {
  return /\.(csv|tsv|txt)$/i.test(fileName) ? 'csv' : 'xlsx'
}

/** A1-style column letter, used when a header cell is blank. */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

function isBlankRow(row: CellValue[]): boolean {
  return row.every((c) => cellText(c).trim() === '')
}

function nonEmptyCount(row: CellValue[]): number {
  let n = 0
  for (const c of row) if (cellText(c).trim() !== '') n += 1
  return n
}

/**
 * Exports often start with a title line or a few blank rows before the real
 * header. Take the first row that carries as many values as any row can.
 */
export function findHeaderRow(grid: CellValue[][]): number {
  const scanLimit = Math.min(grid.length, 50)
  let widest = 0
  for (let i = 0; i < scanLimit; i += 1) widest = Math.max(widest, nonEmptyCount(grid[i]))
  const threshold = Math.min(2, widest)

  for (let i = 0; i < grid.length; i += 1) {
    if (nonEmptyCount(grid[i]) >= threshold && threshold > 0) return i
  }
  return 0
}

function dedupeHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((name, i) => {
    const base = name.trim() === '' ? `Column ${columnLetter(i)}` : name.trim()
    const count = seen.get(base.toLowerCase()) ?? 0
    seen.set(base.toLowerCase(), count + 1)
    return count === 0 ? base : `${base} (${count + 1})`
  })
}

function profileColumns(headers: string[], rows: CellValue[][]): ColumnProfile[] {
  const profiles: ColumnProfile[] = headers.map((name, index) => ({
    name,
    index,
    samples: [],
    textNumericCount: 0,
    nativeNumberCount: 0,
    emptyCount: 0,
  }))

  const seenSamples = headers.map(() => new Set<string>())

  for (const row of rows) {
    for (let c = 0; c < headers.length; c += 1) {
      const value = row[c] ?? null
      const profile = profiles[c]
      if (typeof value === 'number') {
        profile.nativeNumberCount += 1
      }
      const text = cellText(value).trim()
      if (text === '') {
        profile.emptyCount += 1
        continue
      }
      if (typeof value === 'string' && looksNumeric(text)) profile.textNumericCount += 1
      if (profile.samples.length < SAMPLE_LIMIT && !seenSamples[c].has(text)) {
        seenSamples[c].add(text)
        profile.samples.push(text.length > 24 ? `${text.slice(0, 23)}…` : text)
      }
    }
  }

  return profiles
}

function buildSheet(name: string, grid: CellValue[][], firstRowNumber: number): SheetData {
  const headerIndex = findHeaderRow(grid)
  const headerRow = grid[headerIndex] ?? []
  const width = grid.reduce((max, row) => Math.max(max, row.length), headerRow.length)

  const headers = dedupeHeaders(
    Array.from({ length: width }, (_, i) => cellText(headerRow[i] ?? null)),
  )

  const rows: CellValue[][] = []
  const sourceRowNumbers: number[] = []

  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const row = grid[i]
    if (isBlankRow(row)) continue
    const padded: CellValue[] = new Array(width)
    for (let c = 0; c < width; c += 1) padded[c] = row[c] ?? null
    rows.push(padded)
    sourceRowNumbers.push(firstRowNumber + i)
  }

  return {
    name,
    columns: profileColumns(headers, rows),
    rows,
    sourceRowNumbers,
    headerOffset: headerIndex,
  }
}

/** TextDecoder eats the BOM silently, so look for it in the bytes first. */
function hasUtf8Bom(buffer: ArrayBuffer): boolean {
  const head = new Uint8Array(buffer, 0, Math.min(3, buffer.byteLength))
  return head.length === 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

const DELIMITERS_TO_GUESS = [',', ';', '\t', '|']

/**
 * Papa can only guess a delimiter from rows with a consistent field count, and
 * blank lines poison that. Guess on a clean preview, then parse for real with
 * blank lines kept so reported row numbers still line up with the file.
 */
function guessDelimiter(text: string): string {
  const probe = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
    preview: 25,
    delimitersToGuess: DELIMITERS_TO_GUESS,
  })
  return probe.meta?.delimiter || ','
}

export function parseCsv(fileName: string, buffer: ArrayBuffer): ParsedFile {
  const hadBom = hasUtf8Bom(buffer)
  // Exports with a hand-written preamble often mix \n and \r\n in one file,
  // which leaves a stray \r on the end of every row if the guess goes the
  // other way. Settle on \n first and tell Papa not to guess.
  const text = stripBom(new TextDecoder('utf-8').decode(buffer)).replace(/\r\n?/g, '\n')
  const delimiter = guessDelimiter(text)

  const result = Papa.parse<string[]>(text, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: false,
    delimiter,
    newline: '\n',
  })

  const grid = (result.data as unknown as CellValue[][]) ?? []
  // Row 1 of a CSV is the first line of the file.
  const sheet = buildSheet('Sheet 1', grid, 1)

  return {
    fileName,
    format: 'csv',
    delimiter,
    hadBom,
    sheetNames: [sheet.name],
    sheets: { [sheet.name]: sheet },
  }
}

function formatDate(value: Date): string {
  const iso = value.toISOString()
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ')
}

export function parseWorkbook(fileName: string, buffer: ArrayBuffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: false })
  const sheets: Record<string, SheetData> = {}
  const sheetNames: string[] = []

  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name]
    if (!worksheet) continue

    // header: 1 returns arrays, never objects keyed by file content — this is
    // also what keeps sheet data away from the object-prototype code path.
    const raw = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    })

    const grid: CellValue[][] = raw.map((row) =>
      (row as unknown[]).map((cell) => {
        if (cell instanceof Date) return formatDate(cell)
        if (cell === undefined) return null
        return cell as CellValue
      }),
    )

    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null
    const firstRowNumber = (range?.s.r ?? 0) + 1

    sheetNames.push(name)
    sheets[name] = buildSheet(name, grid, firstRowNumber)
  }

  if (sheetNames.length === 0) {
    throw new Error('That workbook has no sheets in it.')
  }

  return { fileName, format: 'xlsx', hadBom: false, sheetNames, sheets }
}

export function parseFile(fileName: string, buffer: ArrayBuffer): ParsedFile {
  return detectFormat(fileName) === 'csv'
    ? parseCsv(fileName, buffer)
    : parseWorkbook(fileName, buffer)
}
