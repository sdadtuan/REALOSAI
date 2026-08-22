import { ForbiddenException } from '@nestjs/common';

/** P2-12 — BR-AI-01: no auto-send email/Zalo to customers from AI flows. */
export function rejectMktAiAutoCustomerEmail(
  autoCustomerEmailEnabled: boolean,
  opts: {
    send_email?: boolean;
    email_customer?: boolean;
    notify_client?: boolean;
    notify_customer?: boolean;
  } = {},
): void {
  const requested =
    opts.send_email === true ||
    opts.email_customer === true ||
    opts.notify_client === true ||
    opts.notify_customer === true;
  if (!requested) return;
  if (autoCustomerEmailEnabled) return;
  throw new ForbiddenException({
    error: 'mkt_ai_auto_customer_email_blocked',
    message: 'Không auto-gửi email khách từ AI (BR-AI-01). Chỉ draft — AM/SP gửi thủ công sau duyệt.',
    policy: 'PTT_MKT_AI_AUTO_CUSTOMER_EMAIL=0',
  });
}

export const MKT_AI_CUSTOMER_EMAIL_POLICY_VI =
  'Không auto-gửi email khách từ AI — draft + human approve (BR-AI-01).';
