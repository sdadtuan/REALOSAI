export function shouldEmitCapiPurchase(
  stage: string,
  purchaseAt: 'deposit' | 'contracted',
): boolean {
  return stage === purchaseAt;
}

export function capiPurchaseValueVnd(tx: {
  net_price_vnd?: number;
  list_price_vnd?: number;
}): number {
  return Number(tx.net_price_vnd ?? 0);
}

export function shouldEnqueueCapiHttp(input: { capiOn: boolean; clientId: string }): boolean {
  return Boolean(input.capiOn && String(input.clientId ?? '').trim());
}

export function buildCapiDispatchPayload(input: {
  clientId: string;
  leadId?: number | null;
  eventName: 'Lead' | 'Schedule' | 'Purchase';
  valueVnd: number | null;
  eventId: string;
}): Record<string, unknown> {
  return {
    client_id: input.clientId,
    lead_id: input.leadId ?? undefined,
    event: {
      event_name: input.eventName,
      value: input.valueVnd,
      currency: 'VND',
      event_id: input.eventId,
    },
  };
}
