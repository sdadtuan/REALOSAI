import { describe, expect, it } from 'vitest';
import {
  UPLOAD_DISABLED_TITLE,
  WHISPER_AUDIO_MIMES,
  WHISPER_PRIVACY_BANNER,
  isWhisperAudioMime,
  studyHasUnexpiredConsent,
} from './studies-whisper.util';

describe('studies-whisper.util', () => {
  it('treats a consent with expires_at after now as ingestible', () => {
    const now = new Date('2026-08-14T12:00:00.000Z');
    expect(
      studyHasUnexpiredConsent([{ expires_at: '2026-09-01T00:00:00.000Z' }], now),
    ).toBe(true);
  });

  it('treats null expires_at as ingestible and expired dates as not', () => {
    const now = new Date('2026-08-14T12:00:00.000Z');
    expect(studyHasUnexpiredConsent([{ expires_at: null }], now)).toBe(true);
    expect(
      studyHasUnexpiredConsent([{ expires_at: '2026-01-01T00:00:00.000Z' }], now),
    ).toBe(false);
    expect(studyHasUnexpiredConsent([], now)).toBe(false);
  });

  it('accepts only Whisper audio MIME types', () => {
    expect(WHISPER_AUDIO_MIMES).toEqual([
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/x-m4a',
    ]);
    expect(isWhisperAudioMime('audio/mpeg')).toBe(true);
    expect(isWhisperAudioMime('audio/wav')).toBe(true);
    expect(isWhisperAudioMime('text/plain')).toBe(false);
    expect(isWhisperAudioMime('application/pdf')).toBe(false);
  });

  it('keeps privacy banner and disabled title verbatim', () => {
    expect(WHISPER_PRIVACY_BANNER).toBe(
      'Chỉ lưu đoạn trích ≤ 500 ký tự + mốc thời gian. Không lưu bản ghi / transcript đầy đủ.',
    );
    expect(UPLOAD_DISABLED_TITLE).toBe('Cần consent còn hạn và quyền chạy job');
  });
});
