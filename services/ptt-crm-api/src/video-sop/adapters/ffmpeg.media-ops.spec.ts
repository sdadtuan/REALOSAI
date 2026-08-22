import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { FfmpegMediaOps } from './ffmpeg.media-ops';

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkTsFiles(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('FfmpegMediaOps', () => {
  it('returns stub probe when ffprobe fails', () => {
    const ops = new FfmpegMediaOps('/bin/no-such-ffmpeg-rnosai');
    const probe = ops.probe('/tmp/missing-vd-s8.mp4');
    expect(probe.hasVideo).toBe(true);
    expect(probe.lufs).toBeNull();
  });

  it('does not import SocialFfmpegComposer in video-sop', () => {
    const root = join(__dirname, '..');
    const hits = walkTsFiles(root).filter(
      (file) =>
        !file.endsWith('.spec.ts') &&
        readFileSync(file, 'utf8').includes('SocialFfmpegComposer'),
    );
    expect(hits).toEqual([]);
  });
});
