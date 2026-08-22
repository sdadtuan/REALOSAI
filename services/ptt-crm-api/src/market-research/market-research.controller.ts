import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { resolveStaffClientScope } from '../staff-client-scope/staff-client-scope.http.util';
import { MarketResearchEnabledGuard } from './guards/market-research-enabled.guard';
import {
  StaffMarketResearchApproveGuard,
  StaffMarketResearchConfigureGuard,
  StaffMarketResearchCreateGuard,
  StaffMarketResearchEditGuard,
  StaffMarketResearchExportGuard,
  StaffMarketResearchRunGuard,
  StaffMarketResearchViewGuard,
  StaffMarketResearchWhatIfGuard,
  StaffResearchContentWriteGuard,
  StaffResearchMktplanEditGuard,
} from './guards/staff-market-research.guard';
import { MarketResearchService } from './market-research.service';
import type {
  ApproveInsightInput,
  AttachInsightEvidenceInput,
  AttachInsightThemeInput,
  CreateTaxonomyInput,
  PatchTaxonomyInput,
  CreateCompetitorInput,
  CreateCompetitorSnapshotInput,
  CreateConsentInput,
  CreateEvidenceInput,
  CreateInsightInput,
  CreateProjectInput,
  CreateQuestionInput,
  InsertPlanInsightsInput,
  CreateReportInput,
  CreateSourceInput,
  InsightCopilotInput,
  CreateStudyInput,
  CreateWaveInput,
  CreateDecisionInput,
  PatchDecisionInput,
  PatchCompetitorInput,
  PatchStudyInput,
  PatchEvidenceInput,
  PatchInsightInput,
  PatchProjectInput,
  SubmitReviewInput,
  PatchQuestionInput,
  PatchSourceInput,
  ReportCopilotInput,
  PublishPortalInput,
  UpdateExecEnInput,
  UpdateReportEmbargoInput,
  RunDeepInput,
  RunDeskInput,
  RunPulseInput,
  RunSparktoroInput,
  RunTalkwalkerInput,
  RunQualtricsInput,
} from './market-research.types';

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const WHISPER_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a']);
const SURVEY_CSV_MAX_BYTES = 2 * 1024 * 1024;
const SURVEY_CSV_MIME = new Set(['text/csv', 'text/plain', 'application/csv']);
const WHISPER_MIME_EXT: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
};

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

function actorEmail(req: StaffReq): string {
  if (req.staffAuthVia === 'internal') return 'internal';
  return req.staffUser?.email ?? 'unknown';
}

@Controller('api/v1/research')
@UseGuards(MarketResearchEnabledGuard)
export class MarketResearchController {
  constructor(
    private readonly research: MarketResearchService,
    private readonly clientScope: StaffClientScopeService,
  ) {}

  @Get('health')
  health() {
    return this.research.health();
  }

  @Get('prefill')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchCreateGuard)
  async getPrefill(@Req() req: StaffReq, @Query('client_id') clientId?: string) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getPrefill(scope, clientId ?? '');
  }

  @Get('insights')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listApprovedInsights(@Req() req: StaffReq, @Query('client_id') clientId?: string) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listApprovedInsightsForClient(scope, clientId ?? '');
  }

  @Get('insights/search')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async searchInsights(
    @Req() req: StaffReq,
    @Query() query: { q?: string; theme_code?: string; client_id?: string; limit?: string; stale_only?: string },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.searchInsights(scope, query);
  }

  @Get('rag/reembed/preview')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchConfigureGuard)
  async previewRagReembed(
    @Req() req: StaffReq,
    @Query() query: { client_id?: string },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.previewRagReembed(scope, query ?? {});
  }

  @Post('rag/reembed')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchConfigureGuard)
  async startRagReembed(
    @Req() req: StaffReq,
    @Body() body: { client_id?: string; limit?: number; dry_run?: boolean },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.startRagReembed(scope, body ?? {}, actorEmail(req));
  }

  @Get('taxonomy')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listTaxonomy() {
    return this.research.listTaxonomy();
  }

  @Post('taxonomy')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchConfigureGuard)
  async createTaxonomy(@Body() body: CreateTaxonomyInput) {
    return this.research.createTaxonomy(body ?? ({} as CreateTaxonomyInput));
  }

  @Patch('taxonomy/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchConfigureGuard)
  async patchTaxonomy(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchTaxonomyInput,
  ) {
    return this.research.patchTaxonomy(id, body ?? {});
  }

  @Post('plans/:planId/insights')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard, StaffResearchMktplanEditGuard)
  async insertPlanInsights(
    @Req() req: StaffReq,
    @Param('planId', ParseIntPipe) planId: number,
    @Body() body: InsertPlanInsightsInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.insertPlanInsights(
      planId,
      scope,
      body ?? ({ client_id: '', insight_ids: [] } as InsertPlanInsightsInput),
      actorEmail(req),
    );
  }

  @Post('content-items/:itemId/insights')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard, StaffResearchContentWriteGuard)
  async insertContentInsights(
    @Req() req: StaffReq,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: InsertPlanInsightsInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.insertContentInsights(
      itemId,
      scope,
      body ?? ({ client_id: '', insight_ids: [] } as InsertPlanInsightsInput),
      actorEmail(req),
    );
  }

  @Get('analytics/ops')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getOpsAnalytics(@Req() req: StaffReq, @Query('client_id') clientId?: string) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getOpsAnalytics(scope, clientId);
  }

  @Get('analytics/themes')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getThemeQuarterAnalytics(
    @Req() req: StaffReq,
    @Query('client_id') clientId?: string,
    @Query('year') yearStr?: string,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const year =
      yearStr != null && yearStr.trim() !== '' ? Number(yearStr.trim()) : undefined;
    return this.research.getThemeQuarterAnalytics(scope, { client_id: clientId, year });
  }

  @Get('projects')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listProjects(
    @Req() req: StaffReq,
    @Query('client_id') clientId?: string,
    @Query('status') status?: string,
    @Query('product_type') productType?: string,
    @Query('q') q?: string,
    @Query('lifecycle_id') lifecycleId?: string,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const lifecycleNum = lifecycleId != null && lifecycleId !== '' ? Number(lifecycleId) : undefined;
    return this.research.listProjects(scope, {
      client_id: clientId,
      status,
      product_type: productType,
      q,
      lifecycle_id: lifecycleNum != null && Number.isFinite(lifecycleNum) ? lifecycleNum : undefined,
    });
  }

  @Post('projects')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchCreateGuard)
  async createProject(@Req() req: StaffReq, @Body() body: CreateProjectInput) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createProject(scope, body ?? ({} as CreateProjectInput), actorEmail(req));
  }

  @Get('projects/:id/governance/iso-gap')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getIsoGapCheck(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getIsoGapCheck(id, scope);
  }

  @Get('projects/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getProject(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getProject(id, scope);
  }

  @Patch('projects/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchProject(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchProjectInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchProject(id, scope, body ?? {}, actorEmail(req));
  }

  @Post('projects/:id/questions')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async addQuestion(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateQuestionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.addQuestion(id, scope, body ?? ({} as CreateQuestionInput));
  }

  @Patch('questions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchQuestion(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchQuestionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchQuestion(id, scope, body ?? {});
  }

  @Delete('questions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async deleteQuestion(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.deleteQuestion(id, scope);
  }

  @Post('projects/:id/run-desk')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runDesk(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunDeskInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runDesk(id, scope, body ?? ({} as RunDeskInput), actorEmail(req));
  }

  @Post('projects/:id/run-deep')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runDeep(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunDeepInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runDeep(id, scope, body ?? ({} as RunDeepInput), actorEmail(req));
  }

  @Post('projects/:id/questions/:qid/run-triangulate')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runTriangulate(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('qid', ParseIntPipe) qid: number,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runTriangulate(id, qid, scope, actorEmail(req));
  }

  @Post('projects/:id/run-pulse')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runPulse(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunPulseInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.runPulse(id, scope, body ?? {}, actorEmail(req));
  }

  @Post('projects/:id/run-sparktoro')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runSparktoro(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunSparktoroInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const out = await this.research.runSparktoro(
      id,
      scope,
      body ?? ({} as RunSparktoroInput),
      actorEmail(req),
    );
    res.status(out.note === 'sparktoro_disabled' ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return out;
  }

  @Post('projects/:id/run-talkwalker')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runTalkwalker(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunTalkwalkerInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const out = await this.research.runTalkwalker(
      id,
      scope,
      body ?? ({} as RunTalkwalkerInput),
      actorEmail(req),
    );
    res.status(out.note === 'talkwalker_disabled' ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return out;
  }

  @Post('projects/:id/run-qualtrics')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async runQualtrics(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RunQualtricsInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const out = await this.research.runQualtrics(
      id,
      scope,
      body ?? ({} as RunQualtricsInput),
      actorEmail(req),
    );
    res.status('note' in out && out.note === 'qualtrics_disabled' ? HttpStatus.OK : HttpStatus.ACCEPTED);
    return out;
  }

  @Get('projects/:id/jobs/:runId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getJob(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('runId', ParseIntPipe) runId: number,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getJob(id, runId, scope);
  }

  @Post('projects/:id/sources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createSource(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSourceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createSource(id, scope, body ?? ({} as CreateSourceInput));
  }

  @Get('projects/:id/competitors')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listCompetitors(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listCompetitors(id, scope);
  }

  @Post('projects/:id/competitors')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createCompetitor(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateCompetitorInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createCompetitor(id, scope, body ?? ({} as CreateCompetitorInput), actorEmail(req));
  }

  @Patch('competitors/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchCompetitor(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchCompetitorInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchCompetitor(id, scope, body ?? {});
  }

  @Post('competitors/:id/snapshots')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createSnapshot(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateCompetitorSnapshotInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createSnapshot(
      id,
      scope,
      body ?? ({} as CreateCompetitorSnapshotInput),
      actorEmail(req),
    );
  }

  @Get('projects/:id/studies')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listStudies(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listStudies(id, scope);
  }

  @Post('projects/:id/studies')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createStudy(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateStudyInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createStudy(id, scope, body ?? ({} as CreateStudyInput), actorEmail(req));
  }

  @Post('projects/:id/import-survey')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: SURVEY_CSV_MAX_BYTES },
    }),
  )
  async importSurvey(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['file is required'],
      });
    }
    const mime = String(file.mimetype ?? '').trim().toLowerCase();
    if (!SURVEY_CSV_MIME.has(mime)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['file mime is invalid'],
      });
    }
    const body = (req.body ?? {}) as {
      format?: string;
      study_id?: string;
      expert_review?: string;
      period_note?: string;
      geography?: string;
      unit?: string;
    };
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const rawStudyId = body.study_id;
    return this.research.importSurvey(
      id,
      scope,
      {
        csvText: file.buffer.toString('utf8'),
        format: body.format ?? '',
        studyId: rawStudyId != null && String(rawStudyId).trim() !== '' ? Number(rawStudyId) : null,
        expertReview: body.expert_review,
        periodNote: body.period_note,
        geography: body.geography,
        unit: body.unit,
      },
      actorEmail(req),
    );
  }

  @Post('projects/:id/studies/:studyId/whisper')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: WHISPER_MAX_BYTES },
    }),
  )
  async ingestWhisper(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('studyId', ParseIntPipe) studyId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query('question_id') questionId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['file is required'],
      });
    }
    const mime = String(file.mimetype ?? '').trim().toLowerCase();
    if (!WHISPER_MIME.has(mime)) {
      throw new BadRequestException({
        error: 'validation_error',
        messages: ['file mime is invalid'],
      });
    }
    const scope = await resolveStaffClientScope(req, this.clientScope);
    const rawQid = (req.body as { question_id?: string } | undefined)?.question_id ?? questionId;
    const ext = WHISPER_MIME_EXT[mime] ?? '';
    const tempPath = join(tmpdir(), `research-whisper-${randomUUID()}${ext}`);
    await writeFile(tempPath, file.buffer);
    return this.research.ingestWhisper(
      id,
      studyId,
      scope,
      {
        tempPath,
        mime,
        questionId: rawQid != null && String(rawQid).trim() !== '' ? Number(rawQid) : null,
      },
      actorEmail(req),
    );
  }

  @Get('projects/:id/waves')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listWaves(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listWaves(id, scope);
  }

  @Post('projects/:id/waves')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createWave(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateWaveInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createWave(id, scope, body ?? ({} as CreateWaveInput), actorEmail(req));
  }

  @Get('projects/:id/van-westendorp')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getVanWestendorp(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getVanWestendorp(id, scope);
  }

  @Post('projects/:id/van-westendorp')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createVanWestendorp(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { study_id?: number | null },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createVanWestendorp(id, scope, body ?? {}, actorEmail(req));
  }

  @Get('projects/:id/conjoint')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getConjoint(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getConjoint(id, scope);
  }

  @Post('projects/:id/conjoint')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createConjoint(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { study_id?: number | null },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createConjoint(id, scope, body ?? {}, actorEmail(req));
  }

  @Get('projects/:id/conjoint/what-if')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listConjointWhatIfRuns(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listConjointWhatIfRuns(id, scope);
  }

  @Post('projects/:id/conjoint/what-if')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchWhatIfGuard)
  async simulateConjointWhatIf(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { study_id?: number | null; scenario?: Record<string, string>; persist?: boolean },
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.simulateConjointWhatIf(id, scope, body ?? {}, actorEmail(req));
  }

  @Get('projects/:id/decisions')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listDecisions(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listDecisions(id, scope);
  }

  @Post('projects/:id/decisions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createDecision(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateDecisionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createDecision(id, scope, body ?? ({} as CreateDecisionInput), actorEmail(req));
  }

  @Patch('decisions/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchDecision(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchDecisionInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchDecision(id, scope, body ?? {});
  }

  @Patch('studies/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchStudy(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchStudyInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchStudy(id, scope, body ?? {});
  }

  @Get('studies/:id/consents')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listConsents(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listConsents(id, scope);
  }

  @Post('studies/:id/consents')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createConsent(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateConsentInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createConsent(id, scope, body ?? ({} as CreateConsentInput), actorEmail(req));
  }

  @Patch('sources/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchSource(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchSourceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchSource(id, scope, body ?? ({} as PatchSourceInput));
  }

  @Post('sources/:id/accept-single-source')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchApproveGuard)
  async acceptSingleSource(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.acceptSingleSource(id, scope);
  }

  @Get('evidence/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async getEvidence(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.getEvidence(id, scope);
  }

  @Post('projects/:id/evidence')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createEvidence(id, scope, body ?? ({} as CreateEvidenceInput), actorEmail(req));
  }

  @Patch('evidence/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchEvidence(id, scope, body ?? {});
  }

  @Post('evidence/:id/verify')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async verifyEvidence(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.verifyEvidence(id, scope);
  }

  @Post('evidence/:id/supersede')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async supersedeEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.supersedeEvidence(id, scope, body ?? ({} as CreateEvidenceInput), actorEmail(req));
  }

  @Post('projects/:id/insights')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createInsight(id, scope, body ?? ({} as CreateInsightInput), actorEmail(req));
  }

  @Patch('insights/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async patchInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.patchInsight(id, scope, body ?? {});
  }

  @Post('insights/:id/attach-evidence')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async attachInsightEvidence(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AttachInsightEvidenceInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.attachEvidence(id, scope, body?.evidence_ids ?? []);
  }

  @Post('insights/:id/themes')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async attachInsightTheme(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AttachInsightThemeInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.attachInsightTheme(id, scope, body ?? { taxonomy_id: 0 }, actorEmail(req));
  }

  @Delete('insights/:id/themes/:taxonomyId')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async detachInsightTheme(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('taxonomyId', ParseIntPipe) taxonomyId: number,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.detachInsightTheme(id, taxonomyId, scope);
  }

  @Post('insights/:id/submit-review')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async submitInsightReview(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: SubmitReviewInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.submitReview(id, scope, body ?? {});
  }

  @Post('projects/:id/insights/copilot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async insightCopilot(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: InsightCopilotInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.insightCopilot(id, scope, body ?? { evidence_ids: [] }, actorEmail(req));
  }

  @Post('projects/:id/reports')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async createReport(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateReportInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.createReport(id, scope, body ?? { insight_ids: [] }, actorEmail(req));
  }

  @Get('projects/:id/reports')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchViewGuard)
  async listReports(@Req() req: StaffReq, @Param('id', ParseIntPipe) id: number) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.listReports(id, scope);
  }

  @Get('reports/:id/versions/:versionId/export')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchExportGuard)
  async exportReportVersion(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Query('format') format?: string,
  ) {
    if (format != null && format !== 'pdf' && format !== 'docx') {
      throw new BadRequestException({ error: 'validation_error' });
    }
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.exportReportVersion(id, versionId, scope, format ?? 'docx');
  }

  @Post('reports/:reportId/versions/:versionId/exec-en')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async updateReportExecEn(
    @Req() req: StaffReq,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() body: UpdateExecEnInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.updateReportExecEn(
      reportId,
      versionId,
      scope,
      body ?? { en: '' },
      actorEmail(req),
    );
  }

  @Post('reports/:reportId/versions/:versionId/approve-exec-en')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchApproveGuard)
  async approveReportExecEn(
    @Req() req: StaffReq,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.approveReportExecEn(reportId, versionId, scope, actorEmail(req));
  }

  @Patch('reports/:reportId/versions/:versionId/embargo')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchEditGuard)
  async updateReportEmbargo(
    @Req() req: StaffReq,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() body: UpdateReportEmbargoInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.updateReportEmbargo(reportId, versionId, scope, body ?? {});
  }

  @Post('reports/:reportId/versions/:versionId/publish-portal')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchApproveGuard)
  async publishPortal(
    @Req() req: StaffReq,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() body: PublishPortalInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.publishPortal(
      reportId,
      versionId,
      scope,
      body ?? ({} as PublishPortalInput),
      actorEmail(req),
    );
  }

  @Post('projects/:id/reports/copilot')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchRunGuard)
  async reportCopilot(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReportCopilotInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.reportCopilot(id, scope, body ?? { insight_ids: [] }, actorEmail(req));
  }

  @Post('insights/:id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffMarketResearchApproveGuard)
  async approveInsight(
    @Req() req: StaffReq,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApproveInsightInput,
  ) {
    const scope = await resolveStaffClientScope(req, this.clientScope);
    return this.research.approveInsight(id, scope, body ?? ({} as ApproveInsightInput), actorEmail(req));
  }
}
