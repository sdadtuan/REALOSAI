import type { RagReembedStart } from '@/lib/market-research-api';

export const RAG_REEMBED_BANNER =
  'Chỉ staging/UAT — re-embed corpus 64-d → OpenAI 256-d. Không tạo insight; PII skip server-side.';

export const RAG_REEMBED_RUNBOOK_PATH = 'docs/runbooks/market-research-rag-staging-backfill.md';

export const RAG_REEMBED_DEFAULT_LIMIT = 50;

export const RAG_REEMBED_MAX_LIMIT = 200;

export function mapRagReembedErrorCode(code: string | undefined): string {
  switch (code) {
    case 'rag_disabled':
      return 'RAG chưa bật trên staging.';
    case 'rag_reembed_disabled':
      return 'OpenAI embed chưa bật — xem runbook P39 (market-research-rag-staging-backfill).';
    case 'forbidden':
      return 'Thiếu quyền crm_research.configure.';
    case 'jobs_disabled':
      return 'Worker tắt — batch có thể không chạy async.';
    default:
      return code ? `Lỗi: ${code}` : 'Re-embed thất bại.';
  }
}

export function formatRagReembedResult(result: RagReembedStart): string {
  const parts = [`Trạng thái: ${result.status}`];
  if (result.processed != null) parts.push(`Đã xử lý: ${result.processed}`);
  if (result.skipped_pii != null) parts.push(`Bỏ qua PII: ${result.skipped_pii}`);
  if (result.failed != null && result.failed > 0) parts.push(`Lỗi: ${result.failed}`);
  if (result.remaining != null) parts.push(`Còn lại: ${result.remaining}`);
  if (result.note) parts.push(`Ghi chú: ${result.note}`);
  return parts.join(' · ');
}

export function clampRagReembedLimit(value: number): number {
  if (!Number.isFinite(value)) return RAG_REEMBED_DEFAULT_LIMIT;
  return Math.min(RAG_REEMBED_MAX_LIMIT, Math.max(1, Math.floor(value)));
}
