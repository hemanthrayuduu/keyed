import type { Notice } from '../lib/types'

type NoticeListProps = {
  notices: Notice[]
  dismissed: string[]
  onDismiss: (id: string) => void
  onRestore: () => void
}

/** A diagnostic readout, not a toast: code chip, plain headline, specific rows. */
export function NoticeList({ notices, dismissed, onDismiss, onRestore }: NoticeListProps) {
  const visible = notices.filter((n) => !dismissed.includes(n.id))
  const hiddenCount = notices.length - visible.length

  if (notices.length === 0) {
    return (
      <p className="datum mb-4 border border-ink/10 bg-well px-3 py-2 text-2xs text-slate">
        NO ISSUES DETECTED
      </p>
    )
  }

  return (
    <div className="mb-4">
      <ul className="divide-y divide-ink/10 border border-ink/20">
        {visible.map((notice) => (
          <li key={notice.id} className="flex items-start gap-3 bg-well px-3 py-2.5">
            <span
              className={`datum mt-px shrink-0 border px-1.5 py-0.5 text-2xs font-bold tracking-wide ${
                notice.code === 'EMPTY-KEY'
                  ? 'border-oxide/40 bg-oxide-soft text-oxide'
                  : 'border-ink/25 bg-amber-soft text-ink'
              }`}
            >
              {notice.code}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{notice.headline}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate">{notice.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notice.id)}
              aria-label={`Dismiss notice: ${notice.headline}`}
              className="shrink-0 px-1 text-slate hover:text-ink"
            >
              <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5 fill-none stroke-current stroke-[1.5]">
                <path d="M1 1l8 8M9 1l-8 8" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={onRestore}
          className="datum mt-1.5 text-2xs uppercase tracking-[0.12em] text-slate underline decoration-ink/25 underline-offset-2 hover:text-ink"
        >
          {hiddenCount} dismissed — show again
        </button>
      ) : null}
    </div>
  )
}
