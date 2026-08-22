import { Injectable } from '@nestjs/common';
import { spawn, spawnSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { CmktVideoBeat } from '../content-marketing.types';
import {
  assertFfmpegAvailable,
  ffprobeBinFromFfmpeg,
  probeFile,
} from '../video-kernel/video-ffprobe.util';
import { buildAss, writeTextOverlayPng } from './social-captions.util';

export { buildAss };

const FFMPEG_TIMEOUT_MS = 180_000;

const DRAWTEXT_FONTS = [
  '/System/Library/Fonts/Helvetica.ttc',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
];

export type ComposeSocialMasterInput = {
  workDir: string;
  ffmpegBin: string;
  beats: CmktVideoBeat[];
  voicePath: string;
  clipPaths: string[];
  bedPath?: string;
  logoPath?: string;
  captionsAssPath: string;
  draftWatermark: boolean;
  width: number;
  height: number;
};

type OverlayAsset = { path: string; startSec: number; endSec: number };

@Injectable()
export class SocialFfmpegComposer {
  async composeSocialMaster(
    input: ComposeSocialMasterInput,
  ): Promise<{ masterPath: string; posterPath: string }> {
    assertFfmpegAvailable(input.ffmpegBin);

    if (!input.voicePath || !existsSync(input.voicePath)) {
      throw new Error('voice_missing');
    }

    const durationSec = masterDurationSec(input.beats);
    writeFileSync(input.captionsAssPath, buildAss(input.beats, input.width, input.height));

    const filters = listFilters(input.ffmpegBin);
    const overlays = await prepareOverlayAssets(input, filters);

    const masterPath = join(input.workDir, 'master.mp4');
    await runFfmpeg(
      input.ffmpegBin,
      buildComposeArgs(input, masterPath, durationSec, filters, overlays),
    );

    if (!existsSync(masterPath)) {
      throw new Error('master_missing');
    }

    const probe = probeFile(masterPath, ffprobeBinFromFfmpeg(input.ffmpegBin));
    if (!probe.hasVideo || !probe.hasAudio) {
      throw new Error('master_probe_incomplete');
    }

    const posterPath = await extractPoster(input.ffmpegBin, masterPath, input.workDir);
    return { masterPath, posterPath };
  }
}

export function masterDurationSec(beats: CmktVideoBeat[]): number {
  if (!beats.length) {
    return 2;
  }
  const lastEnd = Math.max(...beats.map((b) => b.end_ms));
  return lastEnd > 0 ? lastEnd / 1000 : 2;
}

function listFilters(ffmpegBin: string): Set<string> {
  const result = spawnSync(ffmpegBin, ['-hide_banner', '-filters'], { encoding: 'utf8' });
  const names = new Set<string>();
  for (const line of `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n')) {
    const match = line.match(/^\s*[.A-Z]+\s+(\w+)\s+/);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

function resolveDrawtextFont(): string | null {
  return DRAWTEXT_FONTS.find((p) => existsSync(p)) ?? null;
}

function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/** FFmpeg 8 drawtext dropped `angle`; keep DRAFT readable without rotating. */
export function draftWatermarkDrawtextFilter(opts: {
  videoLabel: string;
  fontOpt: string;
  fontsize: number;
}): string {
  return `[${opts.videoLabel}]drawtext=${opts.fontOpt}text='DRAFT':fontcolor=white@0.22:fontsize=${opts.fontsize}:x=(w-text_w)/2:y=(h-text_h)/2[vdraft]`;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

function clipTrimDurations(beats: CmktVideoBeat[], clipCount: number, durationSec: number): number[] {
  if (clipCount <= 0) {
    return [];
  }
  if (beats.length >= clipCount) {
    return beats.slice(0, clipCount).map((b) => Math.max(0.1, (b.end_ms - b.start_ms) / 1000));
  }
  const share = durationSec / clipCount;
  return Array.from({ length: clipCount }, () => Math.max(0.1, share));
}

async function prepareOverlayAssets(
  input: ComposeSocialMasterInput,
  filters: Set<string>,
): Promise<OverlayAsset[]> {
  const overlays: OverlayAsset[] = [];
  const useDrawtext = filters.has('drawtext');
  const useSubtitles = filters.has('subtitles');
  const durationSec = masterDurationSec(input.beats);

  if (!useDrawtext) {
    const hook = input.beats.find((b) => b.id === 'hook');
    const hookText = (hook?.on_screen_text || hook?.script_excerpt || '').trim();
    if (hookText) {
      const hookPath = join(input.workDir, 'hook-overlay.png');
      await writeTextOverlayPng({
        path: hookPath,
        width: input.width,
        height: input.height,
        text: hookText,
        yPct: 0.12,
        fontSize: Math.max(24, Math.round(input.height * 0.045)),
      });
      overlays.push({ path: hookPath, startSec: 0, endSec: 3 });
    }

    if (input.draftWatermark) {
      const draftPath = join(input.workDir, 'draft-overlay.png');
      await writeTextOverlayPng({
        path: draftPath,
        width: input.width,
        height: input.height,
        text: 'DRAFT',
        yPct: 0.5,
        fontSize: Math.max(48, Math.round(input.height * 0.12)),
        opacity: 0.22,
        rotateDeg: 45,
      });
      overlays.push({ path: draftPath, startSec: 0, endSec: durationSec });
    }
  }

  if (!useSubtitles) {
    for (const beat of input.beats) {
      const text = beat.on_screen_text?.trim();
      if (!text) {
        continue;
      }
      const captionPath = join(input.workDir, `caption-${beat.id}.png`);
      await writeTextOverlayPng({
        path: captionPath,
        width: input.width,
        height: input.height,
        text,
        yPct: 0.82,
        fontSize: Math.max(20, Math.round(input.height * 0.035)),
      });
      overlays.push({
        path: captionPath,
        startSec: beat.start_ms / 1000,
        endSec: Math.max(beat.start_ms, beat.end_ms) / 1000,
      });
    }
  }

  return overlays;
}

function buildComposeArgs(
  input: ComposeSocialMasterInput,
  masterPath: string,
  durationSec: number,
  filtersAvail: Set<string>,
  overlays: OverlayAsset[],
): string[] {
  const { width, height, clipPaths, voicePath, bedPath, captionsAssPath, draftWatermark, beats } =
    input;
  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];

  args.push('-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:d=${durationSec}:r=30`);

  let nextIndex = 1;
  const clipIndexes: number[] = [];
  for (const clipPath of clipPaths) {
    args.push('-i', clipPath);
    clipIndexes.push(nextIndex++);
  }

  args.push('-i', voicePath);
  const voiceIndex = nextIndex++;

  let bedIndex: number | undefined;
  if (bedPath && existsSync(bedPath)) {
    args.push('-i', bedPath);
    bedIndex = nextIndex++;
  }

  const overlayIndexes: number[] = [];
  for (const overlay of overlays) {
    args.push('-i', overlay.path);
    overlayIndexes.push(nextIndex++);
  }

  const filters: string[] = [];
  let videoLabel = '0:v';

  if (clipIndexes.length > 0) {
    const durs = clipTrimDurations(beats, clipIndexes.length, durationSec);
    const clipLabels: string[] = [];
    clipIndexes.forEach((idx, i) => {
      const label = `c${i}`;
      filters.push(
        `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,trim=start=0:duration=${durs[i]},setpts=PTS-STARTPTS,fps=30[${label}]`,
      );
      clipLabels.push(`[${label}]`);
    });
    filters.push(`${clipLabels.join('')}concat=n=${clipIndexes.length}:v=1:a=0[vcat]`);
    filters.push('[0:v][vcat]overlay=0:0:eof_action=pass[vbase]');
    videoLabel = 'vbase';
  }

  filters.push(`[${videoLabel}]format=yuv420p[vfmt]`);
  videoLabel = 'vfmt';

  if (filtersAvail.has('subtitles')) {
    filters.push(`[${videoLabel}]subtitles=${escapeFilterPath(captionsAssPath)}[vsub]`);
    videoLabel = 'vsub';
  }

  const font = resolveDrawtextFont();
  const fontOpt = font ? `fontfile=${escapeFilterPath(font)}:` : '';
  if (filtersAvail.has('drawtext')) {
    const hook = beats.find((b) => b.id === 'hook');
    const hookText = (hook?.on_screen_text || hook?.script_excerpt || '').trim();
    if (hookText) {
      const fontsize = Math.max(24, Math.round(height * 0.045));
      filters.push(
        `[${videoLabel}]drawtext=${fontOpt}text='${escapeDrawtext(hookText)}':fontcolor=white:fontsize=${fontsize}:x=(w-text_w)/2:y=h*0.12:enable=between(t\\,0\\,3)[vhook]`,
      );
      videoLabel = 'vhook';
    }
    if (draftWatermark) {
      const fontsize = Math.max(48, Math.round(height * 0.12));
      filters.push(draftWatermarkDrawtextFilter({ videoLabel, fontOpt, fontsize }));
      videoLabel = 'vdraft';
    }
  }

  overlayIndexes.forEach((idx, i) => {
    const win = overlays[i];
    const next = `vov${i}`;
    filters.push(
      `[${videoLabel}][${idx}:v]overlay=0:0:enable=between(t\\,${win.startSec}\\,${win.endSec})[${next}]`,
    );
    videoLabel = next;
  });

  if (bedIndex != null) {
    filters.push(
      `[${voiceIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[voice]`,
    );
    filters.push(
      `[${bedIndex}:a]volume=0.15,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[bed]`,
    );
    filters.push('[voice][bed]amix=inputs=2:duration=first:dropout_transition=2[aout]');
  } else {
    filters.push(
      `[${voiceIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`,
    );
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${videoLabel}]`, '-map', '[aout]');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30');
  args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-movflags', '+faststart');
  args.push('-t', String(durationSec));
  args.push(masterPath);
  return args;
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout?.on('data', () => undefined);

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg_timeout'));
    }, FFMPEG_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg_failed: ${stderr.slice(-800)}`));
    });
  });
}

async function extractPoster(
  ffmpegBin: string,
  masterPath: string,
  workDir: string,
): Promise<string> {
  const webp = join(workDir, 'poster.webp');
  try {
    await runFfmpeg(ffmpegBin, ['-y', '-i', masterPath, '-frames:v', '1', webp]);
    if (existsSync(webp)) {
      return webp;
    }
  } catch {
    // fall through to jpg
  }

  const jpg = join(workDir, 'poster.jpg');
  await runFfmpeg(ffmpegBin, ['-y', '-i', masterPath, '-frames:v', '1', jpg]);
  if (!existsSync(jpg)) {
    throw new Error('poster_missing');
  }
  return jpg;
}
