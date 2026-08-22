import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { SearchEntityDocument, SearchEntityType } from './crm-search.types';

@Injectable()
export class SearchDocumentProvider implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  async collectAll(limitPerType = 200): Promise<SearchEntityDocument[]> {
    const out: SearchEntityDocument[] = [];
    out.push(...(await this.collectLeads(limitPerType)));
    out.push(...(await this.collectAccounts(limitPerType)));
    out.push(...(await this.collectContacts(limitPerType)));
    out.push(...(await this.collectDeals(limitPerType)));
    out.push(...(await this.collectTickets(limitPerType)));
    out.push(...(await this.collectTimelineEmails(limitPerType)));
    out.push(...(await this.collectTimelineNotes(limitPerType)));
    return out;
  }

  async estimateDocumentCount(): Promise<number> {
    const docs = await this.collectAll(20);
    return docs.length;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
         LIMIT 1`,
        [tableName],
      );
      return (result.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private async collectLeads(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('crm_leads'))) return [];
    try {
      const result = await this.db.query(
        `SELECT sqlite_lead_id, full_name, phone, email, status, source, channel, created_at
         FROM crm_leads
         WHERE is_duplicate IS NOT TRUE
         ORDER BY sqlite_lead_id DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => ({
        entity_type: 'lead' as const,
        entity_id: String(r.sqlite_lead_id),
        title: String(r.full_name ?? `Lead #${r.sqlite_lead_id}`),
        subtitle: String(r.status ?? ''),
        body: [r.phone, r.email, r.source, r.channel].filter(Boolean).join(' · '),
        route_path: '/crm/leads',
        updated_at: r.created_at ? String(r.created_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async collectAccounts(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('crm_customers'))) return [];
    try {
      const result = await this.db.query(
        `SELECT id, name, company, email, phone, created_at
         FROM crm_customers
         WHERE COALESCE(is_placeholder, false) IS NOT TRUE
         ORDER BY id DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => ({
        entity_type: 'account' as const,
        entity_id: String(r.id),
        title: String(r.name ?? r.company ?? `Account #${r.id}`),
        subtitle: String(r.company ?? ''),
        body: [r.email, r.phone].filter(Boolean).join(' · '),
        route_path: `/crm/customers/${r.id}`,
        updated_at: r.created_at ? String(r.created_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async collectContacts(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('crm_customers'))) return [];
    try {
      const result = await this.db.query(
        `SELECT id, name, email, phone, company, created_at
         FROM crm_customers
         ORDER BY id DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => ({
        entity_type: 'contact' as const,
        entity_id: String(r.id),
        title: String(r.name ?? `Contact #${r.id}`),
        subtitle: String(r.email ?? r.phone ?? ''),
        body: [r.company, r.phone, r.email].filter(Boolean).join(' · '),
        route_path: `/crm/customers/${r.id}`,
        updated_at: r.created_at ? String(r.created_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async collectDeals(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('crm_cases'))) return [];
    try {
      const result = await this.db.query(
        `SELECT c.id, c.title, c.pipeline_stage, c.deal_value_vnd, c.updated_at, cu.name AS customer_name
         FROM crm_cases c
         LEFT JOIN crm_customers cu ON cu.id = c.customer_id
         ORDER BY c.updated_at DESC NULLS LAST, c.id DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => ({
        entity_type: 'deal' as const,
        entity_id: String(r.id),
        title: String(r.title ?? `Deal #${r.id}`),
        subtitle: String(r.pipeline_stage ?? ''),
        body: [r.customer_name, r.deal_value_vnd ? `${r.deal_value_vnd} VND` : ''].filter(Boolean).join(' · '),
        route_path: '/crm/sales',
        updated_at: r.updated_at ? String(r.updated_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async collectTickets(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('crm_tickets'))) return [];
    try {
      const result = await this.db.query(
        `SELECT t.id, t.title, t.status, t.priority, t.updated_at, c.name AS customer_name
         FROM crm_tickets t
         LEFT JOIN crm_customers c ON c.id = t.customer_id
         ORDER BY t.updated_at DESC NULLS LAST, t.id DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => ({
        entity_type: 'ticket' as const,
        entity_id: String(r.id),
        title: String(r.title ?? `Ticket #${r.id}`),
        subtitle: String(r.status ?? ''),
        body: [r.customer_name, r.priority].filter(Boolean).join(' · '),
        route_path: '/crm/tickets',
        updated_at: r.updated_at ? String(r.updated_at) : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async collectTimelineEmails(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('customer_timeline_events'))) return [];
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, entity_type, entity_id, event_type, title, body, occurred_at::text AS occurred_at
         FROM customer_timeline_events
         WHERE lower(event_type) LIKE '%email%'
            OR lower(COALESCE(title, '')) LIKE '%email%'
            OR lower(COALESCE(body, '')) LIKE '%@%'
         ORDER BY occurred_at DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => this.timelineRowToDoc(r, 'email'));
    } catch {
      return [];
    }
  }

  private async collectTimelineNotes(limit: number): Promise<SearchEntityDocument[]> {
    if (!(await this.tableExists('customer_timeline_events'))) return [];
    try {
      const result = await this.db.query(
        `SELECT id::text AS id, entity_type, entity_id, event_type, title, body, occurred_at::text AS occurred_at
         FROM customer_timeline_events
         WHERE lower(event_type) IN ('note', 'comment', 'activity', 'call', 'meeting')
         ORDER BY occurred_at DESC NULLS LAST
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((r) => this.timelineRowToDoc(r, 'note'));
    } catch {
      return [];
    }
  }

  private timelineRowToDoc(
    row: Record<string, unknown>,
    forcedType: SearchEntityType,
  ): SearchEntityDocument {
    const entityType = String(row.entity_type ?? 'lead');
    const entityId = String(row.entity_id ?? row.id ?? '');
    return {
      entity_type: forcedType,
      entity_id: String(row.id ?? `${entityType}:${entityId}`),
      title: String(row.title ?? row.event_type ?? forcedType),
      subtitle: `${entityType} #${entityId}`,
      body: String(row.body ?? '').slice(0, 500),
      route_path: this.routeForEntity(entityType, entityId),
      updated_at: row.occurred_at ? String(row.occurred_at) : undefined,
    };
  }

  private routeForEntity(entityType: string, entityId: string): string {
    const t = entityType.toLowerCase();
    if (t === 'lead') return '/crm/leads';
    if (t === 'deal' || t === 'case' || t === 'opportunity') return '/crm/sales';
    if (t === 'ticket') return '/crm/tickets';
    if (t === 'customer' || t === 'account' || t === 'contact') return `/crm/customers/${entityId}`;
    return '/crm';
  }
}
