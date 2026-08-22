import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalClientRole } from '../agency/portal-client-users.types';
import { PortalNotifyWebhookService } from './portal-notify-webhook.service';

export interface PortalCredentialsEmailParams {
  to: string;
  clientName: string;
  clientCode?: string;
  role: PortalClientRole;
  password: string;
}

export interface PortalCredentialsEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

const ROLE_LABELS: Record<PortalClientRole, string> = {
  viewer: 'Viewer — xem báo cáo',
  approver: 'Approver — xem và duyệt nội dung',
};

@Injectable()
export class PortalCredentialsNotifyService {
  private readonly logger = new Logger(PortalCredentialsNotifyService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly webhook: PortalNotifyWebhookService,
  ) {}

  buildTemplate(params: PortalCredentialsEmailParams): { subject: string; body: string; html: string } {
    const portalUrl = this.config.portalPublicUrl;
    const loginUrl = `${portalUrl}/login`;
    const settingsUrl = `${portalUrl}/settings`;
    const forgotUrl = `${portalUrl}/forgot-password`;
    const clientLabel = params.clientCode
      ? `${params.clientName} (${params.clientCode})`
      : params.clientName;
    const roleLabel = ROLE_LABELS[params.role] ?? params.role;

    const subject = `[PTT] Thông tin đăng nhập Client Portal — ${params.clientName}`;

    const body =
      `Kính gửi Quý khách,\n\n` +
      `PTT đã tạo tài khoản Client Portal cho ${clientLabel}.\n\n` +
      `• URL đăng nhập: ${loginUrl}\n` +
      `• Email: ${params.to}\n` +
      `• Mật khẩu tạm: ${params.password}\n` +
      `• Vai trò: ${roleLabel}\n\n` +
      `Lưu ý bảo mật:\n` +
      `- Đổi mật khẩu sau lần đăng nhập đầu tiên tại ${settingsUrl}\n` +
      `- Quên mật khẩu: ${forgotUrl}\n\n` +
      `Trân trọng,\n` +
      `PTT Account Team`;

    const html =
      `<p>Kính gửi Quý khách,</p>` +
      `<p>PTT đã tạo tài khoản <strong>Client Portal</strong> cho <strong>${this.escapeHtml(clientLabel)}</strong>.</p>` +
      `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">` +
      `<tr><td><strong>URL đăng nhập</strong></td><td><a href="${loginUrl}">${loginUrl}</a></td></tr>` +
      `<tr><td><strong>Email</strong></td><td>${this.escapeHtml(params.to)}</td></tr>` +
      `<tr><td><strong>Mật khẩu tạm</strong></td><td><code>${this.escapeHtml(params.password)}</code></td></tr>` +
      `<tr><td><strong>Vai trò</strong></td><td>${this.escapeHtml(roleLabel)}</td></tr>` +
      `</table>` +
      `<p><strong>Lưu ý bảo mật:</strong></p>` +
      `<ul>` +
      `<li>Đổi mật khẩu sau lần đăng nhập đầu tiên tại <a href="${settingsUrl}">${settingsUrl}</a></li>` +
      `<li>Quên mật khẩu: <a href="${forgotUrl}">${forgotUrl}</a></li>` +
      `</ul>` +
      `<p>Trân trọng,<br/>PTT Account Team</p>`;

    return { subject, body, html };
  }

  async sendCredentialsEmail(params: PortalCredentialsEmailParams): Promise<PortalCredentialsEmailResult> {
    if (!this.config.portalEmailNotifyEnabled) {
      this.logger.log('portal credentials email disabled to=%s', params.to);
      return { ok: true, skipped: true };
    }

    const { subject, body, html } = this.buildTemplate(params);
    const result = await this.webhook.send({
      source: 'portal_credentials_welcome',
      to: params.to,
      subject,
      body,
      html,
      client_name: params.clientName,
      client_code: params.clientCode ?? null,
      role: params.role,
      login_url: `${this.config.portalPublicUrl}/login`,
    });

    if (result.skipped) {
      return { ok: true, skipped: true };
    }
    if (!result.ok) {
      this.logger.warn('portal credentials email webhook failed: %s', result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
