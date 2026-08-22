import type {
  MktAiBrief,
  MktAiCampaignDraft,
  MktAiDashboardPayload,
  MktAiOptimizeRecommendation,
} from './marketing-ai-planner.types';

export interface MktAiOptimizeKpiContext {
  cpl_delta_pct: number | null;
  spend_vs_prev_week_pct: number | null;
  spend_mtd_vnd: number;
  leads_mtd: number;
  cpl_mtd: number | null;
  roas_mtd: number | null;
  roas_stub: boolean;
  linked: boolean;
  target_cpl_vnd: number | null;
}

export interface MktAiOptimizeContextInput {
  dashboard: MktAiDashboardPayload;
  brief: MktAiBrief | null;
  campaigns: MktAiCampaignDraft[];
  lifecycleStage: string;
}

export function buildKpiContextFromDashboard(
  dashboard: MktAiDashboardPayload,
): MktAiOptimizeKpiContext {
  return {
    cpl_delta_pct: dashboard.deltas.cpl_vs_target_pct,
    spend_vs_prev_week_pct: dashboard.deltas.spend_vs_prev_week_pct,
    spend_mtd_vnd: dashboard.tiles.spend_mtd_vnd,
    leads_mtd: dashboard.tiles.leads_mtd,
    cpl_mtd: dashboard.tiles.cpl_mtd,
    roas_mtd: dashboard.tiles.roas_mtd,
    roas_stub: dashboard.tiles.roas_stub,
    linked: dashboard.linked,
    target_cpl_vnd: dashboard.targets.cpl_vnd,
  };
}

export function resolveOptimizeTaskStage(lifecycleStage: string): string {
  const stage = lifecycleStage.trim().toLowerCase();
  if (stage === 'deliver' || stage === 'retain') return stage;
  return 'deliver';
}

function rec(
  id: string,
  title: string,
  rationale: string,
  priority: MktAiOptimizeRecommendation['priority'],
  taskStage: string,
  description: string,
): MktAiOptimizeRecommendation {
  return {
    id,
    title,
    rationale,
    priority,
    suggested_task: { stage: taskStage, title, description },
  };
}

export function buildRuleBasedOptimizeRecommendations(
  input: MktAiOptimizeContextInput,
): MktAiOptimizeRecommendation[] {
  const taskStage = resolveOptimizeTaskStage(input.lifecycleStage);
  const cplDelta = input.dashboard.deltas.cpl_vs_target_pct;
  const spendDelta = input.dashboard.deltas.spend_vs_prev_week_pct;
  const recs: MktAiOptimizeRecommendation[] = [];

  if (cplDelta != null && cplDelta > 15) {
    recs.push(
      rec(
        'opt-narrow-audience',
        'Thu hẹp audience lookalike',
        `CPL Meta ${cplDelta > 0 ? '+' : ''}${cplDelta}% so target — loại broad interest, tập trung ICP.`,
        'high',
        taskStage,
        'Rà soát ad set Meta: thu hẹp lookalike 1–3%, loại interest rộng; ghi lại baseline CPL trước/sau.',
      ),
      rec(
        'opt-refresh-creative',
        'Refresh creative ≥3 variant',
        'CPL cao thường do creative fatigue — rotate headline/hook mới trong 7 ngày.',
        'high',
        taskStage,
        'Brief 3 variant creative mới (hook + visual); A/B test trên ad set CPL cao nhất.',
      ),
      rec(
        'opt-landing-cvr',
        'Review landing CVR + form',
        'Kiểm tra tỷ lệ chuyển đổi landing/form trước khi tăng ngân sách.',
        'medium',
        taskStage,
        'Audit landing: tốc độ load, form fields, UTM; mục tiêu CVR ≥4% hoặc giảm CPL blended.',
      ),
    );
  }

  if (spendDelta != null && spendDelta > 20 && recs.length < 3) {
    recs.push(
      rec(
        'opt-spend-pacing',
        'Kiểm tra pacing spend tuần',
        `Spend tuần này ${spendDelta > 0 ? '+' : ''}${spendDelta}% — xác nhận không vượt pacing/tháng.`,
        'medium',
        taskStage,
        'Đối chiếu spend MTD với budget TMMT; điều chỉnh daily cap nếu cần.',
      ),
    );
  }

  if (input.dashboard.tiles.roas_stub) {
    recs.push(
      rec(
        'opt-roas-tracking',
        'Bổ sung conversion tracking ROAS',
        'ROAS đang ước tính (stub) — cần pixel/CAPI và giá trị conversion chuẩn.',
        'low',
        taskStage,
        'Verify Meta pixel + offline conversion; cập nhật giá trị lead/won trên CRM.',
      ),
    );
  }

  if (recs.length === 0) {
    recs.push(
      rec(
        'opt-weekly-review',
        'Weekly performance review',
        'KPI trong ngưỡng — duy trì cadence review hàng tuần với AM/SP.',
        'low',
        taskStage,
        'Họp 30 phút: CPL/lead theo kênh, creative winner/loser, action tuần tới.',
      ),
      rec(
        'opt-creative-test',
        'Lên lịch test creative mới',
        'Duy trì pipeline test 2 variant/tuần để tránh CPL drift.',
        'low',
        taskStage,
        'Thêm 2 creative test vào ad set top spend; đo CPL sau 5 ngày.',
      ),
      rec(
        'opt-audience-exclusion',
        'Cập nhật exclusion audience',
        'Loại trừ converted/won 90 ngày để giảm overlap.',
        'medium',
        taskStage,
        'Tạo exclusion custom audience từ CRM won; apply trên campaign lead gen.',
      ),
    );
  }

  return recs.slice(0, 5);
}

export function filterOptimizeRecommendations(
  recs: MktAiOptimizeRecommendation[],
  dismissedIds: string[] | undefined,
): MktAiOptimizeRecommendation[] {
  if (!dismissedIds?.length) return recs;
  const dismissed = new Set(dismissedIds.map((id) => id.trim()).filter(Boolean));
  return recs.filter((r) => !dismissed.has(r.id));
}

function str(v: unknown, fallback: string): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return fallback;
}

function priority(v: unknown): MktAiOptimizeRecommendation['priority'] {
  const p = String(v ?? '').toLowerCase();
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  return 'medium';
}

export function normalizeOptimizeRecommendations(
  raw: unknown,
  fallback: MktAiOptimizeRecommendation[],
): MktAiOptimizeRecommendation[] {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = src.recommendations ?? src.items ?? raw;
  if (!Array.isArray(list)) return fallback;

  const out: MktAiOptimizeRecommendation[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const taskRaw = row.suggested_task;
    const task =
      taskRaw && typeof taskRaw === 'object' ? (taskRaw as Record<string, unknown>) : {};
    const fb = fallback[i] ?? fallback[0];
    const id = str(row.id, fb?.id ?? `opt-${i + 1}`);
    const title = str(row.title, fb?.title ?? `Đề xuất ${i + 1}`);
    out.push({
      id,
      title,
      rationale: str(row.rationale, fb?.rationale ?? title),
      priority: priority(row.priority),
      suggested_task: {
        stage: str(task.stage, fb?.suggested_task.stage ?? 'deliver'),
        title: str(task.title, title),
        description: str(task.description, fb?.suggested_task.description ?? title),
      },
    });
  }

  return out.length ? out.slice(0, 5) : fallback;
}
