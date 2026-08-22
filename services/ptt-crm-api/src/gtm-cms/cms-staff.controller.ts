import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CmsService } from './cms.service';
import type {
  CmsArticleCategory,
  CmsArticleStatus,
  CmsEventStatus,
  CreateArticleBody,
  CreateEventBody,
  PatchArticleBody,
  PatchEventBody,
  PatchMediaBody,
  PublishArticleBody,
  PublishEventBody,
  PutSlotBody,
} from './cms.types';
import {
  StaffGtmCmsPublishGuard,
  StaffGtmCmsViewGuard,
  StaffGtmCmsWriteGuard,
} from './guards/staff-gtm-cms.guard';

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actor(req: StaffReq): string {
  return req.staffUser?.sub ?? 'internal';
}

const MAX_UPLOAD = 5_000_000;

@Controller('api/v1/gtm/cms')
@UseGuards(StaffOrInternalKeyGuard)
export class CmsStaffController {
  constructor(private readonly cms: CmsService) {}

  @Get('media')
  @UseGuards(StaffGtmCmsViewGuard)
  listMedia(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.cms.listMedia(
      limit != null ? Number(limit) : undefined,
      offset != null ? Number(offset) : undefined,
    );
  }

  @Post('media')
  @UseGuards(StaffGtmCmsWriteGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD },
    }),
  )
  uploadMedia(
    @Req() req: StaffReq,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { alt_vi?: string; alt_en?: string; credit?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'file_required' });
    }
    return this.cms.uploadMedia(
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size },
      actor(req),
      {
        alt_vi: body.alt_vi,
        alt_en: body.alt_en,
        credit: body.credit,
      },
    );
  }

  @Patch('media/:id')
  @UseGuards(StaffGtmCmsWriteGuard)
  patchMedia(@Req() req: StaffReq, @Param('id') id: string, @Body() body: PatchMediaBody) {
    return this.cms.patchMedia(id, body, actor(req));
  }

  @Get('articles')
  @UseGuards(StaffGtmCmsViewGuard)
  listArticles(
    @Query('status') status?: CmsArticleStatus,
    @Query('category') category?: CmsArticleCategory,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.cms.listArticles({
      status,
      category,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Post('articles')
  @UseGuards(StaffGtmCmsWriteGuard)
  createArticle(@Req() req: StaffReq, @Body() body: CreateArticleBody) {
    return this.cms.createArticle(body, actor(req));
  }

  @Patch('articles/:id')
  @UseGuards(StaffGtmCmsWriteGuard)
  patchArticle(@Req() req: StaffReq, @Param('id') id: string, @Body() body: PatchArticleBody) {
    return this.cms.patchArticle(id, body, actor(req));
  }

  @Post('articles/:id/publish')
  @UseGuards(StaffGtmCmsPublishGuard)
  publishArticle(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: PublishArticleBody,
  ) {
    return this.cms.publishArticle(id, actor(req), body);
  }

  @Post('articles/:id/unpublish')
  @UseGuards(StaffGtmCmsPublishGuard)
  unpublishArticle(@Req() req: StaffReq, @Param('id') id: string) {
    return this.cms.unpublishArticle(id, actor(req));
  }

  @Get('events')
  @UseGuards(StaffGtmCmsViewGuard)
  listEvents(
    @Query('status') status?: CmsEventStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.cms.listEvents({
      status,
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Post('events')
  @UseGuards(StaffGtmCmsWriteGuard)
  createEvent(@Req() req: StaffReq, @Body() body: CreateEventBody) {
    return this.cms.createEvent(body, actor(req));
  }

  @Patch('events/:id')
  @UseGuards(StaffGtmCmsWriteGuard)
  patchEvent(@Req() req: StaffReq, @Param('id') id: string, @Body() body: PatchEventBody) {
    return this.cms.patchEvent(id, body, actor(req));
  }

  @Post('events/:id/publish')
  @UseGuards(StaffGtmCmsPublishGuard)
  publishEvent(
    @Req() req: StaffReq,
    @Param('id') id: string,
    @Body() body: PublishEventBody,
  ) {
    return this.cms.publishEvent(id, actor(req), body);
  }

  @Post('events/:id/unpublish')
  @UseGuards(StaffGtmCmsPublishGuard)
  unpublishEvent(@Req() req: StaffReq, @Param('id') id: string) {
    return this.cms.unpublishEvent(id, actor(req));
  }

  @Get('slots/:slot_key')
  @UseGuards(StaffGtmCmsViewGuard)
  getSlot(@Param('slot_key') slotKey: string) {
    return this.cms.getSlot(slotKey);
  }

  @Put('slots/:slot_key')
  @UseGuards(StaffGtmCmsWriteGuard)
  putSlot(@Req() req: StaffReq, @Param('slot_key') slotKey: string, @Body() body: PutSlotBody) {
    return this.cms.putSlot(slotKey, body, actor(req));
  }
}
