import { createHash } from 'crypto';

export const MKT_AI_RAG_ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const MKT_AI_RAG_MAX_BYTES = 10 * 1024 * 1024;

export interface MktAiTextChunk {
  chunk_index: number;
  page_no: number | null;
  title: string;
  body: string;
  token_count: number;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function normalizeMime(mime: string, filename: string): string {
  const m = String(mime ?? '').trim().toLowerCase();
  if (m && MKT_AI_RAG_ALLOWED_MIMES.has(m)) return m;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  return m || 'application/octet-stream';
}

export function extractDocumentText(buffer: Buffer, mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime === 'text/plain' || mime === 'text/markdown') {
    return buffer.toString('utf8').replace(/\u0000/g, '').trim();
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxText(buffer);
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractPptxText(buffer);
  }
  if (mime === 'application/pdf') {
    return extractPdfText(buffer);
  }
  throw new Error(`unsupported_mime:${mimeType}`);
}

function extractPptxText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const parts: string[] = [];
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const text = match[1].trim();
    if (text) parts.push(text);
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) throw new Error('pptx_text_empty');
  return joined;
}

function extractDocxText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    if (text.trim()) parts.push(text);
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) throw new Error('docx_text_empty');
  return joined;
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const parts: string[] = [];
  const literalRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = literalRe.exec(raw)) !== null) {
    const text = match[1]
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .trim();
    if (text.length >= 2) parts.push(text);
  }
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) throw new Error('pdf_text_empty');
  return joined;
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function chunkDocumentText(
  text: string,
  opts?: { chunkSize?: number; overlap?: number; title?: string },
): MktAiTextChunk[] {
  const chunkSize = opts?.chunkSize ?? 900;
  const overlap = opts?.overlap ?? 120;
  const title = opts?.title ?? '';
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units = paragraphs.length ? paragraphs : [normalized];
  const chunks: MktAiTextChunk[] = [];
  let buffer = '';
  let chunkIndex = 0;

  const flush = () => {
    const body = buffer.trim();
    if (body.length < 40) return;
    const pageNo = Math.floor(chunkIndex / 3) + 1;
    chunks.push({
      chunk_index: chunkIndex,
      page_no: pageNo,
      title: title || `Chunk ${chunkIndex + 1}`,
      body,
      token_count: estimateTokenCount(body),
    });
    chunkIndex += 1;
    buffer = body.slice(Math.max(0, body.length - overlap));
  };

  for (const unit of units) {
    if ((buffer + ' ' + unit).trim().length <= chunkSize) {
      buffer = `${buffer} ${unit}`.trim();
      continue;
    }
    if (buffer.trim()) flush();
    if (unit.length <= chunkSize) {
      buffer = unit;
      continue;
    }
    for (let i = 0; i < unit.length; i += chunkSize - overlap) {
      const slice = unit.slice(i, i + chunkSize).trim();
      if (slice.length < 40) continue;
      const pageNo = Math.floor(chunkIndex / 3) + 1;
      chunks.push({
        chunk_index: chunkIndex,
        page_no: pageNo,
        title: title || `Chunk ${chunkIndex + 1}`,
        body: slice,
        token_count: estimateTokenCount(slice),
      });
      chunkIndex += 1;
    }
    buffer = '';
  }
  if (buffer.trim()) flush();
  return chunks;
}

export function buildRagSearchQuery(brief: {
  brand_name?: string;
  industry?: string;
  challenges?: string;
  usp?: string;
  objective?: string;
}): string {
  return [
    brief.brand_name,
    brief.industry,
    brief.challenges,
    brief.usp,
    brief.objective,
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}
