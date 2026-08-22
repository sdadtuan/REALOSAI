import type { PoolClient } from 'pg';
import { PRESALES_STAGES } from '../leads-funnel/leads-funnel.types';
import { validatePreliminaryPlan } from '../leads-funnel/presales-marketing-plan.util';
import type { PresalesPromoteSource } from './contract-promote.util';
import { seedPostOnboardLifecycleTasks } from './lifecycle-tasks-seed-pg.util';

export type { PresalesPromoteSource };

function asJsonb(val: unknown, fallback: string): string {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try {
      JSON.parse(val);
      return val;
    } catch {
      return fallback;
    }
  }
  return JSON.stringify(val);
}

export class ContractPromotePgUtil {
  async run(
    client: PoolClient,
    contractId: number,
    leadId: number,
    actor: string,
    ts: string,
    presalesSource?: PresalesPromoteSource,
    opts?: { manageTransaction?: boolean },
  ): Promise<{ lifecycle_id: number; customer_id: number; case_id: number | null; presales_id: number }> {
    const manageTx = opts?.manageTransaction !== false;
    if (manageTx) await client.query('BEGIN');
    try {
      const contractResult = await client.query(`SELECT * FROM crm_contracts WHERE id = $1`, [contractId]);
      const contract = contractResult.rows[0] as Record<string, unknown> | undefined;
      if (!contract) throw new Error('Không tìm thấy hợp đồng');

      let presalesId: number;
      let ps: Record<string, unknown>;
      if (presalesSource) {
        presalesId = presalesSource.presalesId;
        ps = {
          id: presalesSource.presalesId,
          lead_id: presalesSource.leadId,
          service_slug: presalesSource.serviceSlug,
          assigned_am: presalesSource.assignedAm,
          status: presalesSource.alreadyConverted ? 'converted' : 'active',
          lifecycle_id: presalesSource.alreadyConverted?.lifecycle_id ?? null,
        };
      } else {
        const psResult = await client.query(`SELECT * FROM crm_lead_presales WHERE lead_id = $1`, [leadId]);
        const sqlitePs = psResult.rows[0] as Record<string, unknown> | undefined;
        if (!sqlitePs) throw new Error('Lead chưa có pre-sales');
        ps = sqlitePs;
        presalesId = Number(ps.id);
      }

      if (String(ps.status) === 'converted' && ps.lifecycle_id) {
        if (manageTx) await client.query('COMMIT');
        return {
          lifecycle_id: Number(ps.lifecycle_id),
          customer_id: Number(contract.customer_id),
          case_id: contract.case_id != null ? Number(contract.case_id) : null,
          presales_id: presalesId,
        };
      }

      if (presalesSource) {
        for (const stage of PRESALES_STAGES) {
          const pending = presalesSource.tasks.filter(
            (task) =>
              String(task.stage) === stage &&
              !Number(task.is_custom) &&
              !Boolean(task.is_done),
          ).length;
          if (pending > 0) throw new Error(`Chưa hoàn thành task giai đoạn ${stage}`);
        }
        const planGate = validatePreliminaryPlan(presalesSource.plan);
        if (!planGate.ok) throw new Error(planGate.messages[0] ?? 'KH MKT sơ bộ chưa đủ');
      } else {
        for (const stage of PRESALES_STAGES) {
          const pending = await client.query(
            `SELECT COUNT(*)::int AS c FROM crm_lead_presales_tasks
             WHERE presales_id = $1 AND stage = $2 AND is_custom = FALSE AND is_done = FALSE`,
            [presalesId, stage],
          );
          if (Number(pending.rows[0]?.c ?? 0) > 0) {
            throw new Error(`Chưa hoàn thành task giai đoạn ${stage}`);
          }
        }

        const planResult = await client.query(
          `SELECT * FROM crm_marketing_plans
           WHERE presales_id = $1 AND plan_kind = 'preliminary'
           ORDER BY id DESC LIMIT 1`,
          [presalesId],
        );
        const plan = planResult.rows[0] as Record<string, unknown> | undefined;
        const planGate = validatePreliminaryPlan(plan ?? null);
        if (!planGate.ok) throw new Error(planGate.messages[0] ?? 'KH MKT sơ bộ chưa đủ');
      }

      const convert = await this.convertLeadToCrm(client, leadId, actor, ts);
      await client.query(
        `UPDATE crm_contracts
         SET customer_id = $2,
             case_id = COALESCE($3, case_id),
             status = 'active',
             signed_on = $4::date,
             updated_at = $5::timestamptz
         WHERE id = $1`,
        [contractId, convert.customer_id, convert.case_id, ts.slice(0, 10), ts],
      );

      const lifecycleId = await this.promotePresalesToLifecycle(
        client,
        presalesId,
        convert.customer_id,
        contractId,
        leadId,
        actor,
        ts,
        presalesSource,
      );

      await client.query(
        `UPDATE crm_leads SET status = 'won', updated_at = $2::timestamptz, updated_by = $3
         WHERE sqlite_lead_id = $1`,
        [leadId, ts, actor.slice(0, 120)],
      );

      const placeholderId = Number(contract.customer_id);
      if (placeholderId !== convert.customer_id) {
        await this.deletePlaceholderIfOrphan(client, placeholderId);
      }

      if (manageTx) await client.query('COMMIT');
      return {
        lifecycle_id: lifecycleId,
        customer_id: convert.customer_id,
        case_id: convert.case_id,
        presales_id: presalesId,
      };
    } catch (err) {
      if (manageTx) await client.query('ROLLBACK');
      throw err;
    }
  }

  private async convertLeadToCrm(
    client: PoolClient,
    leadId: number,
    actor: string,
    ts: string,
  ): Promise<{ customer_id: number; case_id: number | null }> {
    const leadResult = await client.query(
      `SELECT full_name, phone, email, owner_id, converted_customer_id, converted_case_id
       FROM crm_leads WHERE sqlite_lead_id = $1`,
      [leadId],
    );
    const ld = leadResult.rows[0] as Record<string, unknown> | undefined;
    if (!ld) throw new Error('Không tìm thấy lead');
    if (ld.converted_case_id) {
      return { customer_id: Number(ld.converted_customer_id), case_id: Number(ld.converted_case_id) };
    }
    const name = String(ld.full_name ?? '').trim();
    if (!name) throw new Error('Lead thiếu họ tên');

    let custId = await this.findExistingCustomer(client, String(ld.phone ?? ''), String(ld.email ?? ''));
    if (!custId) {
      const insert = await client.query(
        `INSERT INTO crm_customers (name, phone, email, address, company, created_at, is_placeholder)
         VALUES ($1, $2, $3, '', '', $4::timestamptz, FALSE)
         RETURNING id`,
        [name.slice(0, 240), String(ld.phone ?? '').slice(0, 80), String(ld.email ?? '').slice(0, 240), ts],
      );
      custId = Number(insert.rows[0].id);
    }

    const caseInsert = await client.query(
      `INSERT INTO crm_cases (
         customer_id, title, description, channel, priority, status,
         assigned_staff_id, assigned_at, created_at, updated_at, pipeline_stage, stage_entered_at
       ) VALUES ($1, $2, $3, 'khac', 'binh_thuong', 'moi', $4, $5, $6::timestamptz, $6::timestamptz, 'chot', $6::timestamptz)
       RETURNING id`,
      [
        custId,
        `Lead #${leadId} — ${name}`.slice(0, 800),
        `Chuyển từ Lead #${leadId}`,
        ld.owner_id != null ? Number(ld.owner_id) : null,
        ld.owner_id ? ts : null,
        ts,
      ],
    );
    const caseId = Number(caseInsert.rows[0].id);

    await client.query(
      `UPDATE crm_leads
       SET converted_customer_id = $2, converted_case_id = $3, updated_at = $4::timestamptz, updated_by = $5
       WHERE sqlite_lead_id = $1`,
      [leadId, custId, caseId, ts, actor.slice(0, 120)],
    );

    return { customer_id: custId, case_id: caseId };
  }

  private async findExistingCustomer(
    client: PoolClient,
    phone: string,
    email: string,
  ): Promise<number | null> {
    const ph = phone.replace(/[\s\-.]/g, '');
    if (ph.length >= 8) {
      const hit = await client.query(
        `SELECT id FROM crm_customers
         WHERE REPLACE(REPLACE(REPLACE(COALESCE(phone,''),' ',''),'-',''),'.','') = $1
           AND COALESCE(is_placeholder, FALSE) IS NOT TRUE
         ORDER BY id ASC LIMIT 1`,
        [ph],
      );
      if (hit.rows[0]) return Number(hit.rows[0].id);
    }
    const em = email.trim().toLowerCase();
    if (em.includes('@')) {
      const hit = await client.query(
        `SELECT id FROM crm_customers
         WHERE lower(trim(email)) = $1 AND COALESCE(is_placeholder, FALSE) IS NOT TRUE
         ORDER BY id ASC LIMIT 1`,
        [em],
      );
      if (hit.rows[0]) return Number(hit.rows[0].id);
    }
    return null;
  }

  private async promotePresalesToLifecycle(
    client: PoolClient,
    presalesId: number,
    customerId: number,
    contractId: number,
    leadId: number,
    actor: string,
    ts: string,
    presalesSource?: PresalesPromoteSource,
  ): Promise<number> {
    const ps = presalesSource
      ? {
          lead_id: presalesSource.leadId,
          service_slug: presalesSource.serviceSlug,
          assigned_am: presalesSource.assignedAm,
        }
      : ((
          await client.query(`SELECT * FROM crm_lead_presales WHERE id = $1`, [presalesId])
        ).rows[0] as Record<string, unknown>);
    const serviceSlug = String(ps.service_slug ?? '');
    const ownerResult = await client.query(`SELECT owner_id FROM crm_leads WHERE sqlite_lead_id = $1`, [leadId]);
    const owner = ownerResult.rows[0] as { owner_id: number | null } | undefined;
    const assignedAm: number | null =
      ps.assigned_am != null ? Number(ps.assigned_am) : owner?.owner_id != null ? Number(owner.owner_id) : null;

    const lcInsert = await client.query(
      `INSERT INTO crm_service_lifecycle
         (lead_id, customer_id, contract_id, service_slug, stage, status, assigned_am, stage_entered_at, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'onboard', 'active', $5, $6::timestamptz, $7, $6::timestamptz, $6::timestamptz)
       RETURNING id`,
      [
        leadId,
        customerId,
        contractId,
        serviceSlug,
        assignedAm,
        ts,
        `Promote từ pre-sales #${presalesId} — ${actor}`.slice(0, 4000),
      ],
    );
    const lifecycleId = Number(lcInsert.rows[0].id);

    await client.query(
      `INSERT INTO crm_service_lifecycle_events (lifecycle_id, from_stage, to_stage, actor_type, notes, created_at)
       VALUES ($1, 'proposal', 'onboard', 'system', $2, $3::timestamptz)`,
      [lifecycleId, `Ký HĐ #${contractId}`, ts],
    );

    const srcTasks = presalesSource
      ? presalesSource.tasks
      : ((
          await client.query(
            `SELECT * FROM crm_lead_presales_tasks WHERE presales_id = $1 ORDER BY stage, step_index, id`,
            [presalesId],
          )
        ).rows as Array<Record<string, unknown>>);

    for (const src of srcTasks) {
      await client.query(
        `INSERT INTO crm_svc_tasks
           (lifecycle_id, stage, step_index, title, description, ai_prompt_key, form_fields, form_data,
            ai_output, is_done, done_at, done_by, notes, is_custom, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14, $15::timestamptz, $15::timestamptz)`,
        [
          lifecycleId,
          String(src.stage ?? ''),
          Number(src.step_index ?? 0),
          String(src.title ?? ''),
          String(src.description ?? ''),
          String(src.ai_prompt_key ?? ''),
          asJsonb(src.form_fields, '[]'),
          asJsonb(src.form_data, '{}'),
          String(src.ai_output ?? ''),
          Boolean(src.is_done),
          src.done_at ? String(src.done_at) : null,
          src.done_by != null ? Number(src.done_by) : null,
          String(src.notes ?? ''),
          Boolean(src.is_custom),
          ts,
        ],
      );
    }

    await seedPostOnboardLifecycleTasks(client, lifecycleId, serviceSlug, ts);
    if (presalesSource?.plan) {
      await this.clonePreliminaryToOfficialFromPlan(client, presalesSource.plan, lifecycleId, leadId, presalesId, ts);
    } else {
      await this.clonePreliminaryToOfficial(client, presalesId, lifecycleId, leadId, ts);
    }
    await this.linkPresalesExpensesToLifecycle(client, presalesId, lifecycleId, ts);

    await client.query(
      `UPDATE crm_lead_intake_sessions
       SET lifecycle_id = $1, updated_at = NOW()
       WHERE lead_id = $2 AND (lifecycle_id IS NULL OR lifecycle_id = 0)`,
      [lifecycleId, leadId],
    );

    await client.query(
      `UPDATE crm_lead_presales SET status = 'converted', lifecycle_id = $2, updated_at = $3::timestamptz WHERE id = $1`,
      [presalesId, lifecycleId, ts],
    );

    return lifecycleId;
  }

  private async clonePreliminaryToOfficialFromPlan(
    client: PoolClient,
    draft: Record<string, unknown>,
    lifecycleId: number,
    leadId: number,
    presalesId: number,
    ts: string,
  ): Promise<void> {
    const gate = validatePreliminaryPlan(draft);
    if (!gate.ok) throw new Error(gate.messages[0] ?? 'KH MKT sơ bộ chưa đủ');
    let name = String(draft.name ?? '').trim();
    if (!name.endsWith('(chính thức)')) name = `${name} (chính thức)`.slice(0, 200);
    const insert = await client.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lead_id, presales_id, lifecycle_id, source_plan_id,
         north_star, objectives, notes, strategy_framework_json, target_market_prof_json,
         target_market_steps4_json, created_at, updated_at
       )
       VALUES ($1, $2, 'draft', 'official', $3, $4, $5, NULL, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::timestamptz, $12::timestamptz)
       RETURNING id`,
      [
        `LC-${lifecycleId}-OFFICIAL`,
        name,
        draft.lead_id != null ? Number(draft.lead_id) : leadId,
        draft.presales_id != null ? Number(draft.presales_id) : presalesId,
        lifecycleId,
        String(draft.north_star ?? ''),
        String(draft.objectives ?? ''),
        String(draft.notes ?? ''),
        asJsonb(draft.strategy_framework_json, '{}'),
        asJsonb(draft.target_market_prof_json, '{}'),
        asJsonb(draft.target_market_steps4_json, '{}'),
        ts,
      ],
    );
    const officialId = Number(insert.rows[0].id);
    await client.query(`UPDATE crm_service_lifecycle SET marketing_plan_id = $2, updated_at = $3::timestamptz WHERE id = $1`, [
      lifecycleId,
      officialId,
      ts,
    ]);
  }

  private async clonePreliminaryToOfficial(
    client: PoolClient,
    presalesId: number,
    lifecycleId: number,
    leadId: number,
    ts: string,
  ): Promise<void> {
    const draftResult = await client.query(
      `SELECT * FROM crm_marketing_plans
       WHERE presales_id = $1 AND plan_kind = 'preliminary'
       ORDER BY id DESC LIMIT 1`,
      [presalesId],
    );
    const draft = draftResult.rows[0] as Record<string, unknown> | undefined;
    if (!draft) throw new Error('Thiếu Kế hoạch MKT sơ bộ');
    const gate = validatePreliminaryPlan(draft);
    if (!gate.ok) throw new Error(gate.messages[0] ?? 'KH MKT sơ bộ chưa đủ');
    let name = String(draft.name ?? '').trim();
    if (!name.endsWith('(chính thức)')) name = `${name} (chính thức)`.slice(0, 200);
    const insert = await client.query(
      `INSERT INTO crm_marketing_plans (
         code, name, status, plan_kind, lead_id, presales_id, lifecycle_id, source_plan_id,
         north_star, objectives, notes, strategy_framework_json, target_market_prof_json,
         target_market_steps4_json, created_at, updated_at
       )
       SELECT $1, $2, 'draft', 'official', $3, $4, $5, id,
              north_star, objectives, notes, strategy_framework_json, target_market_prof_json,
              target_market_steps4_json, $6::timestamptz, $6::timestamptz
       FROM crm_marketing_plans WHERE id = $7
       RETURNING id`,
      [`LC-${lifecycleId}-OFFICIAL`, name, leadId, presalesId, lifecycleId, ts, Number(draft.id)],
    );
    const officialId = Number(insert.rows[0].id);
    await client.query(`UPDATE crm_service_lifecycle SET marketing_plan_id = $2, updated_at = $3::timestamptz WHERE id = $1`, [
      lifecycleId,
      officialId,
      ts,
    ]);
  }

  private async linkPresalesExpensesToLifecycle(
    client: PoolClient,
    presalesId: number,
    lifecycleId: number,
    ts: string,
  ): Promise<number> {
    const result = await client.query(
      `UPDATE crm_svc_expenses
       SET lifecycle_id = $1, updated_at = $2::timestamptz
       WHERE presales_id = $3 AND cost_phase = 'presales' AND lifecycle_id IS NULL`,
      [lifecycleId, ts, presalesId],
    );
    return result.rowCount ?? 0;
  }

  private async deletePlaceholderIfOrphan(client: PoolClient, customerId: number): Promise<void> {
    const rowResult = await client.query(`SELECT is_placeholder FROM crm_customers WHERE id = $1`, [customerId]);
    const row = rowResult.rows[0] as { is_placeholder: boolean } | undefined;
    if (!row || !row.is_placeholder) return;
    const nCt = await client.query(`SELECT COUNT(*)::int AS n FROM crm_contracts WHERE customer_id = $1`, [customerId]);
    if (Number(nCt.rows[0]?.n ?? 0) > 0) return;
    const nCs = await client.query(`SELECT COUNT(*)::int AS n FROM crm_cases WHERE customer_id = $1`, [customerId]);
    if (Number(nCs.rows[0]?.n ?? 0) > 0) return;
    await client.query(`DELETE FROM crm_customers WHERE id = $1`, [customerId]);
  }
}
