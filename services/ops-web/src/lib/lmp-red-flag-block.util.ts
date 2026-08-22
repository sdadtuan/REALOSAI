type RedFlag = { flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string };

export function blockingRedFlags(flags: RedFlag[] | undefined): RedFlag[] {
  return (flags ?? []).filter((f) => f.severity === 'block' && f.flag_vi.trim());
}

export function sciBlocksQuoteForUser(
  flags: RedFlag[] | undefined,
  isGdkd: boolean,
): { blocked: boolean; reason: string; flags: RedFlag[] } {
  const blocks = blockingRedFlags(flags);
  if (!blocks.length || isGdkd) {
    return { blocked: false, reason: '', flags: blocks };
  }
  return {
    blocked: true,
    flags: blocks,
    reason: `SCI chặn tạo báo giá: ${blocks.map((f) => f.flag_vi).join('; ')} — liên hệ GDKD để override.`,
  };
}
