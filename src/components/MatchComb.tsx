import { useMemo, useState } from 'react'
import { fmtInt, fmtPct } from '../lib/format'
import type { MergeRow } from '../lib/types'

type MatchCombProps = {
  rows: MergeRow[]
  matchRate: number
  matchedCount: number
  unmatchedCount: number
}

const SLOT_TARGET = 160

type Slot = {
  from: number
  to: number
  total: number
  matched: number
}

/**
 * The signature. Every base row, in file order, drawn as a tooth: amber where
 * the key found a match, oxide where it did not. The amber area *is* the match
 * rate, so the number and the picture cannot disagree — and unlike a progress
 * bar it shows where the misses sit, which is usually the whole story (a solid
 * oxide block at the tail means the export appended junk rows).
 */
export function MatchComb({ rows, matchRate, matchedCount, unmatchedCount }: MatchCombProps) {
  const [active, setActive] = useState<number | null>(null)

  const slots = useMemo<Slot[]>(() => {
    if (rows.length === 0) return []
    const bucket = Math.max(1, Math.ceil(rows.length / SLOT_TARGET))
    const out: Slot[] = []
    for (let start = 0; start < rows.length; start += bucket) {
      const end = Math.min(start + bucket, rows.length)
      let matched = 0
      for (let i = start; i < end; i += 1) if (rows[i].matched) matched += 1
      out.push({
        from: rows[start].sourceRowNumber,
        to: rows[end - 1].sourceRowNumber,
        total: end - start,
        matched,
      })
    }
    return out
  }, [rows])

  const readout = (() => {
    if (active === null || !slots[active]) {
      return slots.length > 0 && slots[0].total > 1
        ? `each tooth is ${fmtInt(slots[0].total)} rows in file order`
        : 'one tooth per row, in file order'
    }
    const slot = slots[active]
    const missed = slot.total - slot.matched
    const range = slot.from === slot.to ? `row ${fmtInt(slot.from)}` : `rows ${fmtInt(slot.from)}–${fmtInt(slot.to)}`
    return missed === 0
      ? `${range} · all ${fmtInt(slot.total)} matched`
      : `${range} · ${fmtInt(missed)} of ${fmtInt(slot.total)} unmatched`
  })()

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (slots.length === 0) return
    const move = (next: number) => {
      event.preventDefault()
      setActive(Math.max(0, Math.min(next, slots.length - 1)))
    }
    if (event.key === 'ArrowRight') move((active ?? -1) + 1)
    else if (event.key === 'ArrowLeft') move((active ?? slots.length) - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(slots.length - 1)
    else if (event.key === 'Escape') setActive(null)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
      <div className="shrink-0">
        <span className="label-chrome block">Match rate</span>
        <span className="datum block font-display text-6xl font-bold leading-none tracking-tight text-ink sm:text-7xl">
          {fmtPct(matchRate)}
        </span>
        <span className="datum mt-2 block text-xs text-slate">
          <span className="text-ink">{fmtInt(matchedCount)}</span> matched
          {' · '}
          <span className={unmatchedCount > 0 ? 'text-oxide' : 'text-ink'}>
            {fmtInt(unmatchedCount)}
          </span>{' '}
          unmatched
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div
          role="group"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setActive(null)}
          aria-label={`Match comb: ${fmtPct(matchRate)} of ${fmtInt(
            rows.length,
          )} base rows matched. Use the arrow keys to read each section.`}
          className="flex h-20 w-full items-stretch gap-px border-b border-ink/30 bg-well px-px pt-px"
        >
          {slots.map((slot, i) => {
            const ratio = slot.matched / slot.total
            const isActive = i === active
            return (
              <div
                key={i}
                onMouseEnter={() => setActive(i)}
                className={`relative flex min-w-0 flex-1 flex-col justify-end ${
                  isActive ? 'outline outline-1 outline-ink' : ''
                }`}
              >
                {ratio < 1 ? (
                  <span
                    aria-hidden="true"
                    className="w-full bg-oxide"
                    style={{ height: `${(1 - ratio) * 100}%` }}
                  />
                ) : null}
                {ratio > 0 ? (
                  <span
                    aria-hidden="true"
                    className="w-full bg-amber"
                    style={{ height: `${ratio * 100}%` }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="datum mt-1.5 flex items-baseline justify-between gap-4 text-2xs text-slate">
          <span aria-live="polite" className="truncate">
            {readout}
          </span>
          <span className="shrink-0 text-slate-light">
            row {fmtInt(rows[0]?.sourceRowNumber ?? 0)} → {fmtInt(rows[rows.length - 1]?.sourceRowNumber ?? 0)}
          </span>
        </p>
      </div>
    </div>
  )
}
