/** E2E stub fixture — AC-11 seven-shot / ~30s reels brief (S10 Task 40). */

export const VD_E2E_SHOT_COUNT = 7;
export const VD_E2E_SHOT_DURATION_MS = 4000;
export const VD_E2E_PLATFORM = 'reels';

export type VdE2eBriefBody = {
  objective: string;
  audience: string;
  offer: string;
  duration_sec: number;
  platform: string;
  tone: string;
  constraints: string;
  insight_ids: number[];
};

export function buildVdE2eBrief(): VdE2eBriefBody {
  return {
    objective: 'Tăng nhận biết thương hiệu qua video 30 giây',
    audience: 'Khách hàng trẻ thích short-form trên Reels',
    offer: 'Gói retainer video chiến dịch PTT',
    duration_sec: 30,
    platform: VD_E2E_PLATFORM,
    tone: 'Năng động, rõ ràng, CTA cuối',
    constraints: 'Không logo đối thủ · AI disclosure bắt buộc',
    insight_ids: [],
  };
}

export type VdE2eShotDraft = {
  duration_ms: number;
  camera: string;
  action: string;
  aspect: string;
  contains_human: boolean;
  text_in_frame: boolean;
  logo_in_ai_frame: boolean;
};

export function buildVdE2eShots(count = VD_E2E_SHOT_COUNT): VdE2eShotDraft[] {
  return Array.from({ length: count }, (_row, idx) => ({
    duration_ms: VD_E2E_SHOT_DURATION_MS,
    camera: idx === 0 ? 'close-up hook' : 'wide product',
    action: `Beat ${idx + 1} — value prop`,
    aspect: '9:16',
    contains_human: idx === 0,
    text_in_frame: false,
    logo_in_ai_frame: false,
  }));
}

export function vdE2eUsesLiveProviders(): boolean {
  return process.env.VD_E2E_PROVIDERS === '1';
}
