import { BadRequestException } from '@nestjs/common';
import { lockVideoStudio } from '../../content-marketing/video-social/social-studio.util';
import { VdProjectHttpService } from './vd-project-http.service';

function makeHttp() {
  const projects = {
    createFromContentItem: jest.fn(),
    listByLifecycle: jest.fn(),
    getById: jest.fn(),
  };
  const cmkt = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
  };
  const svc = new VdProjectHttpService(projects as never, cmkt as never);
  return { svc, projects, cmkt };
}

describe('VdProjectHttpService', () => {
  it('create locks cinematic studio and writes vd_project_id', async () => {
    const { svc, projects, cmkt } = makeHttp();
    cmkt.getItemById.mockResolvedValue({
      id: 12,
      lifecycle_id: 3,
      title: 'Chiến dịch',
      media_json: {},
      body_json: { markdown: 'Hook' },
    });
    projects.createFromContentItem.mockResolvedValue({
      id: 7,
      lifecycle_id: 3,
      cmkt_item_id: 12,
      title: 'Chiến dịch',
      stage: 'brief_draft',
    });

    const row = await svc.create({ lifecycle_id: 3, cmkt_item_id: 12 }, 'a@b.c');

    expect(row.id).toBe(7);
    expect(cmkt.patchItem).toHaveBeenCalledWith(
      3,
      12,
      expect.objectContaining({
        media_json: expect.objectContaining({
          video_studio: 'cinematic',
          vd_project_id: 7,
        }),
      }),
    );
  });

  it('rejects already-locked social item with studio_locked', async () => {
    const { svc, projects, cmkt } = makeHttp();
    cmkt.getItemById.mockResolvedValue({
      id: 12,
      lifecycle_id: 3,
      title: 'Social clip',
      media_json: lockVideoStudio({}, 'social'),
      body_json: { markdown: 'Hook' },
    });

    await expect(svc.create({ lifecycle_id: 3, cmkt_item_id: 12 }, 'a@b.c')).rejects.toMatchObject({
      status: 400,
    });
    try {
      await svc.create({ lifecycle_id: 3, cmkt_item_id: 12 }, 'a@b.c');
      throw new Error('expected studio_locked');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'studio_locked' }),
      );
    }
    expect(projects.createFromContentItem).not.toHaveBeenCalled();
    expect(cmkt.patchItem).not.toHaveBeenCalled();
  });

  it('maps vd_tables_missing to 400 and does not patch item', async () => {
    const { svc, projects, cmkt } = makeHttp();
    cmkt.getItemById.mockResolvedValue({
      id: 12,
      lifecycle_id: 3,
      title: 'Chiến dịch',
      media_json: {},
      body_json: { markdown: 'Hook' },
    });
    projects.createFromContentItem.mockRejectedValue(new Error('vd_tables_missing'));

    await expect(svc.create({ lifecycle_id: 3, cmkt_item_id: 12 }, 'a@b.c')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await svc.create({ lifecycle_id: 3, cmkt_item_id: 12 }, 'a@b.c');
      throw new Error('expected vd_tables_missing');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getStatus()).toBe(400);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'vd_tables_missing' }),
      );
    }
    expect(cmkt.patchItem).not.toHaveBeenCalled();
  });
});

