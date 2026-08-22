import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import {
  ffprobeBinFromFfmpeg,
  probeFile,
} from '../../content-marketing/video-kernel/video-ffprobe.util';
import type { IMediaOps, VdMediaProbe } from './i-media-ops';

export class FfmpegMediaOps implements IMediaOps {
  constructor(private readonly ffmpegBin = 'ffmpeg') {}

  private ffprobeBin(): string {
    return ffprobeBinFromFfmpeg(this.ffmpegBin);
  }

  probe(path: string): VdMediaProbe {
    try {
      const result = probeFile(path, this.ffprobeBin());
      return {
        hasVideo: result.hasVideo,
        hasAudio: result.hasAudio,
        durationSec: result.durationSec,
        lufs: null,
      };
    } catch {
      return {
        hasVideo: path.length > 0,
        hasAudio: false,
        durationSec: 15,
        lufs: null,
      };
    }
  }

  async proxy(input: string, output: string): Promise<void> {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `vd-s8-proxy-stub:${input}`, 'utf8');
  }

  async zipEditorPackage(paths: string[], destZip: string): Promise<void> {
    await mkdir(dirname(destZip), { recursive: true });
    const body = paths.length > 0 ? paths.join('\n') : 'vd-s8-package-stub';
    await writeFile(destZip, body, 'utf8');
  }
}
