import { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnSelect } from './components/ColumnSelect'
import { DropZone, type SlotState } from './components/DropZone'
import { JoinBracket } from './components/JoinBracket'
import { MatchComb } from './components/MatchComb'
import { NoticeList } from './components/NoticeList'
import { PreviewTable } from './components/PreviewTable'
import { StepShell } from './components/StepShell'
import { downloadBuffer, outputFileName } from './lib/export'
import { fmtInt } from './lib/format'
import { mergeSheets } from './lib/merge'
import { buildExportInWorker, parseFileInWorker } from './lib/workerClient'
import {
  DEFAULT_MATCH_OPTIONS,
  type CellValue,
  type MatchOptions,
  type ParsedFile,
  type SheetData,
} from './lib/types'

type Role = 'base' | 'lookup'

const OPTION_LABELS: { key: keyof MatchOptions; label: string; hint: string }[] = [
  { key: 'trim', label: 'Trim whitespace', hint: '" 123 " = "123"' },
  { key: 'ignoreCase', label: 'Ignore case', hint: '"AB-1" = "ab-1"' },
  { key: 'coerceNumeric', label: 'Coerce numbers', hint: '"00123" = 123' },
]

function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '')
}

/**
 * Workbooks often open on a cover or notes tab. The sheet with the most rows is
 * a better guess at the data than the first one; the picker overrides it.
 */
function defaultSheet(file: ParsedFile): string {
  let best = file.sheetNames[0]
  let bestRows = -1
  for (const name of file.sheetNames) {
    const rows = file.sheets[name]?.rows.length ?? 0
    if (rows > bestRows) {
      best = name
      bestRows = rows
    }
  }
  return best
}

/** Guess the key pair so the common case needs no thinking: same header, both sides. */
function suggestKeyPair(base: SheetData, lookup: SheetData): [number, number] | null {
  const lookupByName = new Map<string, number>()
  lookup.columns.forEach((c) => {
    const key = normalizeHeader(c.name)
    if (!lookupByName.has(key)) lookupByName.set(key, c.index)
  })

  for (const column of base.columns) {
    const hit = lookupByName.get(normalizeHeader(column.name))
    if (hit !== undefined) return [column.index, hit]
  }
  return null
}

export default function App() {
  const [base, setBase] = useState<SlotState>({ status: 'empty' })
  const [lookup, setLookup] = useState<SlotState>({ status: 'empty' })
  const [baseKey, setBaseKey] = useState<number | null>(null)
  const [lookupKey, setLookupKey] = useState<number | null>(null)
  const [pullColumn, setPullColumn] = useState<number | null>(null)
  const [options, setOptions] = useState<MatchOptions>(DEFAULT_MATCH_OPTIONS)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const baseSheet = base.status === 'ready' ? base.file.sheets[base.sheetName] : null
  const lookupSheet = lookup.status === 'ready' ? lookup.file.sheets[lookup.sheetName] : null

  const setSlot = (role: Role, next: SlotState) => (role === 'base' ? setBase : setLookup)(next)

  const handleFile = useCallback(async (role: Role, file: File) => {
    setSlot(role, { status: 'parsing', fileName: file.name })
    if (role === 'base') setBaseKey(null)
    else {
      setLookupKey(null)
      setPullColumn(null)
    }

    try {
      const parsed = await parseFileInWorker(file)
      setSlot(role, { status: 'ready', file: parsed, sheetName: defaultSheet(parsed) })
    } catch (error) {
      const message =
        error instanceof Error
          ? `${file.name} could not be read: ${error.message}`
          : `${file.name} could not be read.`
      setSlot(role, { status: 'error', fileName: file.name, message })
    }
  }, [])

  // Suggest the key pair once both sheets are in, without overriding a choice.
  useEffect(() => {
    if (!baseSheet || !lookupSheet) return
    if (baseKey !== null || lookupKey !== null) return
    const pair = suggestKeyPair(baseSheet, lookupSheet)
    if (!pair) return
    setBaseKey(pair[0])
    setLookupKey(pair[1])
    setPullColumn((current) =>
      current ?? (lookupSheet.columns.find((c) => c.index !== pair[1])?.index ?? null),
    )
  }, [baseSheet, lookupSheet, baseKey, lookupKey])

  const ready =
    baseSheet !== null &&
    lookupSheet !== null &&
    baseKey !== null &&
    lookupKey !== null &&
    pullColumn !== null

  const result = useMemo(() => {
    if (!ready || !baseSheet || !lookupSheet) return null
    return mergeSheets({
      base: baseSheet,
      lookup: lookupSheet,
      baseKeyIndex: baseKey,
      lookupKeyIndex: lookupKey,
      pullIndex: pullColumn,
      options,
    })
  }, [ready, baseSheet, lookupSheet, baseKey, lookupKey, pullColumn, options])

  const download = async (kind: 'merged' | 'unmatched') => {
    if (!result || base.status !== 'ready' || !baseSheet) return
    setDownloading(kind)
    setDownloadError(null)
    try {
      const source = kind === 'merged' ? result.rows : result.rows.filter((row) => !row.matched)
      const headers = kind === 'merged' ? result.headers : result.headers.slice(0, -1)
      const rows: CellValue[][] =
        kind === 'merged'
          ? source.map((row) => [...row.cells, row.pulled])
          : source.map((row) => row.cells)

      const { data, mime } = await buildExportInWorker({
        headers,
        rows,
        format: base.file.format,
        delimiter: base.file.delimiter,
        withBom: base.file.hadBom,
        sheetName: kind === 'merged' ? 'Merged' : 'Unmatched',
      })
      downloadBuffer(data, mime, outputFileName(base.file.fileName, kind, base.file.format))
    } catch (error) {
      setDownloadError(
        error instanceof Error ? `Could not build the file: ${error.message}` : 'Could not build the file.',
      )
    } finally {
      setDownloading(null)
    }
  }

  const filesReady = baseSheet !== null && lookupSheet !== null
  const unmatchedCount = result?.unmatchedCount ?? 0

  // Parsing and merging both finish without moving focus, so say what happened.
  const announcement = (() => {
    const slots = [
      ['Base file', base] as const,
      ['Lookup file', lookup] as const,
    ]
    for (const [label, slot] of slots) {
      if (slot.status === 'error') return `${label} failed: ${slot.message}`
      if (slot.status === 'parsing') return `${label} is being read.`
    }
    if (result) {
      return `Merged. ${fmtInt(result.matchedCount)} of ${fmtInt(
        result.rows.length,
      )} rows matched, ${fmtInt(result.unmatchedCount)} unmatched.`
    }
    if (filesReady) return 'Both files are ready. Choose the columns to match on.'
    return ''
  })()

  return (
    <div className="mx-auto flex min-h-full max-w-[1080px] flex-col px-4 pb-16 pt-8 sm:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-2">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">
            keyed
            <span className="datum ml-2 text-2xs font-normal uppercase tracking-[0.18em] text-slate">
              column join
            </span>
          </h1>
          <p className="datum text-2xs uppercase tracking-[0.14em] text-slate">
            parsed in this tab · nothing uploaded
          </p>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate">
          Pull a column from one spreadsheet into another by matching a shared key. Your files stay
          on this device.
        </p>
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <main className="flex flex-col gap-8">
        <StepShell
          index="01"
          title="Sources"
          aside={
            filesReady ? (
              <span className="datum text-2xs">
                {fmtInt(baseSheet.rows.length)} base rows · {fmtInt(lookupSheet.rows.length)} lookup
                rows
              </span>
            ) : null
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DropZone
              role="base"
              title="Base file"
              hint="The file that gets the new column."
              state={base}
              onFile={(file) => void handleFile('base', file)}
              onSheetChange={(sheetName) => {
                setBase((s) => (s.status === 'ready' ? { ...s, sheetName } : s))
                setBaseKey(null)
              }}
              onClear={() => {
                setBase({ status: 'empty' })
                setBaseKey(null)
              }}
            />
            <DropZone
              role="lookup"
              title="Lookup file"
              hint="The file the values come from."
              state={lookup}
              onFile={(file) => void handleFile('lookup', file)}
              onSheetChange={(sheetName) => {
                setLookup((s) => (s.status === 'ready' ? { ...s, sheetName } : s))
                setLookupKey(null)
                setPullColumn(null)
              }}
              onClear={() => {
                setLookup({ status: 'empty' })
                setLookupKey(null)
                setPullColumn(null)
              }}
            />
          </div>
          {/* Arms land on the centre of each panel, so the tie reads as a join. */}
          <div className="hidden w-full sm:block">
            <JoinBracket active={ready} />
          </div>
        </StepShell>

        <StepShell
          index="02"
          title="Keys"
          locked={!filesReady}
          lockedHint="Waiting for both files."
          aside={
            filesReady ? (
              <span className="text-2xs uppercase tracking-[0.12em]">
                {ready ? 'joined' : 'choose three columns'}
              </span>
            ) : null
          }
        >
          {baseSheet && lookupSheet ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ColumnSelect
                  label="Match on — base file"
                  origin="base"
                  columns={baseSheet.columns}
                  value={baseKey}
                  onChange={setBaseKey}
                />
                <ColumnSelect
                  label="Match on — lookup file"
                  origin="lookup"
                  columns={lookupSheet.columns}
                  value={lookupKey}
                  onChange={setLookupKey}
                />
                <ColumnSelect
                  label="Pull this column across"
                  origin="lookup"
                  columns={lookupSheet.columns}
                  value={pullColumn}
                  onChange={setPullColumn}
                  deemphasize={lookupKey === null ? [] : [lookupKey]}
                />
              </div>

              <fieldset className="mt-5">
                <legend className="label-chrome mb-2">How keys are compared</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  {OPTION_LABELS.map(({ key, label, hint }) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={(event) =>
                          setOptions((current) => ({ ...current, [key]: event.target.checked }))
                        }
                        className="h-3.5 w-3.5 shrink-0 accent-ultramarine"
                      />
                      <span className="text-sm text-ink">{label}</span>
                      <span className="datum text-2xs text-slate-light">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}
        </StepShell>

        <StepShell
          index="03"
          title="Preview"
          locked={!result}
          lockedHint="Waiting for the three columns above."
          aside={
            result ? (
              <span className="datum text-2xs">
                first {Math.min(10, result.rows.length)} rows · live
              </span>
            ) : null
          }
        >
          {result ? (
            <>
              <NoticeList
                notices={result.notices}
                dismissed={dismissed}
                onDismiss={(id) => setDismissed((d) => [...d, id])}
                onRestore={() => setDismissed([])}
              />
              <PreviewTable result={result} />
            </>
          ) : null}
        </StepShell>

        <StepShell
          index="04"
          title="Result"
          locked={!result}
          lockedHint="The match rate appears here once the columns are chosen."
        >
          {result && base.status === 'ready' ? (
            <>
              <MatchComb
                rows={result.rows}
                matchRate={result.matchRate}
                matchedCount={result.matchedCount}
                unmatchedCount={result.unmatchedCount}
              />

              <div className="mt-6 flex flex-col gap-3 border-t border-ink/15 pt-5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={downloading !== null}
                  onClick={() => void download('merged')}
                >
                  {downloading === 'merged' ? 'Building…' : 'Download merged file'}
                  <span className="datum text-2xs opacity-70">
                    .{base.file.format === 'csv' ? 'csv' : 'xlsx'}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={downloading !== null || unmatchedCount === 0}
                  onClick={() => void download('unmatched')}
                >
                  {downloading === 'unmatched'
                    ? 'Building…'
                    : `Download unmatched rows (${fmtInt(unmatchedCount)})`}
                </button>
                <p className="datum text-2xs text-slate">
                  {outputFileName(base.file.fileName, 'merged', base.file.format)}
                </p>
              </div>

              {downloadError ? (
                <p className="mt-3 text-xs text-oxide" role="alert">
                  {downloadError}
                </p>
              ) : null}
            </>
          ) : null}
        </StepShell>
      </main>

      <footer className="mt-12 border-t border-ink/15 pt-3">
        <p className="datum text-2xs text-slate-light">
          no network calls · no accounts · no analytics · first match wins on duplicate keys
        </p>
      </footer>
    </div>
  )
}
