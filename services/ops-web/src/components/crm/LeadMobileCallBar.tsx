'use client';

import { placeB2bSoftphoneCall } from '@/components/crm/B2bSoftphone';
import { phoneTelHref, shouldTelFallbackOnCallError } from '@/lib/lead-contact-call.util';

export function LeadMobileCallBar({
  phone,
  leadId,
  accessToken,
  onCopy,
}: {
  phone: string;
  leadId: number;
  accessToken?: string | null;
  onCopy?: (value: string, label: string) => void;
}) {
  if (!phone.trim()) return null;

  async function handleSoftphoneCall(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!accessToken) return;
    event.preventDefault();
    try {
      await placeB2bSoftphoneCall({ accessToken, leadId, phone });
    } catch (err) {
      if (shouldTelFallbackOnCallError(err)) {
        window.location.href = phoneTelHref(phone);
        return;
      }
      window.location.href = phoneTelHref(phone);
    }
  }

  return (
    <div className="lead-b2b-call-sticky" data-testid="lead-b2b-call-sticky">
      <a
        href={phoneTelHref(phone)}
        className="lead-b2b-call-sticky__btn"
        data-testid="lead-b2b-call-sticky-btn"
        onClick={(e) => void handleSoftphoneCall(e)}
      >
        Gọi ngay
      </a>
      {onCopy ? (
        <button
          type="button"
          className="lead-b2b-call-sticky__secondary"
          onClick={() => onCopy(phone, 'SĐT')}
        >
          Copy SĐT
        </button>
      ) : null}
    </div>
  );
}
