import type { Pool } from 'pg';
import type { IntakeSessionRow } from './intake.types';

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPresalesFormPatchFromIntake(session: IntakeSessionRow): Record<string, unknown> {
  const answers = session.answers_json || {};
  const crm =
    answers.crm_fields && typeof answers.crm_fields === 'object'
      ? (answers.crm_fields as Record<string, unknown>)
      : {};
  const needRaw = String(crm.need ?? '').trim();
  const needSummary = stripHtml(needRaw) || needRaw;
  const patch: Record<string, unknown> = {
    intake_session_id: session.id,
    bant_total: session.bant_total ?? 0,
    decision: session.decision ?? '',
  };
  if (needSummary) {
    patch.need_summary = needSummary.slice(0, 4000);
    patch.need = needSummary.slice(0, 4000);
  }
  return patch;
}

export async function syncPresalesLeadTasksFromIntake(
  db: Pool,
  session: IntakeSessionRow,
  actorId: number | null,
): Promise<{ synced: boolean; marked_done: number }> {
  const leadId = session.lead_id;
  if (!leadId || String(session.decision ?? '').trim() !== 'go') {
    return { synced: false, marked_done: 0 };
  }

  const psResult = await db.query(
    `SELECT id FROM crm_lead_presales WHERE lead_id = $1 AND status != 'converted' ORDER BY id DESC LIMIT 1`,
    [leadId],
  );
  const presalesId = psResult.rows[0]?.id;
  if (presalesId == null) return { synced: false, marked_done: 0 };

  const tasksResult = await db.query(
    `SELECT id, form_data, is_done, notes FROM crm_lead_presales_tasks
     WHERE presales_id = $1 AND stage = 'lead'`,
    [presalesId],
  );

  const patch = buildPresalesFormPatchFromIntake(session);
  let markedDone = 0;

  for (const row of tasksResult.rows as Array<{
    id: number;
    form_data: unknown;
    is_done: boolean;
    notes: string | null;
  }>) {
    const existing =
      row.form_data && typeof row.form_data === 'object' && !Array.isArray(row.form_data)
        ? (row.form_data as Record<string, unknown>)
        : {};
    const merged = { ...existing, ...patch };
    const noteLine = `[Intake #${session.id}] BANT ${session.bant_total ?? 0}/30 · ${session.decision}`;
    const prevNotes = String(row.notes ?? '').trim();
    const nextNotes =
      !prevNotes || prevNotes.includes(`[Intake #${session.id}]`)
        ? prevNotes || noteLine
        : `${prevNotes}\n${noteLine}`;

    if (row.is_done) {
      await db.query(
        `UPDATE crm_lead_presales_tasks
         SET form_data = $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [row.id, JSON.stringify(merged)],
      );
      continue;
    }

    await db.query(
      `UPDATE crm_lead_presales_tasks
       SET form_data = $2::jsonb,
           is_done = TRUE,
           done_at = NOW(),
           done_by = $3,
           notes = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, JSON.stringify(merged), actorId, nextNotes.slice(0, 4000)],
    );
    markedDone += 1;
  }

  return { synced: markedDone > 0 || tasksResult.rows.length > 0, marked_done: markedDone };
}

export async function repairPresalesLeadTasksFromLatestGoIntake(
  db: Pool,
  leadId: number,
): Promise<boolean> {
  const sessionResult = await db.query(
    `SELECT id FROM crm_lead_intake_sessions
     WHERE lead_id = $1 AND status = 'completed' AND decision = 'go'
     ORDER BY completed_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [leadId],
  );
  const sessionId = sessionResult.rows[0]?.id;
  if (sessionId == null) return false;

  const fullResult = await db.query(
    `SELECT lead_id, decision, bant_total, answers_json
     FROM crm_lead_intake_sessions WHERE id = $1 OR sqlite_intake_id = $1 LIMIT 1`,
    [sessionId],
  );
  const row = fullResult.rows[0] as
    | {
        lead_id: number;
        decision: string;
        bant_total: number;
        answers_json: unknown;
      }
    | undefined;
  if (!row) return false;

  const session: IntakeSessionRow = {
    id: Number(sessionId),
    lead_id: Number(row.lead_id),
    lifecycle_id: null,
    service_slug: '_common',
    mode: 'phone',
    status: 'completed',
    am_id: null,
    contact_name: '',
    contact_role: '',
    company_name: '',
    source: '',
    bant_json: {},
    bant_total: Number(row.bant_total ?? 0),
    lead_temperature: '',
    decision: String(row.decision ?? ''),
    decision_reason: '',
    answers_json:
      typeof row.answers_json === 'object' && row.answers_json !== null
        ? (row.answers_json as Record<string, unknown>)
        : {},
    stakeholders_json: [],
    commitments_json: [],
    next_meeting_at: '',
    next_meeting_note: '',
    proposal_date: '',
    ai_summary: '',
    ai_suggested_questions: [],
    started_at: '',
    completed_at: '',
    created_at: '',
    updated_at: '',
  };

  const out = await syncPresalesLeadTasksFromIntake(db, session, null);
  return out.marked_done > 0;
}
