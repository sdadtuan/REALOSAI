export const RAG_SEARCH_BANNER =
  'Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight.';

export function shouldShowRagSearch(ragEnabled: boolean, canView: boolean): boolean {
  return ragEnabled === true && canView === true;
}
