'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { lockVideoStudio, parseCmktGateError } from '@/lib/content-os-api';
import { VIDEO_SOP_API, type CreateVdProjectBody, type VdProjectRow } from '@/lib/video-sop-api';

export const VIDEO_STUDIO_SOCIAL_LABEL = 'Video tuần (FFmpeg)';
export const VIDEO_STUDIO_CINEMATIC_LABEL = 'Video chiến dịch (SOP)';
export const VIDEO_STUDIO_SOP_HELPER = 'Module 7 chưa ship';
export const VIDEO_STUDIO_SOP_HUB = '/crm/video';

export function isCinematicVideoStudioEnabled(
  flag: string | undefined = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC,
): boolean {
  return flag === '1';
}

type StudioChoice = 'social' | 'cinematic';

export type PickCinematicStudioArgs = {
  token: string;
  lifecycleId: number;
  itemId: number;
  createProject: (token: string, body: CreateVdProjectBody) => Promise<Pick<VdProjectRow, 'id'>>;
  onSelect: (studio: 'cinematic') => void | Promise<void>;
  navigate: (href: string) => void;
};

export async function pickCinematicStudio(args: PickCinematicStudioArgs): Promise<void> {
  if (!isCinematicVideoStudioEnabled()) return;
  const project = await args.createProject(args.token, {
    lifecycle_id: args.lifecycleId,
    cmkt_item_id: args.itemId,
  });
  await args.onSelect('cinematic');
  args.navigate(`/crm/video/${project.id}`);
}

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  disabled?: boolean;
  onSelect: (studio: StudioChoice) => void | Promise<void>;
  onError: (msg: string) => void;
  onMessage?: (msg: string) => void;
}

export function ContentOsVideoStudioPicker({
  token,
  lifecycleId,
  itemId,
  disabled = false,
  onSelect,
  onError,
  onMessage,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cinematicEnabled = isCinematicVideoStudioEnabled();

  async function pickSocial() {
    if (disabled || busy) return;
    setBusy(true);
    onError('');
    try {
      await lockVideoStudio(token, lifecycleId, itemId, 'social');
      onMessage?.('Đã khóa studio Video tuần (FFmpeg)');
      await onSelect('social');
    } catch (err) {
      onError(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickCinematic() {
    if (!cinematicEnabled || disabled || busy) return;
    setBusy(true);
    onError('');
    try {
      await pickCinematicStudio({
        token,
        lifecycleId,
        itemId,
        createProject: VIDEO_SOP_API.createProject,
        onSelect,
        navigate: (href) => {
          router.push(href);
        },
      });
    } catch (err) {
      onError(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Chọn studio video</strong>
      <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>
        Không đổi studio sau khi đã có job. Clone item nếu cần engine kia.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.65rem',
        }}
      >
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void pickSocial()}
          style={cardStyle(disabled || busy)}
        >
          <div style={{ fontWeight: 650 }}>{VIDEO_STUDIO_SOCIAL_LABEL}</div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            15–35s · TTS + B-roll · caption · vài phút · rẻ
          </div>
          <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
            Phù hợp: Reels/TikTok retainer, lịch tuần
          </div>
        </button>

        <button
          type="button"
          disabled={!cinematicEnabled || disabled || busy}
          onClick={() => void pickCinematic()}
          title={
            cinematicEnabled
              ? 'Mở hub Video SOP'
              : `${VIDEO_STUDIO_SOP_HELPER} — ${VIDEO_STUDIO_SOP_HUB}`
          }
          style={cardStyle(!cinematicEnabled || disabled || busy)}
        >
          <div style={{ fontWeight: 650 }}>{VIDEO_STUDIO_CINEMATIC_LABEL}</div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            15–60s · 4 cổng QC · keyframe → Kling/Runway · 9–18 giờ
          </div>
          {!cinematicEnabled ? (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
              {VIDEO_STUDIO_SOP_HELPER} / {VIDEO_STUDIO_SOP_HUB} — spec Module 7, không mở form SOP.
            </div>
          ) : (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
              Mở hub {VIDEO_STUDIO_SOP_HUB} (không form beat trong Media AI).
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function cardStyle(disabled: boolean): React.CSSProperties {
  return {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.85rem',
    background: 'var(--bg)',
    color: 'var(--text)',
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}
