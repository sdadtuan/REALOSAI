import { assertFfmpegAvailable } from './video-ffprobe.util';

describe('video-ffprobe.util', () => {
  it('throws ffmpeg_missing when binary absent', () => {
    expect(() => assertFfmpegAvailable('/bin/no-such-ffmpeg-rnosai')).toThrow(/ffmpeg_missing/);
  });
});
