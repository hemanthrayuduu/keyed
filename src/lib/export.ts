import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { CellValue, FileFormat } from './types'

export type ExportRequest = {
  headers: string[]
  rows: CellValue[][]
  format: FileFormat
  /** Preserved from the source file so a semicolon CSV round-trips. */
  delimiter?: string
  /** Preserved so Excel keeps reading the file as UTF-8. */
  withBom?: boolean
  sheetName?: string
}

export function buildExport(request: ExportRequest): { data: ArrayBuffer; mime: string } {
  if (request.format === 'csv') {
    const csv = Papa.unparse(
      { fields: request.headers, data: request.rows as unknown[][] },
      { delimiter: request.delimiter && request.delimiter !== '' ? request.delimiter : ',' },
    )
    const text = request.withBom ? `\uFEFF${csv}` : csv
    const bytes = new TextEncoder().encode(text)
    // Copy into a standalone ArrayBuffer so it can be transferred from a worker.
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    return { data: buffer, mime: 'text/csv;charset=utf-8' }
  }

  const worksheet = XLSX.utils.aoa_to_sheet([request.headers, ...request.rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, (request.sheetName ?? 'Merged').slice(0, 31))
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return {
    data: out,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}

/** "crm_export.csv" + "merged" -> "crm_export.merged.csv" */
export function outputFileName(sourceName: string, suffix: string, format: FileFormat): string {
  const stem = sourceName.replace(/\.[^.]+$/, '') || 'sheet'
  return `${stem}.${suffix}.${format === 'csv' ? 'csv' : 'xlsx'}`
}

export function downloadBuffer(data: ArrayBuffer, mime: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
