import type { SnapshotPillarDraft } from './content-plan-snapshot.util';

export type CmktDriftCalendarRow = {
  title: string;
  date: string;
  channel: string;
  type?: string;
};

export type CmktDriftDiffPayload = {
  drift: boolean;
  can_reingest: boolean;
  pillars: {
    added: SnapshotPillarDraft[];
    removed: SnapshotPillarDraft[];
    changed: Array<{ name: string; field: string; before: string; after: string }>;
  };
  calendar: {
    added: CmktDriftCalendarRow[];
    removed: CmktDriftCalendarRow[];
    changed: Array<{ title: string; field: string; before: string; after: string }>;
  };
};

function pillarKey(p: { name: string }): string {
  return p.name.trim().toLowerCase();
}

function calendarKey(row: CmktDriftCalendarRow): string {
  return `${String(row.date ?? '').trim()}|${row.title.trim().toLowerCase()}`;
}

export function diffPlannerPillars(
  snapshot: SnapshotPillarDraft[],
  current: SnapshotPillarDraft[],
): CmktDriftDiffPayload['pillars'] {
  const snapMap = new Map(snapshot.map((p) => [pillarKey(p), p]));
  const curMap = new Map(current.map((p) => [pillarKey(p), p]));
  const added: SnapshotPillarDraft[] = [];
  const removed: SnapshotPillarDraft[] = [];
  const changed: Array<{ name: string; field: string; before: string; after: string }> = [];

  for (const [key, cur] of curMap) {
    const snap = snapMap.get(key);
    if (!snap) {
      added.push(cur);
      continue;
    }
    if (snap.goal !== cur.goal) {
      changed.push({ name: cur.name, field: 'goal', before: snap.goal, after: cur.goal });
    }
    const snapTopics = (snap.topics ?? []).join('|');
    const curTopics = (cur.topics ?? []).join('|');
    if (snapTopics !== curTopics) {
      changed.push({
        name: cur.name,
        field: 'topics',
        before: snapTopics || '—',
        after: curTopics || '—',
      });
    }
  }

  for (const [key, snap] of snapMap) {
    if (!curMap.has(key)) removed.push(snap);
  }

  return { added, removed, changed };
}

export function diffPlannerCalendar(
  snapshot: CmktDriftCalendarRow[],
  current: CmktDriftCalendarRow[],
): CmktDriftDiffPayload['calendar'] {
  const snapMap = new Map(snapshot.map((r) => [calendarKey(r), r]));
  const curMap = new Map(current.map((r) => [calendarKey(r), r]));
  const added: CmktDriftCalendarRow[] = [];
  const removed: CmktDriftCalendarRow[] = [];
  const changed: Array<{ title: string; field: string; before: string; after: string }> = [];

  for (const [key, cur] of curMap) {
    const snap = snapMap.get(key);
    if (!snap) {
      added.push(cur);
      continue;
    }
    if (String(snap.channel ?? '') !== String(cur.channel ?? '')) {
      changed.push({
        title: cur.title,
        field: 'channel',
        before: String(snap.channel ?? '—'),
        after: String(cur.channel ?? '—'),
      });
    }
    if (String(snap.type ?? '') !== String(cur.type ?? '')) {
      changed.push({
        title: cur.title,
        field: 'type',
        before: String(snap.type ?? '—'),
        after: String(cur.type ?? '—'),
      });
    }
  }

  for (const [key, snap] of snapMap) {
    if (!curMap.has(key)) removed.push(snap);
  }

  return { added, removed, changed };
}

export function buildDriftDiffPayload(input: {
  drift: boolean;
  canReingest: boolean;
  snapshotPillars: SnapshotPillarDraft[];
  currentPillars: SnapshotPillarDraft[];
  snapshotCalendar: CmktDriftCalendarRow[];
  currentCalendar: CmktDriftCalendarRow[];
}): CmktDriftDiffPayload {
  return {
    drift: input.drift,
    can_reingest: input.canReingest,
    pillars: diffPlannerPillars(input.snapshotPillars, input.currentPillars),
    calendar: diffPlannerCalendar(input.snapshotCalendar, input.currentCalendar),
  };
}
