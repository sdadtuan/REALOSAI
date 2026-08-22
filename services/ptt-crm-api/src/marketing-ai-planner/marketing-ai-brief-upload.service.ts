import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { computeBriefReadiness } from './marketing-ai-brief-readiness.util';
import { extractBriefFieldsFromText } from './marketing-ai-brief-upload.util';
import { mergeBrief, validateMktAiBrief } from './marketing-ai-brief.util';
import {
  extractDocumentText,
  MKT_AI_RAG_ALLOWED_MIMES,
  MKT_AI_RAG_MAX_BYTES,
  normalizeMime,
} from './marketing-ai-rag.util';
import type { MktAiBrief, MktAiBriefUploadResult } from './marketing-ai-planner.types';

const BRIEF_UPLOAD_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

@Injectable()
export class MarketingAiBriefUploadService {
  constructor(private readonly config: AppConfigService) {}

  isFeatureEnabled(): boolean {
    return this.config.mktAiPlannerEnabled && this.config.mktAiBriefUploadEnabled;
  }

  uploadBriefFile(
    file: Express.Multer.File,
    existingBrief: MktAiBrief | null,
    serviceSlug: string,
  ): MktAiBriefUploadResult {
    if (!this.isFeatureEnabled()) {
      throw new BadRequestException({ error: 'mkt_ai_brief_upload_disabled' });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'file_required' });
    }
    if (file.size > MKT_AI_RAG_MAX_BYTES) {
      throw new BadRequestException({ error: 'file_too_large', max_bytes: MKT_AI_RAG_MAX_BYTES });
    }

    const filename = String(file.originalname ?? 'brief.bin').trim() || 'brief.bin';
    const mimeType = normalizeMime(String(file.mimetype ?? ''), filename);
    if (!BRIEF_UPLOAD_MIMES.has(mimeType) && !MKT_AI_RAG_ALLOWED_MIMES.has(mimeType)) {
      throw new BadRequestException({ error: 'unsupported_mime', mime_type: mimeType });
    }

    let text: string;
    try {
      text = extractDocumentText(file.buffer, mimeType);
    } catch (err) {
      throw new BadRequestException({
        error: 'brief_extract_failed',
        message: err instanceof Error ? err.message : 'extract_failed',
      });
    }

    const extracted = extractBriefFieldsFromText(text);
    const merged = mergeBrief(existingBrief, {
      ...extracted,
      service_slug: serviceSlug,
    });
    if (!merged.service_slug) merged.service_slug = serviceSlug;

    const briefValidation = validateMktAiBrief(merged);
    const briefReadiness = computeBriefReadiness(merged);

    return {
      brief: merged,
      brief_validation: briefValidation,
      brief_readiness: briefReadiness,
      extracted_fields: extracted,
      missing: briefValidation.missing,
      filename,
    };
  }
}
