import type { ReactNode } from 'react'

type StepShellProps = {
  index: string
  title: string
  /** Shown at the right of the header rule — status, counts, controls. */
  aside?: ReactNode
  /** Locked steps stay on the page, unlit, so the whole instrument is visible. */
  locked?: boolean
  lockedHint?: string
  children: ReactNode
  id?: string
}

export function StepShell({
  index,
  title,
  aside,
  locked = false,
  lockedHint,
  children,
  id,
}: StepShellProps) {
  return (
    <section
      id={id}
      aria-label={`Step ${index}: ${title}`}
      className="relative pl-6 sm:pl-9"
      data-locked={locked || undefined}
    >
      {/* The rail: one continuous line running the height of the instrument. */}
      <span
        aria-hidden="true"
        className="absolute left-[7px] top-0 h-full w-px bg-ink/15 sm:left-[11px]"
      />
      <span
        aria-hidden="true"
        className={`absolute left-[3px] top-[7px] h-2 w-2 border sm:left-[7px] ${
          locked ? 'border-ink/25 bg-chassis' : 'border-ultramarine bg-ultramarine'
        }`}
      />

      <div
        className={
          locked ? 'pointer-events-none select-none opacity-40 transition-opacity duration-300' : ''
        }
        aria-disabled={locked || undefined}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/15 pb-2">
          <h2 className="flex items-baseline gap-3">
            <span className="datum text-2xs font-bold text-slate">{index}</span>
            <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-ink">
              {title}
            </span>
          </h2>
          {aside ? <div className="flex items-center gap-3 text-xs text-slate">{aside}</div> : null}
        </div>

        <div className={locked && lockedHint ? 'pt-2' : 'pt-4'}>
          {locked && lockedHint ? (
            <p className="text-sm text-slate">{lockedHint}</p>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  )
}
