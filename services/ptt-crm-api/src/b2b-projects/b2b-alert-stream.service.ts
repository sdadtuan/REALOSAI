import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common/interfaces';
import { Observable, map, switchMap, timer } from 'rxjs';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { hasGdkdViewAllLeads } from '../staff-permissions/staff-gdkd.util';
import { B2bAlertsRepository } from './b2b-alerts.repository';
import { hashB2bAlertInbox } from './b2b-alert-stream.util';

@Injectable()
export class B2bAlertStreamService {
  constructor(
    private readonly repo: B2bAlertsRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  streamForStaff(staffUser: StaffJwtPayload): Observable<MessageEvent> {
    let lastHash = '';

    return timer(0, 2000).pipe(
      switchMap(async () => {
        const me = await this.staffAuth.me(staffUser);
        const staffId = await this.staffAuth.resolveCrmStaffUserId(staffUser);
        const scopeAll = hasGdkdViewAllLeads(me.caps);
        const items = await this.repo.listAlerts({
          staffId: scopeAll ? undefined : staffId ?? undefined,
          limit: 50,
        });
        const hash = hashB2bAlertInbox(
          items.map((row) => ({ id: row.id, severity: row.severity })),
        );
        const changed = hash !== lastHash;
        if (changed) lastHash = hash;
        return {
          ok: true,
          changed,
          items,
        };
      }),
      map((payload) => ({ data: payload })),
    );
  }
}
