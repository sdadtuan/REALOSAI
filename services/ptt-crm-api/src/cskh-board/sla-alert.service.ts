import { Injectable } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common/interfaces';
import { Observable, map, switchMap, timer } from 'rxjs';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { CskhBoardService } from './cskh-board.service';
import { filterPredictionsForAlerts, slaPredictAlertHash } from './sla-predict.util';

@Injectable()
export class SlaAlertService {
  constructor(
    private readonly board: CskhBoardService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  streamForStaff(staffUser: StaffJwtPayload): Observable<MessageEvent> {
    let lastHash = '';

    return timer(0, 30_000).pipe(
      switchMap(async () => {
        const me = await this.staffAuth.me(staffUser);
        const canViewAll = this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign');
        const ownerId = canViewAll ? undefined : await this.staffAuth.resolveCrmStaffUserId(staffUser);
        const snapshot = await this.board.getSlaPredictions({
          ownerId: ownerId ?? undefined,
          viewAll: canViewAll,
        });
        const alerts = filterPredictionsForAlerts(snapshot.items);
        const hash = slaPredictAlertHash(alerts);
        const changed = hash !== lastHash;
        if (changed) lastHash = hash;
        return {
          ok: true,
          changed,
          generated_at: snapshot.generated_at,
          alerts,
        };
      }),
      map((payload) => ({ data: payload })),
    );
  }
}
