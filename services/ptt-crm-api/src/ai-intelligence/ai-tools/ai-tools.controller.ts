import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffAiAdminGuard } from '../guards/staff-ai-admin.guard';
import {
  AiToolApiKeyGuard,
  AiToolAuthenticatedRequest,
} from './ai-tool-api-key.guard';
import { AiToolApiKeyRecord, AiToolDescriptor } from './ai-tools.types';
import { AiToolsService } from './ai-tools.service';

interface CallToolBody {
  tool_name: string;
  input?: Record<string, unknown>;
}

interface CreateToolKeyBody {
  name: string;
  allowed_tools: string[];
  client_id?: string | null;
}

type StaffRequest = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

@Controller()
export class AiToolsController {
  constructor(private readonly tools: AiToolsService) {}

  @Get('api/v1/ai/tools')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  listTools(): { tools: AiToolDescriptor[] } {
    return { tools: this.tools.list() };
  }

  @Post('api/v1/ai/tools/call')
  @UseGuards(AiToolApiKeyGuard)
  async callTool(
    @Body() body: CallToolBody,
    @Req() req: AiToolAuthenticatedRequest,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ tool_name: string; result: unknown }> {
    const toolName = String(body?.tool_name ?? '').trim();
    const apiKey = req.aiToolApiKey;
    const result = await this.tools.call({
      toolName,
      input: body?.input ?? {},
      apiKey,
      actorId: apiKey
        ? `ai-tool-key:${apiKey.id}`
        : req.staffUser?.sub ?? req.staffUser?.email ?? null,
      correlationId: correlationId?.trim() || requestId?.trim() || undefined,
    });
    return { tool_name: toolName, result };
  }

  @Post('api/v1/admin/ai/tool-keys')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  async createKey(
    @Body() body: CreateToolKeyBody,
    @Req() req: StaffRequest,
  ): Promise<{ id: string; key: string; key_prefix: string }> {
    const created = await this.tools.createKey({
      name: body?.name,
      allowedTools: body?.allowed_tools ?? [],
      clientId: body?.client_id ?? null,
      createdBy:
        req.staffAuthVia === 'internal'
          ? 'system'
          : req.staffUser?.sub ?? req.staffUser?.email ?? null,
    });
    return {
      id: created.id,
      key: created.plaintextKey,
      key_prefix: created.keyPrefix,
    };
  }

  @Get('api/v1/admin/ai/tool-keys')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  async listKeys(): Promise<{ keys: AiToolApiKeyRecord[] }> {
    return { keys: await this.tools.listKeys() };
  }

  @Delete('api/v1/admin/ai/tool-keys/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  async revokeKey(
    @Param('id') id: string,
  ): Promise<{ id: string; revoked: true }> {
    await this.tools.revokeKey(id);
    return { id, revoked: true };
  }
}
