import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AI_USE_CASE, AiUseCase } from './ai-audit.constants';

export interface AiPromptRecord {
  useCase: string;
  promptTemplate: string;
  version: number;
  source: 'db' | 'default';
}

const DEFAULT_PROMPTS: Record<string, string> = {
  [AI_USE_CASE.SUMMARIZE]: `Bạn là trợ lý CSKH PTT. Tóm tắt ghi chú activity/call bằng tiếng Việt.
Trả về JSON hợp lệ với các khóa:
- summary: đoạn tóm tắt 2-4 câu
- bullets: mảng rỗng hoặc tối đa 3 gạch đầu dòng phụ
- extracted: { intent, objections[], next_action, source, campaign_id, risk_flags[], budget_vnd }
- confidence: 0-1
Không bịa thông tin không có trong input.`,

  [AI_USE_CASE.LEAD_BRIEF]: `Bạn là trợ lý CSKH PTT. Tạo lead brief nhanh bằng tiếng Việt (tối đa 5 bullets).
Trả về JSON hợp lệ với các khóa:
- summary: một câu tổng quan
- bullets: đúng 3-5 gạch đầu dòng (who, need, source/campaign, risk, next action)
- extracted: { intent, objections[], next_action, source, campaign_id, risk_flags[], budget_vnd }
- confidence: 0-1
Nếu chưa có tương tác, ghi rõ trong bullet.`,

  [AI_USE_CASE.FOLLOW_UP_DRAFT]: `Bạn là trợ lý CSKH PTT. Soạn nháp follow-up bằng tiếng Việt theo kênh được chỉ định trong user message (zalo, email, hoặc ghi chú nội bộ).
Trả về JSON hợp lệ với các khóa:
- draft_text: nội dung nháp (10-4000 ký tự), lịch sự, không hứa hẹn quá mức
- subject: tiêu đề email (string hoặc null nếu không phải email)
- confidence: 0-1
Không bịa thông tin không có trong input. Không thêm lệnh gửi tự động — đây chỉ là nháp để nhân viên duyệt.`,
};

@Injectable()
export class AiPromptsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_prompts'`,
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async getActivePrompt(useCase: AiUseCase | string): Promise<AiPromptRecord> {
    const fallback = DEFAULT_PROMPTS[useCase];
    if (!(await this.tableReady())) {
      return {
        useCase,
        promptTemplate: fallback ?? DEFAULT_PROMPTS[AI_USE_CASE.SUMMARIZE],
        version: 1,
        source: 'default',
      };
    }

    try {
      const result = await this.db.query(
        `SELECT use_case, prompt_template, version
         FROM ai_prompts
         WHERE use_case = $1 AND is_active IS TRUE
         ORDER BY version DESC
         LIMIT 1`,
        [useCase],
      );
      const row = result.rows[0] as { use_case: string; prompt_template: string; version: number } | undefined;
      if (row?.prompt_template?.trim()) {
        return {
          useCase: row.use_case,
          promptTemplate: row.prompt_template.trim(),
          version: Number(row.version) || 1,
          source: 'db',
        };
      }
    } catch {
      /* fall through */
    }

    return {
      useCase,
      promptTemplate: fallback ?? DEFAULT_PROMPTS[AI_USE_CASE.SUMMARIZE],
      version: 1,
      source: 'default',
    };
  }
}
