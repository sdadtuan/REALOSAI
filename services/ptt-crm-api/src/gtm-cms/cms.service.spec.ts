import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CmsService } from './cms.service';

function cfg(): AppConfigService {
  return {
    cmsRevalidateUrl: null,
    cmsRevalidateSecret: null,
    port: 3000,
  } as AppConfigService;
}

describe('CmsService', () => {
  const storage = {} as never;

  it('public list hides draft', async () => {
    const repo = {
      listPublicArticles: jest.fn().mockResolvedValue([
        {
          id: '1',
          slug: 'a',
          status: 'published',
          category: 'insight',
          published_at: '2026-08-01T00:00:00.000Z',
          title_vi: 'Tiêu đề',
          title_en: 'Title',
          dek_vi: 'Dek',
          dek_en: 'Dek EN',
          body_vi: 'Body',
          body_en: 'Body EN',
          cover_media_id: null,
          featured_home: false,
        },
      ]),
      getMediaById: jest.fn(),
    };
    const svc = new CmsService(repo as never, storage, cfg());
    const rows = await svc.listPublicArticles({ locale: 'vi' });
    expect(rows.every((r) => r.status === 'published')).toBe(true);
    expect(repo.listPublicArticles).toHaveBeenCalled();
  });

  it('publish rejects RNOSAI', async () => {
    const repo = {
      getArticleById: jest.fn().mockResolvedValue({
        id: '1',
        body_vi: 'x RNOSAI y',
        title_vi: 't',
        dek_vi: 'd',
        cover_media_id: 'm',
        title_en: null,
        body_en: null,
        dek_en: null,
      }),
      getMediaById: jest.fn().mockResolvedValue({
        id: 'm',
        alt_vi: 'a',
        alt_en: null,
      }),
    };
    const svc = new CmsService(repo as never, storage, cfg());
    await expect(svc.publishArticle('1', 'mkt')).rejects.toThrow(UnprocessableEntityException);
    await expect(svc.publishArticle('1', 'mkt')).rejects.toThrow(/RNOSAI/);
  });

  it('cannot hard-delete referenced media', async () => {
    const repo = {
      mediaRefCount: jest.fn().mockResolvedValue(1),
    };
    const svc = new CmsService(repo as never, storage, cfg());
    await expect(svc.archiveMedia('m', 'mkt', { hard: true })).rejects.toThrow(ConflictException);
    await expect(svc.archiveMedia('m', 'mkt', { hard: true })).rejects.toThrow(/referenced/);
  });

  it('rate limits public requests at 120 per minute', () => {
    const svc = new CmsService({} as never, storage, cfg());
    for (let i = 0; i < 120; i += 1) {
      expect(svc.isPublicRateLimited('1.2.3.4')).toBe(false);
    }
    expect(svc.isPublicRateLimited('1.2.3.4')).toBe(true);
  });
});
