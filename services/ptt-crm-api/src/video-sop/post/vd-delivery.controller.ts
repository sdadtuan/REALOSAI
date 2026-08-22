import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import {
  StaffVdPostEditGuard,
  StaffVdProjectViewGuard,
} from '../guards/staff-vd-project.guard';
import { VdDeliveryService } from './vd-delivery.service';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'gate4_required',
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

@Controller('api/v1/vd/projects')
@UseGuards(StaffOrInternalKeyGuard)
export class VdDeliveryController {
  constructor(private readonly delivery: VdDeliveryService) {}

  @Get(':id/delivery')
  @UseGuards(StaffVdProjectViewGuard)
  async getDelivery(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.delivery.getDelivery(id);
    } catch (err) {
      mapKnownError(err);
    }
  }

  @Post(':id/delivery')
  @HttpCode(201)
  @UseGuards(StaffVdPostEditGuard)
  async createPackage(@Param('id', ParseIntPipe) id: number) {
    try {
      const pkg = await this.delivery.createPackage(id);
      return { package: pkg };
    } catch (err) {
      mapKnownError(err);
    }
  }
}
