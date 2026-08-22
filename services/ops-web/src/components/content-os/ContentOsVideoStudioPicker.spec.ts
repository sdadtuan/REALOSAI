import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_OS_VIDEO_API_PATHS } from '@/lib/content-os-api';
import * as contentOsApi from '@/lib/content-os-api';
import {
  VIDEO_STUDIO_CINEMATIC_LABEL,
  VIDEO_STUDIO_SOCIAL_LABEL,
  isCinematicVideoStudioEnabled,
  pickCinematicStudio,
} from './ContentOsVideoStudioPicker';

const CINEMATIC_FLAG = 'NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC';

function restoreCinematicFlag(prev: string | undefined) {
  if (prev === undefined) {
    delete process.env[CINEMATIC_FLAG];
  } else {
    process.env[CINEMATIC_FLAG] = prev;
  }
}

describe('ContentOsVideoStudioPicker labels', () => {
  it('exposes locked Social and SOP card labels', () => {
    expect(VIDEO_STUDIO_SOCIAL_LABEL).toBe('Video tuần (FFmpeg)');
    expect(VIDEO_STUDIO_CINEMATIC_LABEL).toBe('Video chiến dịch (SOP)');
  });

  it('disables SOP studio unless NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC is 1', () => {
    const prev = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    try {
      delete process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
      expect(isCinematicVideoStudioEnabled()).toBe(false);

      process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '0';
      expect(isCinematicVideoStudioEnabled()).toBe(false);

      process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';
      expect(isCinematicVideoStudioEnabled()).toBe(true);
    } finally {
      restoreCinematicFlag(prev);
    }
  });
});

describe('content-os video API paths', () => {
  it('matches backend Task 7 routes', () => {
    expect(CONTENT_OS_VIDEO_API_PATHS.lockStudio(42)).toBe('/items/42/video/lock-studio');
    expect(CONTENT_OS_VIDEO_API_PATHS.storyboard(42)).toBe('/items/42/jobs/video-storyboard');
    expect(CONTENT_OS_VIDEO_API_PATHS.patchStoryboard(42)).toBe('/items/42/video/storyboard');
    expect(CONTENT_OS_VIDEO_API_PATHS.render(42)).toBe('/items/42/jobs/video-render');
  });
});

describe('pickCinematicStudio', () => {
  let prevFlag: string | undefined;

  beforeEach(() => {
    prevFlag = process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreCinematicFlag(prevFlag);
  });

  it('when flag is 1, creates vd_project and never locks social studio', async () => {
    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '1';

    const lockSpy = vi.spyOn(contentOsApi, 'lockVideoStudio');
    const createProject = vi.fn().mockResolvedValue({ id: 88 });
    const onSelect = vi.fn();
    const navigate = vi.fn();

    await pickCinematicStudio({
      token: 'staff-token',
      lifecycleId: 3,
      itemId: 42,
      createProject,
      onSelect,
      navigate,
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(createProject).toHaveBeenCalledWith('staff-token', {
      lifecycle_id: 3,
      cmkt_item_id: 42,
    });
    expect(lockSpy).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('cinematic');
    expect(navigate).toHaveBeenCalledWith('/crm/video/88');
  });

  it('when flag is unset or 0, does not create or lock studio', async () => {
    const lockSpy = vi.spyOn(contentOsApi, 'lockVideoStudio');
    const createProject = vi.fn().mockResolvedValue({ id: 88 });
    const onSelect = vi.fn();
    const navigate = vi.fn();
    const args = {
      token: 'staff-token',
      lifecycleId: 3,
      itemId: 42,
      createProject,
      onSelect,
      navigate,
    };

    delete process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC;
    await pickCinematicStudio(args);

    process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC = '0';
    await pickCinematicStudio(args);

    expect(createProject).not.toHaveBeenCalled();
    expect(lockSpy).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
