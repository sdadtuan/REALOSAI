import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { probeFile } from '../video-kernel/video-ffprobe.util';
import { SocialFfmpegComposer, draftWatermarkDrawtextFilter } from './social-ffmpeg.composer';
import type { CmktVideoBeat } from '../content-marketing.types';

const ffmpegWhich = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
const hasFfmpeg = ffmpegWhich.status === 0 && Boolean(ffmpegWhich.stdout.trim());
const ffmpegBin = hasFfmpeg ? ffmpegWhich.stdout.trim() : 'ffmpeg';

describe('SocialFfmpegComposer', () => {
  it('omits drawtext angle so FFmpeg 8 can render the DRAFT watermark', () => {
    const expr = draftWatermarkDrawtextFilter({
      videoLabel: 'vhook',
      fontOpt: '',
      fontsize: 48,
    });
    expect(expr).toContain("text='DRAFT'");
    expect(expr).not.toMatch(/angle=/);
  });

  it('throws voice_missing when voice file is absent', async () => {
    const workDir = mkdtempSync(join(tmpdir(), 'cmkt-social-voice-missing-'));
    try {
      const composer = new SocialFfmpegComposer();
      await expect(
        composer.composeSocialMaster({
          workDir,
          ffmpegBin: hasFfmpeg ? ffmpegBin : '/bin/no-such-ffmpeg-rnosai',
          beats: [],
          voicePath: '/tmp/no-such-voice-rnosai.wav',
          clipPaths: [],
          captionsAssPath: join(workDir, 'captions.ass'),
          draftWatermark: false,
          width: 1080,
          height: 1920,
        }),
      ).rejects.toThrow(hasFfmpeg ? /voice_missing/ : /voice_missing|ffmpeg_missing/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('refuses to return a fabricated mp4 url', async () => {
    const composer = new SocialFfmpegComposer();
    await expect(
      composer.composeSocialMaster({
        workDir: '/tmp/nope',
        ffmpegBin: '/bin/no-such-ffmpeg-rnosai',
        beats: [],
        voicePath: '/tmp/x.wav',
        clipPaths: [],
        captionsAssPath: '/tmp/x.ass',
        draftWatermark: true,
        width: 1080,
        height: 1920,
      }),
    ).rejects.toThrow(/ffmpeg_missing/);
  });

  (hasFfmpeg ? it : it.skip)(
    'writes probeable mp4 from generated color+sine fixtures',
    async () => {
      const workDir = mkdtempSync(join(tmpdir(), 'cmkt-social-ffmpeg-'));
      try {
        const voicePath = join(workDir, 'voice.wav');
        const clipPath = join(workDir, 'clip0.mp4');
        const captionsAssPath = join(workDir, 'captions.ass');

        const sine = spawnSync(
          ffmpegBin,
          ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'pcm_s16le', voicePath],
          { encoding: 'utf8' },
        );
        expect(sine.status).toBe(0);

        const color = spawnSync(
          ffmpegBin,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            'color=c=blue:s=640x360:d=2:r=30',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            clipPath,
          ],
          { encoding: 'utf8' },
        );
        expect(color.status).toBe(0);

        const beats: CmktVideoBeat[] = [
          {
            id: 'hook',
            start_ms: 0,
            end_ms: 2000,
            script_excerpt: 'Hook fixture',
            keywords: ['hook'],
            clip_id: null,
            on_screen_text: 'Hook fixture',
            locked: false,
          },
        ];
        writeFileSync(captionsAssPath, '');

        const composer = new SocialFfmpegComposer();
        const out = await composer.composeSocialMaster({
          workDir,
          ffmpegBin,
          beats,
          voicePath,
          clipPaths: [clipPath],
          captionsAssPath,
          draftWatermark: true,
          width: 640,
          height: 360,
        });

        const probe = probeFile(out.masterPath);
        expect(probe.hasVideo && probe.hasAudio).toBe(true);
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
