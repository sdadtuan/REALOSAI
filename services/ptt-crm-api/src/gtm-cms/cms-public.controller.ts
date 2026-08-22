import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CmsService } from './cms.service';
import type { CmsArticleCategory, CmsEventWhen, CmsLocale } from './cms.types';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || '0.0.0.0';
  }
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

function parseLocale(raw: string | undefined): CmsLocale {
  return raw === 'en' ? 'en' : 'vi';
}

@Controller('api/v1/public/cms')
export class CmsPublicController {
  constructor(private readonly cms: CmsService) {}

  private checkRateLimit(req: Request): void {
    if (this.cms.isPublicRateLimited(clientIp(req))) {
      throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  @Get('articles')
  listArticles(
    @Req() req: Request,
    @Query('locale') locale?: string,
    @Query('category') category?: CmsArticleCategory,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.checkRateLimit(req);
    return this.cms.listPublicArticles({
      locale: parseLocale(locale),
      category,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Get('articles/:slug')
  getArticle(@Req() req: Request, @Param('slug') slug: string, @Query('locale') locale?: string) {
    this.checkRateLimit(req);
    return this.cms.getPublicArticle(slug, parseLocale(locale));
  }

  @Get('events')
  listEvents(
    @Req() req: Request,
    @Query('locale') locale?: string,
    @Query('when') when?: CmsEventWhen,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.checkRateLimit(req);
    return this.cms.listPublicEvents({
      locale: parseLocale(locale),
      when,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Get('events/:slug')
  getEvent(@Req() req: Request, @Param('slug') slug: string, @Query('locale') locale?: string) {
    this.checkRateLimit(req);
    return this.cms.getPublicEvent(slug, parseLocale(locale));
  }

  @Get('slots')
  listSlots(@Req() req: Request, @Query('keys') keys?: string, @Query('locale') locale?: string) {
    this.checkRateLimit(req);
    const keyList = (keys ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    return this.cms.listPublicSlots(keyList, parseLocale(locale));
  }

  @Get('files/*path')
  serveLocalFile(@Param('path') storageKey: string, @Res() res: Response) {
    if (!storageKey || process.env.NODE_ENV === 'production') {
      throw new NotFoundException({ error: 'not_found' });
    }
    const file = this.cms.readLocalFile(storageKey);
    if (!file) {
      throw new NotFoundException({ error: 'not_found' });
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.buffer);
  }
}
