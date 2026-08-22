import { assertPublishableArticle, assertPublishableEvent } from './cms-guard.util';

describe('cms-guard.util', () => {
  describe('assertPublishableArticle', () => {
    const validVi = {
      cover_media_id: 'media-1',
      title_vi: 'Tiêu đề',
      body_vi: 'Nội dung bài viết',
      alt_vi: 'Mô tả ảnh',
    };

    it('passes with required VI fields', () => {
      expect(() => assertPublishableArticle(validVi)).not.toThrow();
    });

    it('throws when body contains RNOSAI', () => {
      expect(() =>
        assertPublishableArticle({
          ...validVi,
          body_vi: 'Powered by RNOSAI',
        }),
      ).toThrow(/RNOSAI/);
    });

    it('requires EN fields when publishing EN', () => {
      expect(() =>
        assertPublishableArticle({
          ...validVi,
          publish_en: true,
        }),
      ).toThrow(/TITLE_EN/);

      expect(() =>
        assertPublishableArticle({
          ...validVi,
          publish_en: true,
          title_en: 'Title',
          body_en: 'Body',
          alt_en: 'Alt',
        }),
      ).not.toThrow();
    });

    it('throws when cover_media_id is missing', () => {
      expect(() =>
        assertPublishableArticle({
          title_vi: 'Tiêu đề',
          body_vi: 'Nội dung',
          alt_vi: 'Alt',
        }),
      ).toThrow(/COVER_MEDIA_ID/);
    });
  });

  describe('assertPublishableEvent', () => {
    it('throws when end_at is not after start_at', () => {
      const start = new Date('2026-09-01T10:00:00+07:00');
      const end = new Date('2026-09-01T09:00:00+07:00');
      expect(() =>
        assertPublishableEvent({
          start_at: start,
          end_at: end,
          cta_type: 'demo',
        }),
      ).toThrow(/INVALID_DATES/);
    });

    it('passes when end_at is after start_at', () => {
      const start = new Date('2026-09-01T10:00:00+07:00');
      const end = new Date('2026-09-01T11:00:00+07:00');
      expect(() =>
        assertPublishableEvent({
          start_at: start,
          end_at: end,
          cta_type: 'demo',
        }),
      ).not.toThrow();
    });

    it('requires https cta_url when cta_type is url', () => {
      const start = new Date('2026-09-01T10:00:00+07:00');
      const end = new Date('2026-09-01T11:00:00+07:00');
      expect(() =>
        assertPublishableEvent({
          start_at: start,
          end_at: end,
          cta_type: 'url',
          cta_url: 'http://insecure.example',
        }),
      ).toThrow(/CTA_URL/);

      expect(() =>
        assertPublishableEvent({
          start_at: start,
          end_at: end,
          cta_type: 'url',
          cta_url: 'https://secure.example/register',
        }),
      ).not.toThrow();
    });
  });
});
