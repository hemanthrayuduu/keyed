/// <reference lib="webworker" />
import { buildExport, type ExportRequest } from '../lib/export'
import { parseFile } from '../lib/parse'
import type { ParsedFile } from '../lib/types'

export type WorkerRequest =
  | { id: number; kind: 'parse'; fileName: string; buffer: ArrayBuffer }
  | ({ id: number; kind: 'export' } & ExportRequest)

export type WorkerResponse =
  | { id: number; kind: 'parse'; ok: true; file: ParsedFile }
  | { id: number; kind: 'export'; ok: true; data: ArrayBuffer; mime: string }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    if (request.kind === 'parse') {
      const file = parseFile(request.fileName, request.buffer)
      const response: WorkerResponse = { id: request.id, kind: 'parse', ok: true, file }
      self.postMessage(response)
      return
    }

    const { data, mime } = buildExport(request)
    const response: WorkerResponse = { id: request.id, kind: 'export', ok: true, data, mime }
    self.postMessage(response, [data])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ id: request.id, ok: false, error: message } satisfies WorkerResponse)
  }
}
