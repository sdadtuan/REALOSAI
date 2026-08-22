import { Injectable } from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { parseMentionEmails } from './staff-mention.util';
import { StaffNotificationsRepository } from './staff-notifications.repository';

@Injectable()
export class StaffMentionService {
  constructor(
    private readonly notifications: StaffNotificationsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async notifyActivityMentions(params: {
    leadId: number;
    content: string;
    actorEmail: string;
  }): Promise<number> {
    const emails = parseMentionEmails(params.content);
    if (!emails.length) return 0;

    const roster = await this.staffAuth.listActiveStaff();
    const byEmail = new Map(
      roster.staff.map((s) => [String(s.email).trim().toLowerCase(), s]),
    );

    const inputs = [];
    for (const email of emails) {
      if (email === params.actorEmail.trim().toLowerCase()) continue;
      const staff = byEmail.get(email);
      if (!staff) continue;
      inputs.push({
        user_id: staff.id,
        kind: 'mention',
        title: `${params.actorEmail} nhắc bạn trên lead #${params.leadId}`,
        body: params.content.slice(0, 500),
        link_href: `/crm/leads/${params.leadId}`,
        meta_json: {
          lead_id: params.leadId,
          mentioned_email: email,
          actor_email: params.actorEmail,
        },
      });
    }

    if (!inputs.length) return 0;
    return this.notifications.createMany(inputs);
  }
}
