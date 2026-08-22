CREATE TABLE gtm_demo_request (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  locale          text NOT NULL CHECK (locale IN ('vi', 'en')),
  full_name       text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL,
  company         text NOT NULL,
  industry        text NOT NULL CHECK (industry IN (
                    'bds', 'agency', 'fnb', 'education', 'pharma', 'other')),
  sku_interest    text NOT NULL CHECK (sku_interest IN ('mkt', 'ind', 'agy')),
  company_size    text CHECK (company_size IN ('1-10', '11-30', '31-80', '81+')),
  message         text,
  landing_path    text NOT NULL,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN (
                    'new', 'qualified', 'disqualified',
                    'demo_booked', 'sandbox_granted', 'won', 'lost')),
  status_note     text,
  owner_user_id   text,
  lead_id         text,
  sandbox_expires_at timestamptz,
  sandbox_user_id text,
  ip_hash         text NOT NULL
);

CREATE INDEX gtm_demo_request_email_created_idx
  ON gtm_demo_request (lower(email), created_at DESC);
CREATE INDEX gtm_demo_request_status_created_idx
  ON gtm_demo_request (status, created_at DESC);

CREATE TABLE gtm_cms_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  storage_key   text NOT NULL UNIQUE,
  public_url    text NOT NULL,
  mime          text NOT NULL,
  bytes         int NOT NULL,
  width         int,
  height        int,
  alt_vi        text,
  alt_en        text,
  credit        text,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived')),
  uploaded_by   text NOT NULL
);

CREATE TABLE gtm_cms_article (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  slug            text NOT NULL UNIQUE,
  category        text NOT NULL CHECK (category IN ('insight', 'nganh', 'huong-dan')),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'archived')),
  published_at    timestamptz,
  cover_media_id  uuid REFERENCES gtm_cms_media(id),
  title_vi        text NOT NULL,
  title_en        text,
  dek_vi          text NOT NULL,
  dek_en          text,
  body_vi         text NOT NULL,
  body_en         text,
  seo_title_vi    text,
  seo_title_en    text,
  seo_desc_vi     text,
  seo_desc_en     text,
  featured_home   boolean NOT NULL DEFAULT false,
  created_by      text NOT NULL,
  updated_by      text NOT NULL
);

CREATE TABLE gtm_cms_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  slug            text NOT NULL UNIQUE,
  kind            text NOT NULL CHECK (kind IN (
                    'webinar', 'workshop', 'meetup', 'conference', 'other')),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'cancelled', 'archived')),
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  timezone        text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  location_type   text NOT NULL CHECK (location_type IN ('online', 'offline', 'hybrid')),
  location_vi     text,
  location_en     text,
  title_vi        text NOT NULL,
  title_en        text,
  dek_vi          text NOT NULL,
  dek_en          text,
  body_vi         text NOT NULL,
  body_en         text,
  cover_media_id  uuid REFERENCES gtm_cms_media(id),
  cta_type        text NOT NULL CHECK (cta_type IN ('demo', 'url')),
  cta_url         text,
  published_at    timestamptz,
  created_by      text NOT NULL,
  updated_by      text NOT NULL,
  CHECK (end_at > start_at),
  CHECK (cta_type <> 'url' OR cta_url ~ '^https://')
);

CREATE TABLE gtm_cms_slot (
  slot_key      text PRIMARY KEY,
  media_id      uuid NOT NULL REFERENCES gtm_cms_media(id),
  caption_vi    text,
  caption_en    text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text NOT NULL
);

CREATE INDEX gtm_cms_article_status_pub_idx
  ON gtm_cms_article (status, published_at DESC);
CREATE INDEX gtm_cms_event_status_start_idx
  ON gtm_cms_event (status, start_at);
