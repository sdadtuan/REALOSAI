import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { assertPublishableArticle, assertPublishableEvent } from './cms-guard.util';
import { CmsRepository } from './cms.repository';
import { CmsStorageService } from './cms-storage.service';
import type {
  CmsArticleRow,
  CmsEventRow,
  CmsLocale,
  CmsMediaRow,
  CreateArticleBody,
  CreateEventBody,
  ListArticlesQuery,
  ListEventsQuery,
  ListPublicArticlesQuery,
  ListPublicEventsQuery,
  PatchArticleBody,
  PatchEventBody,
  PatchMediaBody,
  PublicArticleCard,
  PublicArticleDetail,
  PublicEventCard,
  PublicEventDetail,
  PublicSlotView,
  PublishArticleBody,
  PublishEventBody,
  PutSlotBody,
} from './cms.types';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const MAX_BYTES = 5_000_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const SLUG_RE = /^[a-z0-9-]+$/;

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'bin';
  }
}

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);
  private readonly rateLimitHits = new Map<string, number[]>();

  constructor(
    private readonly repo: CmsRepository,
    private readonly storage: CmsStorageService,
    private readonly config: AppConfigService,
  ) {}

  resetRateLimitsForTests(): void {
    this.rateLimitHits.clear();
  }

  isPublicRateLimited(ip: string): boolean {
    const now = Date.now();
    const hits = (this.rateLimitHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (hits.length >= RATE_LIMIT_MAX) {
      this.rateLimitHits.set(ip, hits);
      return true;
    }
    hits.push(now);
    this.rateLimitHits.set(ip, hits);
    return false;
  }

  async listPublicArticles(query: ListPublicArticlesQuery): Promise<PublicArticleCard[]> {
    const rows = await this.repo.listPublicArticles(query);
    const cards: PublicArticleCard[] = [];
    for (const row of rows) {
      const card = await this.toPublicArticleCard(row, query.locale);
      if (card) cards.push(card);
    }
    return cards;
  }

  async getPublicArticle(slug: string, locale: CmsLocale): Promise<PublicArticleDetail> {
    const row = await this.repo.getArticleBySlug(slug);
    if (!row || row.status !== 'published') {
      throw new NotFoundException({ error: 'not_found' });
    }
    const detail = await this.toPublicArticleDetail(row, locale);
    if (!detail) {
      throw new NotFoundException({ error: 'not_found' });
    }
    return detail;
  }

  async listPublicEvents(query: ListPublicEventsQuery): Promise<PublicEventCard[]> {
    const rows = await this.repo.listPublicEvents(query);
    const cards: PublicEventCard[] = [];
    for (const row of rows) {
      const card = await this.toPublicEventCard(row, query.locale);
      if (card) cards.push(card);
    }
    return cards;
  }

  async getPublicEvent(slug: string, locale: CmsLocale): Promise<PublicEventDetail> {
    const row = await this.repo.getEventBySlug(slug);
    if (!row || (row.status !== 'published' && row.status !== 'cancelled')) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const detail = await this.toPublicEventDetail(row, locale);
    if (!detail) {
      throw new NotFoundException({ error: 'not_found' });
    }
    return detail;
  }

  async listPublicSlots(keys: string[], locale: CmsLocale): Promise<PublicSlotView[]> {
    const rows = await this.repo.listSlots(keys);
    const out: PublicSlotView[] = [];
    for (const slot of rows) {
      const media = await this.repo.getMediaById(slot.media_id);
      if (!media || media.status !== 'active') continue;
      out.push({
        slot_key: slot.slot_key,
        media_url: media.public_url,
        media_alt: locale === 'en' ? media.alt_en ?? media.alt_vi : media.alt_vi,
        caption: locale === 'en' ? slot.caption_en ?? slot.caption_vi : slot.caption_vi,
      });
    }
    return out;
  }

  readLocalFile(storageKey: string): { buffer: Buffer; mime: string } | null {
    const buffer = this.storage.readLocalFile(storageKey);
    if (!buffer) return null;
    return { buffer, mime: this.storage.guessMime(storageKey) };
  }

  async listMedia(limit?: number, offset?: number): Promise<CmsMediaRow[]> {
    return this.repo.listMedia(limit, offset);
  }

  async uploadMedia(
    file: { buffer: Buffer; mimetype: string; size: number },
    actor: string,
    meta?: { alt_vi?: string; alt_en?: string; credit?: string },
  ): Promise<CmsMediaRow> {
    const mime = String(file.mimetype ?? '').trim().toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException({ error: 'invalid_mime' });
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException({ error: 'file_too_large' });
    }

    let width: number | null = null;
    let height: number | null = null;
    if (mime !== 'image/svg+xml') {
      try {
        const sharp = await import('sharp');
        const info = await sharp.default(file.buffer).metadata();
        width = info.width ?? null;
        height = info.height ?? null;
      } catch {
        /* ignore dimension probe failures */
      }
    }

    const uploaded = await this.storage.upload({
      buffer: file.buffer,
      mime,
      ext: extForMime(mime),
    });

    return this.repo.insertMedia({
      storage_key: uploaded.storageKey,
      public_url: uploaded.publicUrl,
      mime,
      bytes: file.size,
      width,
      height,
      alt_vi: meta?.alt_vi ?? null,
      alt_en: meta?.alt_en ?? null,
      credit: meta?.credit ?? null,
      uploaded_by: actor,
    });
  }

  async patchMedia(id: string, body: PatchMediaBody, actor: string): Promise<CmsMediaRow> {
    if (body.hard === true) {
      return this.archiveMedia(id, actor, { hard: true });
    }
    const row = await this.repo.patchMedia(id, body, actor);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async archiveMedia(
    id: string,
    actor: string,
    opts?: { hard?: boolean },
  ): Promise<CmsMediaRow> {
    const refs = await this.repo.mediaRefCount(id);
    if (refs > 0 && opts?.hard) {
      throw new ConflictException('media is referenced');
    }
    if (refs > 0) {
      const row = await this.repo.patchMedia(id, { status: 'archived' }, actor);
      if (!row) throw new NotFoundException({ error: 'not_found' });
      return row;
    }
    if (opts?.hard) {
      const existing = await this.repo.getMediaById(id);
      if (!existing) throw new NotFoundException({ error: 'not_found' });
      await this.repo.deleteMedia(id);
      return { ...existing, status: 'archived' };
    }
    const row = await this.repo.patchMedia(id, { status: 'archived' }, actor);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async listArticles(query: ListArticlesQuery) {
    return this.repo.listArticles(query);
  }

  async createArticle(body: CreateArticleBody, actor: string): Promise<CmsArticleRow> {
    this.assertSlug(body.slug);
    try {
      return await this.repo.insertArticle(body, actor);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException({ error: 'slug_exists' });
      }
      throw err;
    }
  }

  async patchArticle(id: string, body: PatchArticleBody, actor: string): Promise<CmsArticleRow> {
    if (body.slug != null) this.assertSlug(body.slug);
    const row = await this.repo.patchArticle(id, body, actor);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async publishArticle(id: string, actor: string, body?: PublishArticleBody): Promise<CmsArticleRow> {
    const row = await this.repo.getArticleById(id);
    if (!row) throw new NotFoundException({ error: 'not_found' });

    const publishEn =
      body?.locales?.includes('en') ?? (nonEmpty(row.title_en) || nonEmpty(row.body_en));
    const cover = row.cover_media_id ? await this.repo.getMediaById(row.cover_media_id) : null;

    try {
      assertPublishableArticle({
        cover_media_id: row.cover_media_id,
        title_vi: row.title_vi,
        body_vi: row.body_vi,
        alt_vi: cover?.alt_vi,
        title_en: row.title_en,
        body_en: row.body_en,
        alt_en: cover?.alt_en,
        dek_vi: row.dek_vi,
        dek_en: row.dek_en,
        seo_title_vi: row.seo_title_vi,
        seo_title_en: row.seo_title_en,
        seo_desc_vi: row.seo_desc_vi,
        seo_desc_en: row.seo_desc_en,
        publish_en: publishEn,
      });
    } catch (err) {
      throw new UnprocessableEntityException(
        err instanceof Error ? err.message : 'publish_validation_failed',
      );
    }

    const updated = await this.repo.setArticleStatus(id, 'published', actor, new Date());
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.revalidate(['articles', 'sitemap']);
    return updated;
  }

  async unpublishArticle(id: string, actor: string): Promise<CmsArticleRow> {
    const updated = await this.repo.setArticleStatus(id, 'draft', actor, null);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.revalidate(['articles', 'sitemap']);
    return updated;
  }

  async listEvents(query: ListEventsQuery) {
    return this.repo.listEvents(query);
  }

  async createEvent(body: CreateEventBody, actor: string): Promise<CmsEventRow> {
    this.assertSlug(body.slug);
    try {
      return await this.repo.insertEvent(body, actor);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException({ error: 'slug_exists' });
      }
      throw err;
    }
  }

  async patchEvent(id: string, body: PatchEventBody, actor: string): Promise<CmsEventRow> {
    if (body.slug != null) this.assertSlug(body.slug);
    const row = await this.repo.patchEvent(id, body, actor);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async publishEvent(id: string, actor: string, body?: PublishEventBody): Promise<CmsEventRow> {
    const row = await this.repo.getEventById(id);
    if (!row) throw new NotFoundException({ error: 'not_found' });

    try {
      assertPublishableEvent({
        start_at: row.start_at,
        end_at: row.end_at,
        cta_type: row.cta_type,
        cta_url: row.cta_url,
        title_vi: row.title_vi,
        title_en: row.title_en,
        dek_vi: row.dek_vi,
        dek_en: row.dek_en,
        body_vi: row.body_vi,
        body_en: row.body_en,
        location_vi: row.location_vi,
        location_en: row.location_en,
      });
    } catch (err) {
      throw new UnprocessableEntityException({
        error: err instanceof Error ? err.message : 'publish_validation_failed',
      });
    }

    const updated = await this.repo.setEventStatus(id, 'published', actor, new Date());
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.revalidate(['events', 'sitemap']);
    return updated;
  }

  async unpublishEvent(id: string, actor: string): Promise<CmsEventRow> {
    const updated = await this.repo.setEventStatus(id, 'draft', actor, null);
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    await this.revalidate(['events', 'sitemap']);
    return updated;
  }

  async getSlot(slotKey: string) {
    const row = await this.repo.getSlot(slotKey);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async putSlot(slotKey: string, body: PutSlotBody, actor: string) {
    const media = await this.repo.getMediaById(body.media_id);
    if (!media || media.status !== 'active') {
      throw new BadRequestException({ error: 'invalid_media' });
    }
    const row = await this.repo.upsertSlot(slotKey, body, actor);
    await this.revalidate(['slots', 'sitemap']);
    return row;
  }

  private async toPublicArticleCard(
    row: CmsArticleRow,
    locale: CmsLocale,
  ): Promise<PublicArticleCard | null> {
    if (row.status !== 'published') return null;
    if (locale === 'en' && (!nonEmpty(row.title_en) || !nonEmpty(row.body_en))) {
      return null;
    }
    const cover = row.cover_media_id ? await this.repo.getMediaById(row.cover_media_id) : null;
    return {
      slug: row.slug,
      category: row.category,
      status: row.status,
      published_at: row.published_at,
      title: locale === 'en' ? String(row.title_en) : row.title_vi,
      dek: locale === 'en' ? String(row.dek_en ?? row.dek_vi) : row.dek_vi,
      cover_url: cover?.public_url ?? null,
      cover_alt:
        locale === 'en'
          ? cover?.alt_en ?? cover?.alt_vi ?? null
          : cover?.alt_vi ?? null,
      featured_home: row.featured_home,
    };
  }

  private async toPublicArticleDetail(
    row: CmsArticleRow,
    locale: CmsLocale,
  ): Promise<PublicArticleDetail | null> {
    const card = await this.toPublicArticleCard(row, locale);
    if (!card) return null;
    return {
      ...card,
      body: locale === 'en' ? String(row.body_en) : row.body_vi,
      seo_title:
        locale === 'en'
          ? row.seo_title_en ?? row.seo_title_vi
          : row.seo_title_vi ?? row.title_vi,
      seo_desc:
        locale === 'en' ? row.seo_desc_en ?? row.seo_desc_vi : row.seo_desc_vi ?? row.dek_vi,
    };
  }

  private async toPublicEventCard(
    row: CmsEventRow,
    locale: CmsLocale,
  ): Promise<PublicEventCard | null> {
    if (row.status !== 'published' && row.status !== 'cancelled') return null;
    if (locale === 'en' && (!nonEmpty(row.title_en) || !nonEmpty(row.body_en))) {
      return null;
    }
    const cover = row.cover_media_id ? await this.repo.getMediaById(row.cover_media_id) : null;
    return {
      slug: row.slug,
      kind: row.kind,
      status: row.status,
      start_at: row.start_at,
      end_at: row.end_at,
      timezone: row.timezone,
      location_type: row.location_type,
      location:
        locale === 'en'
          ? row.location_en ?? row.location_vi
          : row.location_vi ?? row.location_en,
      title: locale === 'en' ? String(row.title_en) : row.title_vi,
      dek: locale === 'en' ? String(row.dek_en ?? row.dek_vi) : row.dek_vi,
      cover_url: cover?.public_url ?? null,
      cover_alt:
        locale === 'en'
          ? cover?.alt_en ?? cover?.alt_vi ?? null
          : cover?.alt_vi ?? null,
      cta_type: row.cta_type,
      cta_url: row.cta_url,
    };
  }

  private async toPublicEventDetail(
    row: CmsEventRow,
    locale: CmsLocale,
  ): Promise<PublicEventDetail | null> {
    const card = await this.toPublicEventCard(row, locale);
    if (!card) return null;
    return {
      ...card,
      body: locale === 'en' ? String(row.body_en) : row.body_vi,
    };
  }

  private assertSlug(slug: string): void {
    if (!SLUG_RE.test(slug)) {
      throw new BadRequestException({ error: 'invalid_slug' });
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
  }

  async revalidate(tags: string[]): Promise<void> {
    const url = this.config.cmsRevalidateUrl;
    if (!url) return;
    const secret = this.config.cmsRevalidateSecret ?? '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cms-secret': secret,
          },
          body: JSON.stringify({ tags }),
        });
        if (!res.ok) {
          throw new Error(`revalidate_status_${res.status}`);
        }
        return;
      } catch (err) {
        this.logger.warn(
          `CMS revalidate attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
