export const PORTAL_RAG_BANNER =
  'Chỉ insight đã published cùng khách. Không tìm draft. Không tạo insight.';

export function shouldShowPortalRagSearch(
  portalFeEnabled: boolean,
  ragEnabled: boolean,
): boolean {
  return portalFeEnabled === true && ragEnabled === true;
}
