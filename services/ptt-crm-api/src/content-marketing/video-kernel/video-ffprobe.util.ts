import { spawnSync } from 'child_process';

export interface ProbeFileResult {
  hasVideo: boolean;
  hasAudio: boolean;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}

function parseFrameRate(rate?: string): number {
  if (!rate || rate === '0/0') {
    return 0;
  }
  const [num, den] = rate.split('/').map(Number);
  if (!num || !den) {
    return 0;
  }
  return num / den;
}

function ffprobeBinFromFfmpeg(ffmpegBin: string): string {
  const base = ffmpegBin.replace(/\/ffmpeg$/, '');
  return base === ffmpegBin ? 'ffprobe' : `${base}/ffprobe`;
}

export function assertFfmpegAvailable(bin: string): void {
  const result = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('ffmpeg_missing');
  }
}

export function probeFile(path: string, ffprobeBin = 'ffprobe'): ProbeFileResult {
  const result = spawnSync(
    ffprobeBin,
    [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      path,
    ],
    { encoding: 'utf8' },
  );

  if (result.error || result.status !== 0) {
    throw new Error('ffprobe_failed');
  }

  const parsed = JSON.parse(result.stdout) as FfprobeOutput;
  const streams = parsed.streams ?? [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');
  const durationRaw = parsed.format?.duration ?? videoStream?.duration ?? '0';

  return {
    hasVideo: videoStream != null,
    hasAudio: audioStream != null,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    durationSec: Number.parseFloat(durationRaw) || 0,
    fps: parseFrameRate(videoStream?.r_frame_rate ?? videoStream?.avg_frame_rate),
  };
}

export { ffprobeBinFromFfmpeg };
