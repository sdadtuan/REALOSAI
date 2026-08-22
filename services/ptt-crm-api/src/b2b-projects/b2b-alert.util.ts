import { canSeeB2bLead, type B2bLeadScopeRow } from './b2b-visibility.util';

export type AlertSeverity = 'urgent' | 'normal' | 'inbox' | 'ops';
export type AlertKind = 'assigned_hot' | 'assigned' | 'unassigned' | 'sla' | 'ai_call' | 'max_hops';

export interface AlertReceiver {
  staffId: number;
  assignEnabled: boolean;
  isDirector: boolean;
  hasViewAllLeads: boolean;
  isActivePttStaff: boolean;
}

export function planLeadArrivalAlerts(input: {
  lead: B2bLeadScopeRow & { score: number | null };
  inHours: boolean;
  receivers: AlertReceiver[];
}): Array<{ staffId: number; severity: AlertSeverity; kind: AlertKind }> {
  const out: Array<{ staffId: number; severity: AlertSeverity; kind: AlertKind }> = [];
  for (const r of input.receivers) {
    const see = canSeeB2bLead(
      r,
      input.lead,
      input.lead.projectId
        ? [{ projectId: input.lead.projectId, assignEnabled: r.assignEnabled }]
        : [],
    );
    if (!see) continue;
    if (input.lead.ownerId != null && input.lead.ownerId === r.staffId) {
      const hot = (input.lead.score ?? 0) >= 70;
      out.push({
        staffId: r.staffId,
        severity: hot && input.inHours ? 'urgent' : 'normal',
        kind: hot ? 'assigned_hot' : 'assigned',
      });
      continue;
    }
    if (input.lead.ownerId == null && r.assignEnabled) {
      out.push({ staffId: r.staffId, severity: 'inbox', kind: 'unassigned' });
    }
  }
  return out;
}
