export const RAG_COPILOT_BANNER =
  'Copilot có thể tham chiếu insight đã duyệt cùng khách. Bản nháp — không tự duyệt, không tự công bố.';

export function shouldShowRagCopilotBanner(ragEnabled: boolean, canRun: boolean): boolean {
  return ragEnabled === true && canRun === true;
}
