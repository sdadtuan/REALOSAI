import * as fs from 'fs';
import * as path from 'path';
import type { Pool } from 'pg';
import type { CmsArticleCategory } from './cms.types';

export type SeedArticleSpec = {
  slug: string;
  category: CmsArticleCategory;
  htmlFile: string;
  featured_home?: boolean;
  published_at?: string;
};

export const SEED_ARTICLES: SeedArticleSpec[] = [
  { slug: 'closed-loop', category: 'insight', htmlFile: 'closed-loop.html', featured_home: true },
  { slug: 'crm-theo-nganh', category: 'nganh', htmlFile: 'crm-theo-nganh.html' },
  { slug: 'portal-agency', category: 'insight', htmlFile: 'portal-agency.html' },
  { slug: 'demo-60-phut', category: 'huong-dan', htmlFile: 'demo-60-phut.html' },
  { slug: 'khong-dua-gia-seat', category: 'insight', htmlFile: 'khong-dua-gia-seat.html' },
  { slug: 'zalo-vietnam-pack', category: 'nganh', htmlFile: 'zalo-vietnam-pack.html' },
];

function extractAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = tag.match(re);
  return match?.[1] ?? null;
}

function extractI18n(html: string, tagName: string, locale: 'vi' | 'en'): string | null {
  const re = new RegExp(`<${tagName}[^>]*data-i18n[^>]*>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const vi = extractAttr(tag, 'data-vi');
    const en = extractAttr(tag, 'data-en');
    const value = locale === 'en' ? en ?? vi : vi ?? en;
    if (value) return value;
  }
  return null;
}

function extractSectionHtml(html: string, locale: 'vi' | 'en'): string {
  const marker = locale === 'vi' ? 'data-show-vi' : 'data-show-en';
  const openRe = new RegExp(`<div[^>]*${marker}[^>]*>`, 'i');
  const open = openRe.exec(html);
  if (!open) return '';
  const start = open.index + open[0].length;
  const closeIdx = html.indexOf('</div>', start);
  if (closeIdx < 0) return '';
  return html.slice(start, closeIdx);
}

function htmlSectionToMarkdown(sectionHtml: string): string {
  const parts: string[] = [];
  const blockRe = /<(h2|p)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(sectionHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    parts.push(tag === 'h2' ? `## ${text}` : text);
  }
  return parts.join('\n\n');
}

function firstParagraph(sectionHtml: string): string {
  const match = sectionHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return '';
  return match[1].replace(/<[^>]+>/g, '').trim();
}

export function resolveDemoHtmlDir(customDir?: string): string {
  if (customDir) return customDir;
  const candidates = [
    path.resolve(process.cwd(), '..', 'PTTCRM', 'demo-html', 'tin-tuc'),
    path.resolve(process.cwd(), '..', '..', 'PTTCRM', 'demo-html', 'tin-tuc'),
    path.resolve(__dirname, '..', '..', '..', '..', 'PTTCRM', 'demo-html', 'tin-tuc'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`demo-html tin-tuc directory not found (tried: ${candidates.join(', ')})`);
  }
  return found;
}

export function parseArticleHtml(htmlPath: string): {
  title_vi: string;
  title_en: string | null;
  dek_vi: string;
  dek_en: string | null;
  body_vi: string;
  body_en: string | null;
} {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const title_vi = extractI18n(html, 'h1', 'vi') ?? path.basename(htmlPath, '.html');
  const title_en = extractI18n(html, 'h1', 'en');
  const viSection = extractSectionHtml(html, 'vi');
  const enSection = extractSectionHtml(html, 'en');
  const body_vi = htmlSectionToMarkdown(viSection);
  const body_en = enSection ? htmlSectionToMarkdown(enSection) : null;
  const dek_vi = firstParagraph(viSection) || title_vi;
  const dek_en = enSection ? firstParagraph(enSection) || title_en : null;
  return { title_vi, title_en, dek_vi, dek_en, body_vi, body_en };
}

async function ensureCoverMedia(db: Pool, actor: string): Promise<string> {
  const existing = await db.query(
    `SELECT id FROM gtm_cms_media WHERE storage_key = 'cms/seed-cover.webp' LIMIT 1`,
  );
  if (existing.rows[0]?.id) {
    return String(existing.rows[0].id);
  }

  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/l3T1AAAAAElFTkSuQmCC';
  const bytes = Buffer.from(pngBase64, 'base64').length;

  const inserted = await db.query(
    `INSERT INTO gtm_cms_media (
       storage_key, public_url, mime, bytes, width, height,
       alt_vi, alt_en, credit, uploaded_by
     ) VALUES (
       'cms/seed-cover.webp',
       'https://cdn.pttcrm.com/cms/seed-cover.webp',
       'image/png', $1, 1, 1,
       'Ảnh minh họa PTTCRM', 'PTTCRM illustration', 'PTTCRM seed', $2
     ) RETURNING id`,
    [bytes, actor],
  );
  return String(inserted.rows[0].id);
}

export async function seedGtmCmsW0(
  db: Pool,
  opts?: { demoHtmlDir?: string; actor?: string },
): Promise<{ articles: number; events: number }> {
  const actor = opts?.actor ?? 'seed_gtm_cms_w0';
  const htmlDir = resolveDemoHtmlDir(opts?.demoHtmlDir);
  const coverMediaId = await ensureCoverMedia(db, actor);

  let articles = 0;
  for (const spec of SEED_ARTICLES) {
    const parsed = parseArticleHtml(path.join(htmlDir, spec.htmlFile));
    await db.query(
      `INSERT INTO gtm_cms_article (
         slug, category, status, published_at, cover_media_id,
         title_vi, title_en, dek_vi, dek_en, body_vi, body_en,
         featured_home, created_by, updated_by
       ) VALUES (
         $1, $2, 'published', COALESCE($3::timestamptz, NOW()), $4,
         $5, $6, $7, $8, $9, $10,
         $11, $12, $12
       )
       ON CONFLICT (slug) DO UPDATE SET
         category = EXCLUDED.category,
         status = EXCLUDED.status,
         published_at = EXCLUDED.published_at,
         cover_media_id = EXCLUDED.cover_media_id,
         title_vi = EXCLUDED.title_vi,
         title_en = EXCLUDED.title_en,
         dek_vi = EXCLUDED.dek_vi,
         dek_en = EXCLUDED.dek_en,
         body_vi = EXCLUDED.body_vi,
         body_en = EXCLUDED.body_en,
         featured_home = EXCLUDED.featured_home,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        spec.slug,
        spec.category,
        spec.published_at ?? null,
        coverMediaId,
        parsed.title_vi,
        parsed.title_en,
        parsed.dek_vi,
        parsed.dek_en,
        parsed.body_vi,
        parsed.body_en,
        spec.featured_home ?? false,
        actor,
      ],
    );
    articles += 1;
  }

  await db.query(
    `INSERT INTO gtm_cms_event (
       slug, kind, status, start_at, end_at, timezone, location_type,
       location_vi, location_en, title_vi, title_en, dek_vi, dek_en,
       body_vi, body_en, cover_media_id, cta_type, cta_url,
       created_by, updated_by
     ) VALUES (
       'demo-ngay-nganh', 'workshop', 'draft',
       '2026-09-15T14:00:00+07:00', '2026-09-15T16:00:00+07:00',
       'Asia/Ho_Chi_Minh', 'online',
       'Google Meet (link gửi sau đăng ký)', 'Google Meet (link sent after registration)',
       'Demo ngành ngành: BĐS, Agency, F&B',
       'Industry demo day: Real estate, Agency, F&B',
       'Buổi workshop 120 phút demo pipeline theo từng ngành trên data mẫu.',
       'A 120-minute workshop demoing industry pipelines on sample data.',
       '## Ba track song song\n\nTrack BĐS: lead dự án → lịch xem → booking.\n\nTrack Agency: multi-client ROAS và portal theo HĐ.\n\nTrack F&B: campaign → đặt chỗ.\n\nĐăng ký qua form demo — không self-serve.',
       '## Three parallel tracks\n\nReal estate: project lead → viewing → booking.\n\nAgency: multi-client ROAS and portal per contract.\n\nF&B: campaign → reservation.\n\nRegister via the demo form — no self-serve.',
       $1, 'demo', NULL,
       $2, $2
     )
     ON CONFLICT (slug) DO UPDATE SET
       status = 'draft',
       title_vi = EXCLUDED.title_vi,
       title_en = EXCLUDED.title_en,
       dek_vi = EXCLUDED.dek_vi,
       dek_en = EXCLUDED.dek_en,
       body_vi = EXCLUDED.body_vi,
       body_en = EXCLUDED.body_en,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [coverMediaId, actor],
  );

  return { articles, events: 1 };
}
