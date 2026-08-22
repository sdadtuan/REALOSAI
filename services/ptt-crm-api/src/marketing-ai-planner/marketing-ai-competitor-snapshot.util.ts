import type { MktAiBrief, MktAiCompetitorSnapshot, MktAiCompetitorSnapshotEntry } from './marketing-ai-planner.types';

function threatForIndex(i: number, total: number): MktAiCompetitorSnapshotEntry['threat_level'] {
  if (total <= 1) return 'medium';
  if (i === 0) return 'high';
  if (i === 1) return 'medium';
  return 'low';
}

export function buildCompetitorSnapshotFromBrief(
  brief: MktAiBrief | null,
  source: MktAiCompetitorSnapshot['source'] = 'stub',
): MktAiCompetitorSnapshot {
  const names = (brief?.competitors ?? []).map((c) => String(c).trim()).filter(Boolean);
  const industry = String(brief?.industry ?? 'ngành').trim() || 'ngành';
  const brand = String(brief?.brand_name ?? 'thương hiệu').trim() || 'thương hiệu';

  const competitors: MktAiCompetitorSnapshotEntry[] = names.map((name, i) => ({
    name,
    positioning: `Đối thủ ${name} — positioning trung bình trong ${industry}`,
    strengths: ['Nhận diện thương hiệu', 'Ngân sách MKT ổn định'],
    weaknesses: ['Chưa rõ USP online', 'Creative ít đa dạng'],
    channels: ['Meta', 'Google Search'],
    threat_level: threatForIndex(i, names.length),
  }));

  if (competitors.length === 0) {
    competitors.push({
      name: 'Đối thủ gián tiếp',
      positioning: `Các player ${industry} cạnh tranh CPL/lead online`,
      strengths: ['Giá/agency quen thuộc'],
      weaknesses: ['Thiếu differentiation rõ'],
      channels: ['Meta', 'Google'],
      threat_level: 'medium',
    });
  }

  const highThreat = competitors.filter((c) => c.threat_level === 'high').map((c) => c.name);
  const summary_vi =
    highThreat.length > 0
      ? `${brand} cần theo dõi ${highThreat.join(', ')} — ưu tiên USP và creative test hàng tuần.`
      : `${brand}: landscape ${industry} vừa phải — tập trung CPL và landing CVR.`;

  return {
    generated_at: new Date().toISOString(),
    source,
    competitors,
    summary_vi,
  };
}

export function normalizeCompetitorSnapshot(raw: unknown): MktAiCompetitorSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const list = row.competitors;
  if (!Array.isArray(list) || list.length === 0) return null;

  const competitors: MktAiCompetitorSnapshotEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const name = String(c.name ?? '').trim();
    if (!name) continue;
    const threat = String(c.threat_level ?? 'medium').toLowerCase();
    competitors.push({
      name,
      positioning: c.positioning != null ? String(c.positioning) : undefined,
      strengths: Array.isArray(c.strengths)
        ? c.strengths.map((x) => String(x).trim()).filter(Boolean)
        : undefined,
      weaknesses: Array.isArray(c.weaknesses)
        ? c.weaknesses.map((x) => String(x).trim()).filter(Boolean)
        : undefined,
      channels: Array.isArray(c.channels)
        ? c.channels.map((x) => String(x).trim()).filter(Boolean)
        : undefined,
      threat_level:
        threat === 'low' || threat === 'medium' || threat === 'high' ? threat : 'medium',
    });
  }

  if (!competitors.length) return null;

  const sourceRaw = String(row.source ?? 'stub').toLowerCase();
  const source: MktAiCompetitorSnapshot['source'] =
    sourceRaw === 'brief' || sourceRaw === 'ai' || sourceRaw === 'stub' ? sourceRaw : 'stub';

  return {
    generated_at: String(row.generated_at ?? new Date().toISOString()),
    source,
    competitors,
    summary_vi: row.summary_vi != null ? String(row.summary_vi) : undefined,
  };
}
