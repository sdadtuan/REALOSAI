'use client';

import { ApiError } from '@/lib/api';
import { fetchLeadCallToken, startLeadB2bCall } from '@/lib/b2b-calls-api';
import { phoneTelHref, shouldTelFallbackOnCallError } from '@/lib/lead-contact-call.util';
import { placeStringeeWebCall } from '@/lib/stringee-web.util';

export async function placeB2bSoftphoneCall(input: {
  accessToken: string;
  leadId: number;
  phone: string;
}): Promise<'webrtc' | 'server' | 'tel'> {
  try {
    const token = await fetchLeadCallToken(input.accessToken, input.leadId);
    await startLeadB2bCall(input.accessToken, input.leadId);
    await placeStringeeWebCall({
      accessToken: token.access_token,
      fromNumber: token.from_number || token.user_id,
      toNumber: token.to_number || input.phone,
    });
    return 'webrtc';
  } catch (err) {
    if (!shouldTelFallbackOnCallError(err)) {
      if (err instanceof ApiError) throw err;
    }
  }

  try {
    await startLeadB2bCall(input.accessToken, input.leadId);
    return 'server';
  } catch (err) {
    if (shouldTelFallbackOnCallError(err)) {
      window.location.href = phoneTelHref(input.phone);
      return 'tel';
    }
    throw err;
  }
}
