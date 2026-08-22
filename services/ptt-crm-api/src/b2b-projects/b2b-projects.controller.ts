import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import {
  StaffB2bProjectsManageGuard,
  StaffB2bProjectsViewGuard,
} from './guards/staff-b2b-projects.guard';
import { B2bProjectsService } from './b2b-projects.service';
import type {
  B2bProjectChannelInput,
  B2bProjectPageInput,
  B2bProjectStaffInput,
  CreateB2bProjectBody,
  PatchB2bProjectBody,
} from './b2b-projects.types';

@Controller('api/v1/b2b-projects')
@UseGuards(StaffOrInternalKeyGuard)
export class B2bProjectsController {
  constructor(private readonly projects: B2bProjectsService) {}

  @Get()
  @UseGuards(StaffB2bProjectsViewGuard)
  list(@Query('status') status?: string) {
    return this.projects.list(status);
  }

  @Post()
  @UseGuards(StaffB2bProjectsManageGuard)
  create(@Body() body: CreateB2bProjectBody) {
    return this.projects.create(body);
  }

  @Get(':id')
  @UseGuards(StaffB2bProjectsViewGuard)
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Patch(':id')
  @UseGuards(StaffB2bProjectsManageGuard)
  patch(@Param('id') id: string, @Body() body: PatchB2bProjectBody) {
    return this.projects.patch(id, body);
  }

  @Put(':id/pages')
  @UseGuards(StaffB2bProjectsManageGuard)
  replacePages(@Param('id') id: string, @Body() body: { pages: B2bProjectPageInput[] }) {
    return this.projects.replacePages(id, body.pages ?? []);
  }

  @Put(':id/channels')
  @UseGuards(StaffB2bProjectsManageGuard)
  replaceChannels(@Param('id') id: string, @Body() body: { channels: B2bProjectChannelInput[] }) {
    return this.projects.replaceChannels(id, body.channels ?? []);
  }

  @Put(':id/staff')
  @UseGuards(StaffB2bProjectsManageGuard)
  replaceStaff(@Param('id') id: string, @Body() body: { staff: B2bProjectStaffInput[] }) {
    return this.projects.replaceStaff(id, body.staff ?? []);
  }

  @Get(':id/pages')
  @UseGuards(StaffB2bProjectsViewGuard)
  listPages(@Param('id') id: string) {
    return this.projects.listPages(id);
  }

  @Get(':id/channels')
  @UseGuards(StaffB2bProjectsViewGuard)
  listChannels(@Param('id') id: string) {
    return this.projects.listChannels(id);
  }

  @Get(':id/staff')
  @UseGuards(StaffB2bProjectsViewGuard)
  listStaff(@Param('id') id: string) {
    return this.projects.listStaff(id);
  }
}
