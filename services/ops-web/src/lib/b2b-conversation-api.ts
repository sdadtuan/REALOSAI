import { API_BASE, ApiError, parseJson } from './api';

export interface B2bConversationMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
}

export interface B2bConversationThread {
  lead_id: number;
  thread_id: string | null;
  oa_id: string | null;
  messages: B2bConversationMessage[];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchB2bConversation(
  token: string,
  leadId: number,
): Promise<B2bConversationThread> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/b2b-conversation`, {
    headers: authHeaders(token),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(await parseJson(res), res.status);
  }
  return (await res.json()) as B2bConversationThread;
}

export async function postB2bConversationMessage(
  token: string,
  leadId: number,
  body: string,
): Promise<B2bConversationThread> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/b2b-conversation/messages`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    throw new ApiError(await parseJson(res), res.status);
  }
  return (await res.json()) as B2bConversationThread;
}
