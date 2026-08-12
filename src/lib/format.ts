export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

/** Match rate, kept to one decimal unless it is a clean 100% or 0%. */
export function fmtPct(rate: number): string {
  const pct = rate * 100
  if (pct === 100 || pct === 0) return `${pct.toFixed(0)}%`
  return `${pct.toFixed(1)}%`
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function delimiterLabel(delimiter?: string): string | null {
  if (!delimiter) return null
  if (delimiter === ',') return null
  if (delimiter === ';') return 'semicolon-delimited'
  if (delimiter === '\t') return 'tab-delimited'
  if (delimiter === '|') return 'pipe-delimited'
  return `"${delimiter}"-delimited`
}
