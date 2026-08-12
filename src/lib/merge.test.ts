import { describe, expect, it } from 'vitest'
import { mergeSheets, resolveColumnName } from './merge'
import { normalizeKey } from './normalize'
import { findHeaderRow, parseCsv } from './parse'
import { DEFAULT_MATCH_OPTIONS, type CellValue, type MatchOptions, type SheetData } from './types'

function sheet(headers: string[], rows: CellValue[][], name = 'Sheet 1'): SheetData {
  return {
    name,
    columns: headers.map((h, index) => ({
      name: h,
      index,
      samples: rows
        .map((r) => String(r[index] ?? ''))
        .filter((s) => s !== '')
        .slice(0, 3),
      textNumericCount: rows.filter(
        (r) => typeof r[index] === 'string' && /^\d+$/.test(r[index] as string),
      ).length,
      nativeNumberCount: rows.filter((r) => typeof r[index] === 'number').length,
      emptyCount: rows.filter((r) => String(r[index] ?? '').trim() === '').length,
    })),
    rows,
    sourceRowNumbers: rows.map((_, i) => i + 2),
    headerOffset: 0,
  }
}

function encode(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

const opts = (overrides: Partial<MatchOptions> = {}): MatchOptions => ({
  ...DEFAULT_MATCH_OPTIONS,
  ...overrides,
})

describe('normalizeKey', () => {
  it('coerces leading zeros so 00123 matches 123', () => {
    expect(normalizeKey('00123', opts())).toBe(normalizeKey(123, opts()))
  })

  it('keeps long digit strings exact instead of rounding through a float', () => {
    expect(normalizeKey('0009007199254740993', opts())).toBe('9007199254740993')
  })

  it('normalises trailing decimal zeros', () => {
    expect(normalizeKey('1.50', opts())).toBe(normalizeKey(1.5, opts()))
  })

  it('respects each option being switched off', () => {
    expect(normalizeKey(' a1 ', opts({ trim: false }))).toBe(' a1 ')
    expect(normalizeKey('A1', opts({ ignoreCase: false }))).toBe('A1')
    expect(normalizeKey('00123', opts({ coerceNumeric: false }))).toBe('00123')
  })

  it('treats whitespace-only keys as empty', () => {
    expect(normalizeKey('   ', opts())).toBe('')
  })
})

describe('mergeSheets', () => {
  const base = sheet(
    ['id', 'name'],
    [
      ['00123', 'Ada'],
      ['B-9', 'Grace'],
      ['', 'Blank'],
      ['zz', 'Missing'],
    ],
  )
  const lookup = sheet(
    ['ref', 'region'],
    [
      [123, 'EMEA'],
      ['b-9', 'APAC'],
      ['b-9', 'IGNORED'],
    ],
  )

  it('appends the pulled column and counts matches', () => {
    const result = mergeSheets({
      base,
      lookup,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts(),
    })

    expect(result.headers).toEqual(['id', 'name', 'region'])
    expect(result.rows.map((r) => r.pulled)).toEqual(['EMEA', 'APAC', null, null])
    expect(result.matchedCount).toBe(2)
    expect(result.unmatchedCount).toBe(2)
    expect(result.matchRate).toBeCloseTo(0.5)
  })

  it('takes the first match when the lookup has duplicate keys', () => {
    const result = mergeSheets({
      base,
      lookup,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts(),
    })
    expect(result.rows[1].pulled).toBe('APAC')

    const notice = result.notices.find((n) => n.code === 'DUP-KEYS')
    expect(notice?.headline).toContain('1 duplicate key')
    expect(notice?.detail).toContain('first match wins')
  })

  it('reports empty keys with their original row numbers', () => {
    const result = mergeSheets({
      base,
      lookup,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts(),
    })
    const notice = result.notices.find((n) => n.id === 'EMPTY-KEY-BASE')
    expect(notice?.detail).toContain('Row 4')
  })

  it('misses the numeric match when coercion is off, and says so', () => {
    const result = mergeSheets({
      base,
      lookup,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts({ coerceNumeric: false }),
    })
    expect(result.rows[0].matched).toBe(false)
    expect(result.notices.find((n) => n.code === 'NUM-AS-TEXT')?.detail).toContain('Turn it on')
  })

  it('does not overwrite a base column with the same name', () => {
    const clashing = sheet(
      ['id', 'region'],
      [
        ['1', 'old'],
        ['2', 'old'],
      ],
    )
    const result = mergeSheets({
      base: clashing,
      lookup,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts(),
    })
    expect(result.headers).toEqual(['id', 'region', 'region (2)'])
    expect(result.notices.some((n) => n.code === 'NAME-CLASH')).toBe(true)
  })

  it('handles a wide-ish file of 50k rows quickly', () => {
    const rows: CellValue[][] = Array.from({ length: 50_000 }, (_, i) => [String(i), `n${i}`])
    const big = sheet(['id', 'name'], rows)
    const started = performance.now()
    const result = mergeSheets({
      base: big,
      lookup: big,
      baseKeyIndex: 0,
      lookupKeyIndex: 0,
      pullIndex: 1,
      options: opts(),
    })
    expect(result.matchedCount).toBe(50_000)
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe('resolveColumnName', () => {
  it('increments until the name is free', () => {
    expect(resolveColumnName(['a', 'region', 'region (2)'], 'region')).toBe('region (3)')
  })
})

describe('parseCsv', () => {
  it('strips a UTF-8 BOM and still finds the header', () => {
    const file = parseCsv('x.csv', encode('\uFEFFid,name\n1,Ada\n'))
    expect(file.hadBom).toBe(true)
    expect(file.sheets['Sheet 1'].columns.map((c) => c.name)).toEqual(['id', 'name'])
  })

  it('guesses a semicolon delimiter', () => {
    const file = parseCsv('x.csv', encode('id;name\n1;Ada\n'))
    expect(file.delimiter).toBe(';')
    expect(file.sheets['Sheet 1'].rows[0]).toEqual(['1', 'Ada'])
  })

  it('skips blank and title rows before the header', () => {
    const file = parseCsv('x.csv', encode('\n\nQ3 export\nid,name\n1,Ada\n2,Grace\n'))
    const data = file.sheets['Sheet 1']
    expect(data.columns.map((c) => c.name)).toEqual(['id', 'name'])
    expect(data.rows).toHaveLength(2)
    // "1,Ada" is line 5 of the file.
    expect(data.sourceRowNumbers[0]).toBe(5)
  })

  it('survives a file that mixes \\n and \\r\\n line endings', () => {
    const file = parseCsv('x.csv', encode('Q3 export\n\nid,name\r\n1,Ada\r\n2,Grace\r\n'))
    const data = file.sheets['Sheet 1']
    expect(data.columns.map((c) => c.name)).toEqual(['id', 'name'])
    expect(data.rows).toEqual([
      ['1', 'Ada'],
      ['2', 'Grace'],
    ])
  })

  it('names blank header cells after their column letter', () => {
    const file = parseCsv('x.csv', encode('id,,name\n1,x,Ada\n'))
    expect(file.sheets['Sheet 1'].columns[1].name).toBe('Column B')
  })
})

describe('findHeaderRow', () => {
  it('falls back to the first row when every row is one column wide', () => {
    expect(findHeaderRow([['id'], ['1'], ['2']])).toBe(0)
  })
})
