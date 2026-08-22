import type { LeadMeetingPrepRow } from './lead-meeting-prep.types';

export interface LmpOfferLadderSummaryItem {
  tier: string;
  sku_code: string;
  label_vi: string;
  anchor_role: string;
  price_hint_vnd: number | null;
}

export interface LmpRedFlagItem {
  flag_vi: string;
  severity: 'warn' | 'block';
  mitigation_vi: string;
}

export interface LmpDealRoomSciSlice {
  available: boolean;
  prep_stage: string | null;
  close_readiness_score: number | null;
  opening_narrative_vi: string;
  slide_bullets_vi: string[];
  recommended_close_ask_vi: string;
  offer_ladder_summary: LmpOfferLadderSummaryItem[];
  red_flags: LmpRedFlagItem[];
  playbook_slug: string | null;
  playbook_label_vi: string | null;
  href_prep: string;
}

const EMPTY_SLICE = (leadId: number): LmpDealRoomSciSlice => ({
  available: false,
  prep_stage: null,
  close_readiness_score: null,
  opening_narrative_vi: '',
  slide_bullets_vi: [],
  recommended_close_ask_vi: '',
  offer_ladder_summary: [],
  red_flags: [],
  playbook_slug: null,
  playbook_label_vi: null,
  href_prep: `/crm/leads/${leadId}?prep=1`,
});

function asRecord(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : null;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((v) => String(v ?? '').trim()).filter(Boolean);
}

export function buildLmpDealRoomSciSlice(
  row: LeadMeetingPrepRow | null,
  leadId: number,
): LmpDealRoomSciSlice {
  const base = EMPTY_SLICE(leadId);
  if (!row || row.status !== 'ready') return base;

  const result = row.result_json;
  const sci = asRecord(result?.close_intelligence);
  if (!sci) return base;

  const competitive = asRecord(sci.competitive_angle);
  const drp = asRecord(sci.deal_room_payload);
  const ladderRaw = Array.isArray(sci.offer_ladder) ? sci.offer_ladder : [];
  const offerLadderSummary: LmpOfferLadderSummaryItem[] = ladderRaw
    .map((item) => {
      const rowObj = asRecord(item);
      if (!rowObj) return null;
      return {
        tier: String(rowObj.tier ?? ''),
        sku_code: String(rowObj.sku_code ?? ''),
        label_vi: String(rowObj.label_vi ?? rowObj.headline_vi ?? ''),
        anchor_role: String(rowObj.anchor_role ?? ''),
        price_hint_vnd:
          rowObj.price_hint_vnd != null && Number.isFinite(Number(rowObj.price_hint_vnd))
            ? Number(rowObj.price_hint_vnd)
            : null,
      };
    })
    .filter((x): x is LmpOfferLadderSummaryItem => x != null);

  const redFlags: LmpRedFlagItem[] = (Array.isArray(sci.red_flags) ? sci.red_flags : [])
    .map((item) => {
      const rowObj = asRecord(item);
      if (!rowObj) return null;
      const severity = String(rowObj.severity ?? 'warn');
      return {
        flag_vi: String(rowObj.flag_vi ?? ''),
        severity: severity === 'block' ? 'block' : 'warn',
        mitigation_vi: String(rowObj.mitigation_vi ?? ''),
      };
    })
    .filter((x): x is LmpRedFlagItem => x != null && Boolean(x.flag_vi));

  const opening =
    String(drp?.opening_narrative_vi ?? '').trim() ||
    String(asRecord(sci.talk_track)?.phases ? '' : '').trim();
  const talkTrack = asRecord(sci.talk_track);
  const phases = Array.isArray(talkTrack?.phases) ? talkTrack.phases : [];
  const fallbackOpening =
    phases.length && asRecord(phases[0])?.script_vi
      ? String(asRecord(phases[0])?.script_vi)
      : '';

  return {
    available: true,
    prep_stage: row.prep_stage,
    close_readiness_score: row.close_readiness_score,
    opening_narrative_vi: opening || fallbackOpening,
    slide_bullets_vi: drp ? asStringArray(drp.slide_bullets_vi) : [],
    recommended_close_ask_vi: String(drp?.recommended_close_ask_vi ?? '').trim(),
    offer_ladder_summary: offerLadderSummary,
    red_flags: redFlags,
    playbook_slug: competitive?.playbook_slug != null ? String(competitive.playbook_slug) : null,
    playbook_label_vi: competitive?.playbook_label_vi != null ? String(competitive.playbook_label_vi) : null,
    href_prep: `/crm/leads/${leadId}?prep=1`,
  };
}
