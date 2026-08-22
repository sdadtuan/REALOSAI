import {
  buildAdminNavGroups,
  canViewAdminSection,
  type AdminNavGroupId,
} from '@/lib/admin/admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

export type AdminSearchHit = {
  href: string;
  label: string;
  groupLabel: string;
  groupId: AdminNavGroupId | 'hub';
  keywords: string;
};

export function normalizeAdminSearchText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function buildKeywords(parts: string[]): string {
  return normalizeAdminSearchText(parts.join(' '));
}

export function buildAdminSearchIndex(user: StoredStaffUser | null): AdminSearchHit[] {
  if (!user || !canViewAdminSection(user)) return [];

  const hits: AdminSearchHit[] = [
    {
      href: '/admin',
      label: 'Trung tâm quản trị',
      groupLabel: 'Control Plane',
      groupId: 'hub',
      keywords: buildKeywords(['Trung tâm quản trị', 'Control Plane', 'Quản trị hệ thống', '/admin']),
    },
  ];

  for (const group of buildAdminNavGroups(user)) {
    for (const link of group.links) {
      hits.push({
        href: link.href,
        label: link.label,
        groupLabel: group.label,
        groupId: group.id,
        keywords: buildKeywords([link.label, group.label, link.href]),
      });
    }
  }

  return hits;
}

function tokenizeQuery(query: string): string[] {
  return normalizeAdminSearchText(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreHit(hit: AdminSearchHit, tokens: string[], rawQuery: string): number {
  const normalizedQuery = normalizeAdminSearchText(rawQuery.trim());
  let score = 0;

  if (normalizeAdminSearchText(hit.label).startsWith(normalizedQuery)) score += 100;
  if (normalizeAdminSearchText(hit.groupLabel).includes(normalizedQuery)) score += 40;

  for (const token of tokens) {
    if (normalizeAdminSearchText(hit.label).startsWith(token)) score += 30;
    else if (hit.keywords.includes(token)) score += 10;
    else return -1;
  }

  return score;
}

export function searchAdminRoutes(
  user: StoredStaffUser | null,
  query: string,
  limit = 8,
): AdminSearchHit[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tokens = tokenizeQuery(trimmed);
  if (!tokens.length) return [];

  const index = buildAdminSearchIndex(user);
  return index
    .map((hit) => ({ hit, score: scoreHit(hit, tokens, trimmed) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.hit.label.localeCompare(b.hit.label, 'vi'))
    .slice(0, limit)
    .map(({ hit }) => hit);
}

export function parseAdminSearchPrefix(raw: string): { query: string; adminOnly: boolean } {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('admin:')) {
    return { query: trimmed.slice(6).trim(), adminOnly: true };
  }
  if (lower.startsWith('qt:')) {
    return { query: trimmed.slice(3).trim(), adminOnly: true };
  }
  return { query: trimmed, adminOnly: false };
}
