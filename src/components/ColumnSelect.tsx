import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ColumnProfile } from '../lib/types'

type ColumnSelectProps = {
  label: string
  /** Which file this column comes from — drives the accent colour. */
  origin: 'base' | 'lookup'
  columns: ColumnProfile[]
  value: number | null
  onChange: (index: number) => void
  disabled?: boolean
  /** Columns to grey out (already used as the key, for example). */
  deemphasize?: number[]
}

const SEARCH_THRESHOLD = 8

export function ColumnSelect({
  label,
  origin,
  columns,
  value,
  onChange,
  disabled = false,
  deemphasize = [],
}: ColumnSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const searchable = columns.length > SEARCH_THRESHOLD
  const selected = value === null ? null : (columns[value] ?? null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return columns
    return columns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.samples.some((s) => s.toLowerCase().includes(q)),
    )
  }, [columns, query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const current = filtered.findIndex((c) => c.index === value)
    setActive(current >= 0 ? current : 0)
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus())
    // Only re-run when the popup opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const commit = (position: number) => {
    const column = filtered[position]
    if (!column) return
    onChange(column.index)
    close()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(filtered.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        commit(active)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        close(false)
        break
      default:
        break
    }
  }

  const accent = origin === 'base' ? 'border-l-ultramarine' : 'border-l-amber'

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <span className="label-chrome mb-1.5 block">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 border border-ink/25 border-l-2 ${accent}
          bg-panel px-3 py-2.5 text-left transition-colors hover:enabled:bg-well
          disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'bg-well' : ''}`}
      >
        <span className="min-w-0">
          {selected ? (
            <>
              <span className="datum block truncate text-sm font-medium text-ink">
                {selected.name}
              </span>
              <span className="datum block truncate text-2xs text-slate-light">
                {selected.samples.length > 0 ? selected.samples.join('  ·  ') : 'no values'}
              </span>
            </>
          ) : (
            <span className="block text-sm text-slate">Choose a column</span>
          )}
        </span>
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 shrink-0 fill-slate">
          <path d="M0 0h10L5 6z" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-30 border border-ink/30 bg-panel">
          {searchable ? (
            <div className="border-b border-ink/15 p-1.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                placeholder={`Filter ${columns.length} columns`}
                aria-label={`Filter ${columns.length} columns`}
                className="datum w-full border border-ink/15 bg-well px-2 py-1.5 text-xs
                  placeholder:font-sans placeholder:text-slate-light"
              />
            </div>
          ) : null}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].index}` : undefined}
            tabIndex={-1}
            className="max-h-72 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-slate">
                No column matches “{query}”.
              </li>
            ) : (
              filtered.map((column, position) => {
                const isSelected = column.index === value
                const isActive = position === active
                const dim = deemphasize.includes(column.index)
                return (
                  <li key={column.index}>
                    <div
                      id={`${listId}-${column.index}`}
                      role="option"
                      aria-selected={isSelected}
                      data-active={isActive || undefined}
                      onMouseEnter={() => setActive(position)}
                      onClick={() => commit(position)}
                      className={`cursor-pointer border-l-2 px-3 py-2 ${
                        isActive ? 'border-l-ultramarine bg-ultramarine-soft' : 'border-l-transparent'
                      } ${dim ? 'opacity-55' : ''}`}
                    >
                      <span className="datum flex items-baseline justify-between gap-2 text-xs font-medium text-ink">
                        <span className="truncate">{column.name}</span>
                        {isSelected ? (
                          <span aria-hidden="true" className="text-ultramarine">
                            ●
                          </span>
                        ) : null}
                      </span>
                      <span className="datum mt-0.5 block truncate text-2xs text-slate-light">
                        {column.samples.length > 0
                          ? column.samples.join('  ·  ')
                          : `all ${column.emptyCount} values empty`}
                      </span>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
