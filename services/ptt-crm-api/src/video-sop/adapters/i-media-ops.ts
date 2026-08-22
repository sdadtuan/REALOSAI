import { FfmpegMediaOps } from './ffmpeg.media-ops';

export type VdMediaProbe = {
  hasVideo: boolean;
  hasAudio: boolean;
  durationSec: number;
  lufs: number | null;
};

export interface IMediaOps {
  probe(path: string): VdMediaProbe;
  proxy(input: string, output: string): Promise<void>;
  zipEditorPackage(paths: string[], destZip: string): Promise<void>;
}

export function selectMediaOps(): IMediaOps {
  const ffmpegBin = (process.env.FFMPEG_BIN ?? 'ffmpeg').trim() || 'ffmpeg';
  return new FfmpegMediaOps(ffmpegBin);
}
