const CLIENT_FACING = new Set(['approved_client_facing', 'published']);

export function buildPortalWatermark(input: {
  clientId: string;
  email: string;
  at: Date;
}): string {
  const day = input.at.toISOString().slice(0, 10);
  return `CONFIDENTIAL · ${input.clientId} · ${input.email} · ${day}`;
}

export function assertPortalReportReadable(input: {
  portalVisible: boolean;
  embargoUntil: string | null;
  expiresAt: string | null;
  now: Date;
}): void {
  if (!input.portalVisible) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' });
  }
  if (input.embargoUntil && input.now < new Date(input.embargoUntil)) {
    throw Object.assign(new Error('embargo_active'), { code: 'embargo_active' });
  }
  if (input.expiresAt && input.now > new Date(input.expiresAt)) {
    throw Object.assign(new Error('report_expired'), { code: 'report_expired' });
  }
}

export function assertPublishableInsights(
  statuses: Array<string | null | undefined>,
): void {
  if (!statuses.length || statuses.some((s) => !CLIENT_FACING.has(String(s ?? '')))) {
    throw Object.assign(new Error('insights_not_client_facing'), {
      code: 'insights_not_client_facing',
    });
  }
}
