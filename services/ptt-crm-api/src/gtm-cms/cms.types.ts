export type CmsLocale = 'vi' | 'en';

export type CmsArticleCategory = 'insight' | 'nganh' | 'huong-dan';
export type CmsArticleStatus = 'draft' | 'published' | 'archived';
export type CmsEventStatus = 'draft' | 'published' | 'cancelled' | 'archived';
export type CmsEventKind = 'webinar' | 'workshop' | 'meetup' | 'conference' | 'other';
export type CmsLocationType = 'online' | 'offline' | 'hybrid';
export type CmsCtaType = 'demo' | 'url';
export type CmsMediaStatus = 'active' | 'archived';
export type CmsEventWhen = 'upcoming' | 'past' | 'all';

export const CMS_SLOT_KEYS = [
  'home.hero',
  'home.module.crm',
  'home.module.ads',
  'home.module.portal',
  'home.module.ai',
  'product.crm',
  'product.ads',
  'product.portal',
  'product.ai',
  'solution.bds',
  'solution.agency',
  'solution.fnb',
] as const;

export type CmsSlotKey = (typeof CMS_SLOT_KEYS)[number];

export type CmsMediaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  storage_key: string;
  public_url: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt_vi: string | null;
  alt_en: string | null;
  credit: string | null;
  status: CmsMediaStatus;
  uploaded_by: string;
};

export type CmsArticleRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  category: CmsArticleCategory;
  status: CmsArticleStatus;
  published_at: string | null;
  cover_media_id: string | null;
  title_vi: string;
  title_en: string | null;
  dek_vi: string;
  dek_en: string | null;
  body_vi: string;
  body_en: string | null;
  seo_title_vi: string | null;
  seo_title_en: string | null;
  seo_desc_vi: string | null;
  seo_desc_en: string | null;
  featured_home: boolean;
  created_by: string;
  updated_by: string;
};

export type CmsEventRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  kind: CmsEventKind;
  status: CmsEventStatus;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: CmsLocationType;
  location_vi: string | null;
  location_en: string | null;
  title_vi: string;
  title_en: string | null;
  dek_vi: string;
  dek_en: string | null;
  body_vi: string;
  body_en: string | null;
  cover_media_id: string | null;
  cta_type: CmsCtaType;
  cta_url: string | null;
  published_at: string | null;
  created_by: string;
  updated_by: string;
};

export type CmsSlotRow = {
  slot_key: string;
  media_id: string;
  caption_vi: string | null;
  caption_en: string | null;
  updated_at: string;
  updated_by: string;
};

export type PublicArticleCard = {
  slug: string;
  category: CmsArticleCategory;
  status: CmsArticleStatus;
  published_at: string | null;
  title: string;
  dek: string;
  cover_url: string | null;
  cover_alt: string | null;
  featured_home: boolean;
};

export type PublicArticleDetail = PublicArticleCard & {
  body: string;
  seo_title: string | null;
  seo_desc: string | null;
};

export type PublicEventCard = {
  slug: string;
  kind: CmsEventKind;
  status: CmsEventStatus;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: CmsLocationType;
  location: string | null;
  title: string;
  dek: string;
  cover_url: string | null;
  cover_alt: string | null;
  cta_type: CmsCtaType;
  cta_url: string | null;
};

export type PublicEventDetail = PublicEventCard & {
  body: string;
};

export type PublicSlotView = {
  slot_key: string;
  media_url: string;
  media_alt: string | null;
  caption: string | null;
};

export type CreateArticleBody = {
  slug: string;
  category: CmsArticleCategory;
  title_vi: string;
  title_en?: string | null;
  dek_vi: string;
  dek_en?: string | null;
  body_vi: string;
  body_en?: string | null;
  cover_media_id?: string | null;
  seo_title_vi?: string | null;
  seo_title_en?: string | null;
  seo_desc_vi?: string | null;
  seo_desc_en?: string | null;
  featured_home?: boolean;
};

export type PatchArticleBody = Partial<CreateArticleBody>;

export type PublishArticleBody = {
  locales?: CmsLocale[];
};

export type CreateEventBody = {
  slug: string;
  kind: CmsEventKind;
  start_at: string;
  end_at: string;
  timezone?: string;
  location_type: CmsLocationType;
  location_vi?: string | null;
  location_en?: string | null;
  title_vi: string;
  title_en?: string | null;
  dek_vi: string;
  dek_en?: string | null;
  body_vi: string;
  body_en?: string | null;
  cover_media_id?: string | null;
  cta_type: CmsCtaType;
  cta_url?: string | null;
};

export type PatchEventBody = Partial<CreateEventBody & { status: CmsEventStatus }>;

export type PublishEventBody = {
  locales?: CmsLocale[];
};

export type PatchMediaBody = {
  alt_vi?: string | null;
  alt_en?: string | null;
  credit?: string | null;
  status?: CmsMediaStatus;
  hard?: boolean;
};

export type PutSlotBody = {
  media_id: string;
  caption_vi?: string | null;
  caption_en?: string | null;
};

export type ListArticlesQuery = {
  status?: CmsArticleStatus;
  category?: CmsArticleCategory;
  limit?: number;
  offset?: number;
};

export type ListEventsQuery = {
  status?: CmsEventStatus;
  limit?: number;
  offset?: number;
};

export type ListPublicArticlesQuery = {
  locale: CmsLocale;
  category?: CmsArticleCategory;
  limit?: number;
  offset?: number;
};

export type ListPublicEventsQuery = {
  locale: CmsLocale;
  when?: CmsEventWhen;
  limit?: number;
  offset?: number;
};
