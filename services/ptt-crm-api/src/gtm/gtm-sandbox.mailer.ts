export type SandboxMailPayload = {
  to: string;
  username: string;
  password: string;
  loginUrl: string;
  expiresAt: Date;
  industry: string;
  boardUrl: string;
};

export interface GtmSandboxMailer {
  sendSandboxCredential(payload: SandboxMailPayload): Promise<'sent' | 'bounce'>;
}

export class ConsoleGtmSandboxMailer implements GtmSandboxMailer {
  async sendSandboxCredential(payload: SandboxMailPayload): Promise<'sent' | 'bounce'> {
    if (payload.to.includes('bounce@')) {
      return 'bounce';
    }
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.info(
        '[gtm-sandbox-mail]',
        payload.to,
        payload.username,
        payload.boardUrl,
      );
    }
    return 'sent';
  }
}

export const GTM_SANDBOX_MAILER = Symbol('GTM_SANDBOX_MAILER');
