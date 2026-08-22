import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdQcEditGuard } from '../guards/staff-vd-project.guard';
import { VdReviewService } from './vd-review.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'ttl_exceeded',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Controller('api/v1/vd/review-links')
@UseGuards(StaffOrInternalKeyGuard, StaffVdQcEditGuard)
export class VdReviewController {
  constructor(private readonly reviews: VdReviewService) {}

  @Post()
  @HttpCode(201)
  async createLink(@Body() body: Record<string, unknown>) {
    try {
      return await this.reviews.createLink(body ?? {});
    } catch (err) {
      mapKnownError(err);
    }
  }
}
