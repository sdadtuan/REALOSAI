import { describe, expect, it } from 'vitest';
import {
  SPARKTORO_DISABLED_TITLE,
  SPARKTORO_SOURCES_BANNER,
  shouldShowSparktoroButton,
} from './sources-sparktoro.util';

describe('sources-sparktoro.util', () => {
  it('keeps Sources estimate banner and disabled title verbatim', () => {
    expect(SPARKTORO_SOURCES_BANNER).toBe(
      'Nguồn ước lượng — ghi limitation. Không tự tạo insight.',
    );
    expect(SPARKTORO_DISABLED_TITLE).toBe('Cần quyền chạy job và SparkToro đã cấu hình');
  });

  it('hides Chạy SparkToro when health.sparktoro_enabled is false', () => {
    expect(shouldShowSparktoroButton(false, true)).toBe(false);
    expect(shouldShowSparktoroButton(false, false)).toBe(false);
  });

  it('shows Chạy SparkToro only when sparktoro is enabled and actor can run', () => {
    expect(shouldShowSparktoroButton(true, true)).toBe(true);
    expect(shouldShowSparktoroButton(true, false)).toBe(false);
  });
});
