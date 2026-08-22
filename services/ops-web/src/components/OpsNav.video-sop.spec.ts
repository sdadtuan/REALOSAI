import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import { shouldShowVideoSopNav } from './ops-nav-video-sop';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

function restoreCinematicFlag(prev: string | undefined) {
  if (prev === undefined) {
    delete process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
  } else {
    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = prev;
  }
}

describe('shouldShowVideoSopNav', () => {
  it('shows when user has crm_vd.project view', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    try {
      delete process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
      expect(shouldShowVideoSopNav(user([{ section: 'crm_vd.project', action: 'view' }]))).toBe(true);
    } finally {
      restoreCinematicFlag(prev);
    }
  });

  it('shows when cinematic flag is 1 and user has crm_content view', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    try {
      process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';
      expect(shouldShowVideoSopNav(user([{ section: 'crm_content', action: 'view' }]))).toBe(true);
    } finally {
      restoreCinematicFlag(prev);
    }
  });

  it('hides when cinematic flag is off and user only has crm_content view', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    try {
      process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '0';
      expect(shouldShowVideoSopNav(user([{ section: 'crm_content', action: 'view' }]))).toBe(false);
    } finally {
      restoreCinematicFlag(prev);
    }
  });

  it('hides for crm_board view alone even when flag is 1', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    try {
      process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';
      expect(shouldShowVideoSopNav(user([{ section: 'crm_board', action: 'view' }]))).toBe(false);
    } finally {
      restoreCinematicFlag(prev);
    }
  });
});
