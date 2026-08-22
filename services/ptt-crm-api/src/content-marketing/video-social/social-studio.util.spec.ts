import {
  assertScriptFitsPack,
  assertStudioWritable,
  estimateVoDurationSec,
  isLikelyPlayableAudio,
  lockVideoStudio,
} from './social-studio.util';

describe('social-studio.util', () => {
  it('rejects stub TTS bytes that ffmpeg cannot decode', () => {
    expect(isLikelyPlayableAudio(Buffer.from('ID3abcdef12', 'utf8'))).toBe(false);
    expect(isLikelyPlayableAudio(Buffer.alloc(256, 1))).toBe(true);
  });

  it('estimates VO at 2.5 words/sec', () => {
    expect(estimateVoDurationSec('một hai ba bốn năm')).toBe(2);
  });

  it('blocks script longer than reels max', () => {
    const long = Array.from({ length: 200 }, () => 'từ').join(' ');
    expect(() => assertScriptFitsPack(long, 'reels')).toThrow(/script_too_long/);
  });

  it('locks studio and rejects switch', () => {
    const locked = lockVideoStudio({}, 'social');
    expect(locked.video_studio).toBe('social');
    expect(() => assertStudioWritable(locked, 'cinematic')).toThrow(/studio_locked/);
  });
});
