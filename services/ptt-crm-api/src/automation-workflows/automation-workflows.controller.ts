import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { AutomationWorkflowsService } from './automation-workflows.service';
import {
  CreateWorkflowBody,
  SimulateWorkflowBody,
  UpdateWorkflowBody,
  UpsertWorkflowNodeBody,
} from './automation-workflows.types';
import {
  StaffAutomationConfigureGuard,
  StaffAutomationSimulateGuard,
  StaffAutomationViewGuard,
} from './guards/staff-automation-workflows.guard';

@Controller('api/v1/automation-workflows')
@UseGuards(StaffOrInternalKeyGuard)
export class AutomationWorkflowsController {
  constructor(private readonly workflows: AutomationWorkflowsService) {}

  @Get()
  @UseGuards(StaffAutomationViewGuard)
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.list(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
      correlationId?.trim() || requestId?.trim(),
    );
  }

  @Get(':id')
  @UseGuards(StaffAutomationViewGuard)
  getById(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.getById(id, correlationId?.trim() || requestId?.trim());
  }

  @Post()
  @UseGuards(StaffAutomationConfigureGuard)
  create(
    @Body() body: CreateWorkflowBody,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.create(body, null, correlationId?.trim() || requestId?.trim());
  }

  @Patch(':id')
  @UseGuards(StaffAutomationConfigureGuard)
  update(
    @Param('id') id: string,
    @Body() body: UpdateWorkflowBody,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.update(id, body, correlationId?.trim() || requestId?.trim());
  }

  @Put(':id/nodes')
  @UseGuards(StaffAutomationConfigureGuard)
  replaceNodes(
    @Param('id') id: string,
    @Body() body: { nodes?: UpsertWorkflowNodeBody[] },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.replaceNodes(id, body.nodes ?? [], correlationId?.trim() || requestId?.trim());
  }

  @Post(':id/activate')
  @UseGuards(StaffAutomationConfigureGuard)
  activate(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.activate(id, correlationId?.trim() || requestId?.trim());
  }

  @Post(':id/deactivate')
  @UseGuards(StaffAutomationConfigureGuard)
  deactivate(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.deactivate(id, correlationId?.trim() || requestId?.trim());
  }

  /** RNOS-15 — dry-run simulate; does not mutate ai_scores or production entities. */
  @Post(':id/simulate')
  @UseGuards(StaffAutomationSimulateGuard)
  simulate(
    @Param('id') id: string,
    @Body() body: SimulateWorkflowBody,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.workflows.simulate(id, body, correlationId?.trim() || requestId?.trim());
  }
}
