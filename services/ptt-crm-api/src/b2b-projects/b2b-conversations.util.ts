import { resolveIngressProject, type IngressCatalog } from './b2b-ingest.util';

export interface ZaloConversationEvent {
  event: string;
  oaId: string;
  userId: string;
  body: string;
  direction: 'inbound' | 'outbound';
  providerMessageId?: string;
}

export function resolveConversationProject(input: {
  oaId: string;
  projectSlug: string;
  catalog: IngressCatalog;
}): { projectId: string } | { attach: false; reason: string } {
  const resolved = resolveIngressProject(
    {
      channel: 'zalo',
      oaId: input.oaId,
      projectSlug: input.projectSlug,
    },
    input.catalog,
  );
  if ('unmatched' in resolved) {
    return { attach: false, reason: resolved.reason };
  }
  return { projectId: resolved.projectId };
}

function readMessageBody(info: Record<string, unknown>, payload: Record<string, unknown>): string {
  const text = info.text ?? info.message ?? info.note ?? payload.message;
  if (typeof text === 'string') return text.trim();
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    const msg = (text as Record<string, unknown>).text ?? (text as Record<string, unknown>).content;
    if (typeof msg === 'string') return msg.trim();
  }
  return String(info.text ?? info.message ?? '').trim();
}

export function parseZaloConversationEvents(payload: Record<string, unknown>): ZaloConversationEvent[] {
  const out: ZaloConversationEvent[] = [];
  const event = String(payload.event_name ?? payload.event ?? '').toLowerCase();
  if (!['user_send_text', 'oa_send_text'].includes(event)) {
    const events = payload.events;
    if (Array.isArray(events)) {
      for (const item of events) {
        if (item && typeof item === 'object') {
          out.push(...parseZaloConversationEvents(item as Record<string, unknown>));
        }
      }
    }
    return out;
  }

  const infoRaw = payload.info ?? payload.data ?? payload.message ?? {};
  if (!infoRaw || typeof infoRaw !== 'object' || Array.isArray(infoRaw)) {
    if (typeof infoRaw === 'string' && infoRaw.trim()) {
      const oaId = String(payload.oa_id ?? payload.app_id ?? '').trim();
      const userId = String(payload.user_id ?? payload.sender_id ?? '').trim();
      if (oaId && userId) {
        out.push({
          event,
          oaId,
          userId,
          body: infoRaw.trim(),
          direction: event === 'oa_send_text' ? 'outbound' : 'inbound',
        });
      }
    }
    return out;
  }

  const info = infoRaw as Record<string, unknown>;
  const oaId = String(payload.oa_id ?? payload.app_id ?? info.oa_id ?? '').trim();
  const follower = payload.follower;
  const userId = String(
    follower && typeof follower === 'object'
      ? (follower as { id?: unknown }).id ?? ''
      : payload.user_id ?? info.user_id ?? info.from_id ?? '',
  ).trim();
  const body = readMessageBody(info, payload);
  if (!oaId || !userId || !body) return out;

  out.push({
    event,
    oaId,
    userId,
    body,
    direction: event === 'oa_send_text' ? 'outbound' : 'inbound',
    providerMessageId: String(info.msg_id ?? info.message_id ?? payload.msg_id ?? '').trim() || undefined,
  });
  return out;
}
