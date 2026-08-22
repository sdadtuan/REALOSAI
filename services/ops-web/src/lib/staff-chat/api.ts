import { API_BASE } from '@/lib/api';
import { getBdsTenantId } from '@/lib/bds/api';

export type ChatRoom = {
  id: string;
  kind: 'dept' | 'cross' | 'dm' | 'huddle';
  code: string;
  name: string;
  sensitivity: 'normal' | 'restricted';
  status: 'active' | 'archived';
};

export type ChatMessage = {
  id: string;
  kind: string;
  body: string;
  hidden?: boolean;
  author_staff_id: number | null;
  created_at: string;
};

async function staffChatFetch<T>(token: string, path: string): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`CHAT ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function staffChatMutate<T>(
  token: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `CHAT ${path} → ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchChatRooms(token: string): Promise<ChatRoom[]> {
  return staffChatFetch(token, '/api/v1/staff-chat/rooms');
}

export async function fetchChatMessages(token: string, roomId: string): Promise<ChatMessage[]> {
  return staffChatFetch(token, `/api/v1/staff-chat/rooms/${roomId}/messages`);
}

export function postChatMessage(token: string, roomId: string, body: string) {
  return staffChatMutate(token, `/api/v1/staff-chat/rooms/${roomId}/messages`, 'POST', { body });
}
