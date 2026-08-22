import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { MarketResearchController } from './market-research.controller';

jest.mock('../staff-client-scope/staff-client-scope.http.util', () => ({
  resolveStaffClientScope: jest.fn(async () => ({ restricted: false, allowedClientIds: [] })),
}));

describe('MarketResearchController whisper temp', () => {
  it('maps audio/mpeg to a .mp3 research-whisper temp path and passes mime', async () => {
    const ingestWhisper = jest.fn(
      async (
        _id: number,
        _studyId: number,
        _scope: unknown,
        _input: { tempPath: string; mime: string },
      ) => ({ ok: true }),
    );
    const ctrl = new MarketResearchController({ ingestWhisper } as never, {} as never);
    const file = {
      buffer: Buffer.from('fake-mp3'),
      mimetype: 'audio/mpeg',
    } as Express.Multer.File;

    try {
      await ctrl.ingestWhisper({} as never, 1, 2, file);
      const input = ingestWhisper.mock.calls[0][3];
      expect(input.tempPath).toMatch(/research-whisper-[0-9a-f-]+\.mp3$/);
      expect(path.extname(input.tempPath)).toBe('.mp3');
      expect(input.mime).toBe('audio/mpeg');
    } finally {
      const input = ingestWhisper.mock.calls[0]?.[3];
      if (input?.tempPath && fs.existsSync(input.tempPath)) {
        fs.unlinkSync(input.tempPath);
      }
    }
  });
});

describe('MarketResearchController export format', () => {
  it('unknown format is 400 validation_error and does not export', async () => {
    const research = { exportReportVersion: jest.fn() };
    const ctrl = new MarketResearchController(research as never, {} as never);

    try {
      await ctrl.exportReportVersion({} as never, 1, 10, 'xlsx');
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'validation_error' });
    }
    expect(research.exportReportVersion).not.toHaveBeenCalled();
  });
});
