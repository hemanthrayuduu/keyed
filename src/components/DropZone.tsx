import { useRef, useState } from 'react'
import { delimiterLabel, fmtInt } from '../lib/format'
import type { ParsedFile } from '../lib/types'

export type SlotState =
  | { status: 'empty' }
  | { status: 'parsing'; fileName: string }
  | { status: 'error'; fileName: string; message: string }
  | { status: 'ready'; file: ParsedFile; sheetName: string }

type DropZoneProps = {
  role: 'base' | 'lookup'
  title: string
  hint: string
  state: SlotState
  onFile: (file: File) => void
  onSheetChange: (sheetName: string) => void
  onClear: () => void
}

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm'

export function DropZone({
  role,
  title,
  hint,
  state,
  onFile,
  onSheetChange,
  onClear,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Written out in full: Tailwind cannot see class names built by interpolation.
  const accentText = role === 'base' ? 'text-ultramarine' : 'text-[#9A6D04]'
  const accentBorder = role === 'base' ? 'border-t-ultramarine' : 'border-t-amber'

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  const openPicker = () => inputRef.current?.click()

  const sheet = state.status === 'ready' ? state.file.sheets[state.sheetName] : null
  const delimiterNote = state.status === 'ready' ? delimiterLabel(state.file.delimiter) : null

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={handleDrop}
      className={`relative flex min-h-[132px] flex-col border border-t-2 ${accentBorder} ${
        dragging ? 'border-ink/60 bg-ultramarine-soft' : 'border-ink/20 bg-panel'
      } transition-colors duration-150`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={`${title} — choose a spreadsheet`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />

      <div className="flex items-center justify-between border-b border-ink/10 px-3 py-2">
        <span className={`label-chrome ${accentText}`}>{title}</span>
        {state.status === 'ready' ? (
          <button
            type="button"
            onClick={onClear}
            className="text-2xs uppercase tracking-[0.12em] text-slate underline decoration-ink/25 underline-offset-2 hover:text-ink"
          >
            Replace
          </button>
        ) : null}
      </div>

      {state.status === 'empty' ? (
        <button
          type="button"
          onClick={openPicker}
          className="flex flex-1 flex-col items-start justify-center gap-1.5 px-4 py-6 text-left hover:bg-well"
        >
          <span className="text-sm font-medium text-ink">Drop a file, or browse</span>
          <span className="text-xs text-slate">{hint}</span>
          <span className="datum mt-1 text-2xs text-slate-light">csv · tsv · xlsx · xls</span>
        </button>
      ) : null}

      {state.status === 'parsing' ? (
        <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-6" aria-live="polite">
          <span className="datum truncate text-sm text-ink">{state.fileName}</span>
          <span className="text-xs text-slate">Reading in the background…</span>
          <span aria-hidden="true" className="relative mt-1 h-px w-full overflow-hidden bg-ink/15">
            <span className="absolute inset-y-0 left-0 w-1/3 animate-[scan_1.1s_ease-in-out_infinite] bg-ultramarine" />
          </span>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="flex flex-1 flex-col justify-center gap-2 px-4 py-6">
          <span className="datum truncate text-sm text-ink">{state.fileName}</span>
          <p className="text-xs text-oxide">{state.message}</p>
          <button
            type="button"
            onClick={openPicker}
            className="self-start text-2xs uppercase tracking-[0.12em] text-ink underline decoration-ink/30 underline-offset-2"
          >
            Try another file
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && sheet ? (
        <div className="flex flex-1 flex-col justify-start gap-3 px-3 py-3">
          <div>
            <p className="datum break-all text-sm font-medium text-ink">{state.file.fileName}</p>
            <p className="datum mt-1 text-xs text-slate">
              {fmtInt(sheet.rows.length)} rows · {fmtInt(sheet.columns.length)} cols
            </p>
            {delimiterNote || state.file.hadBom || sheet.headerOffset > 0 ? (
              <p className="mt-1 text-2xs text-slate-light">
                {[
                  delimiterNote,
                  state.file.hadBom ? 'UTF-8 BOM' : null,
                  sheet.headerOffset > 0
                    ? `header found on row ${sheet.headerOffset + 1}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          {state.file.sheetNames.length > 1 ? (
            <label className="block">
              <span className="label-chrome mb-1 block">Sheet</span>
              <select
                value={state.sheetName}
                onChange={(event) => onSheetChange(event.target.value)}
                className="datum w-full border border-ink/25 bg-well px-2 py-1.5 text-xs"
              >
                {state.file.sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name} ({fmtInt(state.file.sheets[name]?.rows.length ?? 0)} rows)
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
