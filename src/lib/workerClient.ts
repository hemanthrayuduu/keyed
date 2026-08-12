import type { ExportRequest } from './export'
import type { ParsedFile } from './types'
import type { WorkerRequest, WorkerResponse } from '../workers/sheet.worker'

type Pending = {
  resolve: (value: never) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/sheet.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data
    const entry = pending.get(response.id)
    if (!entry) return
    pending.delete(response.id)
    if (response.ok) entry.resolve(response as never)
    else entry.reject(new Error(response.error))
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'The file worker stopped unexpectedly.')
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
  }
  return worker
}

function send<T>(request: WorkerRequest, transfer: Transferable[]): Promise<T> {
  const instance = getWorker()
  return new Promise<T>((resolve, reject) => {
    pending.set(request.id, { resolve: resolve as (value: never) => void, reject })
    instance.postMessage(request, transfer)
  })
}

export function parseFileInWorker(file: File): Promise<ParsedFile> {
  return file.arrayBuffer().then((buffer) =>
    send<{ file: ParsedFile }>(
      { id: nextId++, kind: 'parse', fileName: file.name, buffer },
      [buffer],
    ).then((response) => response.file),
  )
}

export function buildExportInWorker(
  request: ExportRequest,
): Promise<{ data: ArrayBuffer; mime: string }> {
  return send<{ data: ArrayBuffer; mime: string }>({ id: nextId++, kind: 'export', ...request }, [])
}
