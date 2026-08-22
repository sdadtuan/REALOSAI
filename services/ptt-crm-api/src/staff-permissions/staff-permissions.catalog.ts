import { readFileSync } from 'fs';
import { join } from 'path';
import type { StaffPermissionCatalogDoc } from './staff-permissions.types';

let cached: StaffPermissionCatalogDoc | null = null;

export function loadStaffPermissionCatalog(): StaffPermissionCatalogDoc {
  if (cached) return cached;
  const path = join(__dirname, 'rbac-admin-catalog.json');
  cached = JSON.parse(readFileSync(path, 'utf8')) as StaffPermissionCatalogDoc;
  return cached;
}

export function catalogPermissionIds(catalog = loadStaffPermissionCatalog()): Set<string> {
  return new Set(catalog.permission_ids);
}

export function catalogActionsForSection(
  sectionId: string,
  catalog = loadStaffPermissionCatalog(),
): string[] {
  return catalog.section_actions[sectionId] ?? catalog.actions.map((a) => a.id);
}

export function catalogActionLabel(actionId: string, catalog = loadStaffPermissionCatalog()): string {
  const std = catalog.actions.find((a) => a.id === actionId);
  if (std) return std.label;
  return catalog.extra_action_labels[actionId] ?? actionId;
}

export function normalizeGrantPayload(
  raw: Record<string, string[]>,
  catalog = loadStaffPermissionCatalog(),
): Record<string, string[]> {
  const allowedIds = catalogPermissionIds(catalog);
  const out: Record<string, string[]> = {};
  for (const [sectionId, actions] of Object.entries(raw ?? {})) {
    if (!allowedIds.has(sectionId) || !Array.isArray(actions)) continue;
    const validActions = new Set(catalogActionsForSection(sectionId, catalog));
    const btn = catalog.ui_buttons.find((b) => b.id === sectionId);
    const normalized = [
      ...new Set(
        actions
          .map((a) => String(a || '').trim().toLowerCase())
          .filter((a) => {
            if (btn) return a === btn.requires_action;
            return validActions.has(a);
          }),
      ),
    ].sort();
    if (normalized.length) out[sectionId] = normalized;
  }
  return out;
}

export function capsToGrantMap(caps: Array<{ section_id: string; action: string }>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const cap of caps) {
    const sid = String(cap.section_id || '').trim();
    const act = String(cap.action || '').trim().toLowerCase();
    if (!sid || !act) continue;
    if (!out[sid]) out[sid] = [];
    if (!out[sid].includes(act)) out[sid].push(act);
  }
  for (const sid of Object.keys(out)) {
    out[sid].sort();
  }
  return out;
}

export function grantsToMatrix(
  grants: Record<string, string[]>,
  catalog = loadStaffPermissionCatalog(),
): import('./staff-permissions.types').StaffPermissionMatrixRow[] {
  const rows: import('./staff-permissions.types').StaffPermissionMatrixRow[] = [];
  const buttonsByParent = new Map<string, typeof catalog.ui_buttons>();
  for (const btn of catalog.ui_buttons) {
    const list = buttonsByParent.get(btn.parent_section) ?? [];
    list.push(btn);
    buttonsByParent.set(btn.parent_section, list);
  }

  for (const sec of catalog.sections) {
    const sid = sec.id;
    const allowed = new Set(grants[sid] ?? []);
    const actions = catalogActionsForSection(sid, catalog);
    rows.push({
      section_id: sid,
      section_label: sec.label,
      group: sec.group,
      page: sec.page,
      description: sec.description,
      row_kind: 'section',
      actions,
      allowed: actions.filter((a) => allowed.has(a)),
    });

    for (const btn of buttonsByParent.get(sid) ?? []) {
      const req = btn.requires_action;
      const parentAllowed = allowed.has(req);
      const btnAllowed = new Set(grants[btn.id] ?? []);
      const checked = btnAllowed.has(req) || (parentAllowed && !grants[btn.id]);
      rows.push({
        section_id: btn.id,
        section_label: btn.label,
        group: sec.group,
        page: btn.page ?? sec.page,
        description: btn.description ?? '',
        row_kind: 'ui_button',
        parent_section: sid,
        requires_action: req,
        actions: [req],
        allowed: checked ? [req] : [],
      });
    }
  }
  return rows;
}

export function diffGrantMaps(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): { added: StaffPermissionCapDiff[]; removed: StaffPermissionCapDiff[] } {
  const added: StaffPermissionCapDiff[] = [];
  const removed: StaffPermissionCapDiff[] = [];
  const allSections = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const sectionId of allSections) {
    const prev = new Set(before[sectionId] ?? []);
    const next = new Set(after[sectionId] ?? []);
    for (const action of next) {
      if (!prev.has(action)) added.push({ section_id: sectionId, action });
    }
    for (const action of prev) {
      if (!next.has(action)) removed.push({ section_id: sectionId, action });
    }
  }
  return { added, removed };
}

export type StaffPermissionCapDiff = { section_id: string; action: string };

export function grantMapToCapRows(grants: Record<string, string[]>): Array<{ section_id: string; action: string }> {
  const rows: Array<{ section_id: string; action: string }> = [];
  for (const [sectionId, actions] of Object.entries(grants)) {
    for (const action of actions) {
      rows.push({ section_id: sectionId, action });
    }
  }
  return rows;
}
