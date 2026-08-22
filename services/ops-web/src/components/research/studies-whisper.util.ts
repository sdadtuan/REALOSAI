export const WHISPER_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
] as const;

export const WHISPER_PRIVACY_BANNER =
  'Chỉ lưu đoạn trích ≤ 500 ký tự + mốc thời gian. Không lưu bản ghi / transcript đầy đủ.';

export const UPLOAD_DISABLED_TITLE = 'Cần consent còn hạn và quyền chạy job';

export function isWhisperAudioMime(mime: string | null | undefined): boolean {
  return (WHISPER_AUDIO_MIMES as readonly string[]).includes(String(mime ?? '').trim().toLowerCase());
}

export function studyHasUnexpiredConsent(
  consents: Array<{ expires_at: string | null }>,
  now: Date = new Date(),
): boolean {
  return consents.some((row) => {
    if (row.expires_at == null || String(row.expires_at).trim() === '') return true;
    const exp = new Date(row.expires_at).getTime();
    return Number.isFinite(exp) && exp > now.getTime();
  });
}
