import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { VdReviewService } from './vd-review.service';

const HTTP_400 = new Set(['cmkt_cinematic_disabled', 'invalid_body']);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'review_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (msg === 'review_expired') {
    throw new ForbiddenException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/public/vd/review')
export class VdPublicReviewController {
  constructor(private readonly reviews: VdReviewService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  async getReview(@Param('token') token: string) {
    try {
      return await this.reviews.getPublicReview(token);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':token/comments')
  @HttpCode(201)
  async addComment(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    try {
      return await this.reviews.addComment(token, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':token/approve')
  @HttpCode(200)
  async approve(@Param('token') token: string) {
    try {
      return await this.reviews.approveFromPortal(token);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':token/request-changes')
  @HttpCode(200)
  async requestChanges(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    try {
      return await this.reviews.requestChangesFromPortal(token, body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }
}
