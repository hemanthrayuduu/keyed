import { cellToString } from '../lib/normalize'
import type { MergeResult } from '../lib/types'

type PreviewTableProps = {
  result: MergeResult
  rowLimit?: number
}

export function PreviewTable({ result, rowLimit = 10 }: PreviewTableProps) {
  const rows = result.rows.slice(0, rowLimit)
  const baseColumnCount = result.headers.length - 1

  return (
    <div className="border border-ink/20">
      <div className="max-h-[380px] overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="datum sticky left-0 z-20 border-b border-r border-ink/15 bg-well px-2 py-2 text-2xs font-medium text-slate-light"
              >
                row
              </th>
              {result.headers.map((header, i) => {
                const isPulled = i === baseColumnCount
                return (
                  <th
                    key={`${header}-${i}`}
                    scope="col"
                    className={`datum whitespace-nowrap border-b px-3 py-2 text-2xs font-bold ${
                      isPulled
                        ? 'border-b-amber border-l border-l-amber bg-amber-soft text-ink'
                        : 'border-ink/15 bg-well text-slate'
                    }`}
                  >
                    {isPulled ? (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-amber" />
                        {header}
                      </span>
                    ) : (
                      header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sourceRowNumber} className="even:bg-well/60">
                <th
                  scope="row"
                  className="datum sticky left-0 z-10 border-r border-ink/10 bg-panel px-2 py-1.5 text-2xs font-normal text-slate-light"
                >
                  {row.sourceRowNumber}
                </th>
                {Array.from({ length: baseColumnCount }, (_, c) => (
                  <td
                    key={c}
                    className="datum max-w-[220px] truncate whitespace-nowrap border-b border-ink/5 px-3 py-1.5 text-xs text-ink"
                    title={cellToString(row.cells[c] ?? null)}
                  >
                    {cellToString(row.cells[c] ?? null)}
                  </td>
                ))}
                <td
                  className={`datum max-w-[220px] truncate whitespace-nowrap border-b border-l border-l-amber border-b-ink/5 px-3 py-1.5 text-xs ${
                    row.matched ? 'bg-amber-soft text-ink' : 'bg-amber-soft/40 text-oxide'
                  }`}
                  title={row.matched ? cellToString(row.pulled) : 'no match in the lookup file'}
                >
                  {row.matched ? cellToString(row.pulled) : '— no match'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="datum border-t border-ink/15 bg-well px-2 py-1.5 text-2xs text-slate">
        showing {rows.length} of {result.rows.length.toLocaleString()} rows · row numbers are from
        the base file
      </p>
    </div>
  )
}
