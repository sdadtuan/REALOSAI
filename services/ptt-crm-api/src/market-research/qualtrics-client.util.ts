import { inflateRawSync } from 'node:zlib';

export const QUALTRICS_EXPORT_POLL_MS = 3_000;
export const QUALTRICS_EXPORT_TIMEOUT_MS = 120_000;

export type QualtricsTransport = (input: {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  binary?: boolean;
}) => Promise<{ status: number; json: () => Promise<unknown>; arrayBuffer?: () => Promise<ArrayBuffer> }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function decodeQualtricsExportBytes(buf: ArrayBuffer): string {
  const data = Buffer.from(buf);
  if (data.length >= 2 && data[0] === 0x50 && data[1] === 0x4b) {
    return extractFirstCsvFromZip(data);
  }
  return data.toString('utf8');
}

function extractFirstCsvFromZip(data: Buffer): string {
  let offset = 0;
  while (offset + 30 <= data.length) {
    if (data.readUInt32LE(offset) !== 0x04034b50) break;
    const compMethod = data.readUInt16LE(offset + 8);
    const compSize = data.readUInt32LE(offset + 18);
    const fnLen = data.readUInt16LE(offset + 26);
    const extraLen = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + fnLen).toString('utf8');
    const dataStart = offset + 30 + fnLen + extraLen;
    const compressed = data.subarray(dataStart, dataStart + compSize);
    let raw: Buffer;
    if (compMethod === 0) raw = compressed;
    else if (compMethod === 8) raw = inflateRawSync(compressed);
    else throw new Error('qualtrics_zip_unsupported');
    if (name.toLowerCase().endsWith('.csv')) return raw.toString('utf8');
    offset = dataStart + compSize;
  }
  throw new Error('qualtrics_zip_no_csv');
}

export async function fetchQualtricsExportCsv(
  input: {
    surveyId: string;
    apiKey: string;
    datacenter: string;
    pollMs?: number;
    timeoutMs?: number;
  },
  transport: QualtricsTransport = defaultQualtricsTransport,
): Promise<{ csvText: string; progress_id: string; file_id: string }> {
  const base = `https://${input.datacenter}.qualtrics.com/API/v3/surveys/${encodeURIComponent(input.surveyId)}`;
  const tokenHeader = { 'X-API-TOKEN': input.apiKey, 'Content-Type': 'application/json' };
  const started = await transport({
    method: 'POST',
    url: `${base}/export-responses`,
    headers: tokenHeader,
    body: { format: 'csv' },
  });
  if (started.status < 200 || started.status >= 300) {
    throw new Error(`qualtrics_export_start_${started.status}`);
  }
  const startBody = (await started.json()) as Record<string, unknown>;
  const progressId = String((startBody.result as Record<string, unknown> | undefined)?.progressId ?? '').trim();
  if (!progressId) throw new Error('qualtrics_missing_progress_id');

  const deadline = Date.now() + (input.timeoutMs ?? QUALTRICS_EXPORT_TIMEOUT_MS);
  let fileId = '';
  while (Date.now() < deadline) {
    const prog = await transport({
      method: 'GET',
      url: `${base}/export-responses/${encodeURIComponent(progressId)}`,
      headers: { 'X-API-TOKEN': input.apiKey },
    });
    if (prog.status < 200 || prog.status >= 300) {
      throw new Error(`qualtrics_export_poll_${prog.status}`);
    }
    const body = (await prog.json()) as Record<string, unknown>;
    const result = (body.result ?? {}) as Record<string, unknown>;
    if (result.status === 'complete') {
      fileId = String(result.fileId ?? '').trim();
      break;
    }
    if (result.status === 'failed') throw new Error('qualtrics_export_failed');
    await sleep(input.pollMs ?? QUALTRICS_EXPORT_POLL_MS);
  }
  if (!fileId) throw new Error('qualtrics_export_timeout');

  const file = await transport({
    method: 'GET',
    url: `${base}/export-responses/${encodeURIComponent(fileId)}/file`,
    headers: { 'X-API-TOKEN': input.apiKey },
    binary: true,
  });
  if (file.status < 200 || file.status >= 300 || !file.arrayBuffer) {
    throw new Error(`qualtrics_export_download_${file.status}`);
  }
  const csvText = decodeQualtricsExportBytes(await file.arrayBuffer());
  return { csvText, progress_id: progressId, file_id: fileId };
}

async function defaultQualtricsTransport(
  input: Parameters<QualtricsTransport>[0],
): ReturnType<QualtricsTransport> {
  const res = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  return {
    status: res.status,
    json: () => res.json(),
    arrayBuffer: input.binary ? () => res.arrayBuffer() : undefined,
  };
}
