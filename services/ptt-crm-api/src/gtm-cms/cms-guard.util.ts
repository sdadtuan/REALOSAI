const RNOSAI_RE = /RNOSAI/i;
const HTTPS_RE = /^https:\/\//;

export type PublishableArticleRow = {
  cover_media_id?: string | null;
  title_vi?: string | null;
  body_vi?: string | null;
  alt_vi?: string | null;
  title_en?: string | null;
  body_en?: string | null;
  alt_en?: string | null;
  dek_vi?: string | null;
  dek_en?: string | null;
  seo_title_vi?: string | null;
  seo_title_en?: string | null;
  seo_desc_vi?: string | null;
  seo_desc_en?: string | null;
  publish_en?: boolean;
};

export type PublishableEventRow = {
  start_at: Date | string;
  end_at: Date | string;
  cta_type?: string | null;
  cta_url?: string | null;
  title_vi?: string | null;
  title_en?: string | null;
  dek_vi?: string | null;
  dek_en?: string | null;
  body_vi?: string | null;
  body_en?: string | null;
  location_vi?: string | null;
  location_en?: string | null;
};

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonEmpty(field: string, value: unknown): void {
  if (!nonEmpty(value)) {
    throw new Error(`CMS_PUBLISH_MISSING_${field.toUpperCase()}`);
  }
}

function assertNoRnosaiInText(text: string): void {
  if (RNOSAI_RE.test(text)) {
    throw new Error('RNOSAI_FORBIDDEN');
  }
}

function isPublishingEn(row: PublishableArticleRow): boolean {
  if (row.publish_en === true) return true;
  return nonEmpty(row.title_en) || nonEmpty(row.body_en);
}

const ARTICLE_TEXT_FIELDS: (keyof PublishableArticleRow)[] = [
  'title_vi',
  'title_en',
  'body_vi',
  'body_en',
  'alt_vi',
  'alt_en',
  'dek_vi',
  'dek_en',
  'seo_title_vi',
  'seo_title_en',
  'seo_desc_vi',
  'seo_desc_en',
];

export function assertPublishableArticle(row: PublishableArticleRow): void {
  assertNonEmpty('cover_media_id', row.cover_media_id);
  assertNonEmpty('title_vi', row.title_vi);
  assertNonEmpty('body_vi', row.body_vi);
  assertNonEmpty('alt_vi', row.alt_vi);

  if (isPublishingEn(row)) {
    assertNonEmpty('title_en', row.title_en);
    assertNonEmpty('body_en', row.body_en);
    assertNonEmpty('alt_en', row.alt_en);
  }

  for (const field of ARTICLE_TEXT_FIELDS) {
    const value = row[field];
    if (typeof value === 'string' && value.length > 0) {
      assertNoRnosaiInText(value);
    }
  }
}

export function assertPublishableEvent(row: PublishableEventRow): void {
  const startAt = row.start_at instanceof Date ? row.start_at : new Date(row.start_at);
  const endAt = row.end_at instanceof Date ? row.end_at : new Date(row.end_at);

  if (!(endAt > startAt)) {
    throw new Error('CMS_EVENT_INVALID_DATES');
  }

  if (row.cta_type === 'url') {
    const url = typeof row.cta_url === 'string' ? row.cta_url.trim() : '';
    if (!HTTPS_RE.test(url)) {
      throw new Error('CMS_EVENT_INVALID_CTA_URL');
    }
  }
}
