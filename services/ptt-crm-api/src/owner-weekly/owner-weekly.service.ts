import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OwnerWeeklyPgRepository } from './owner-weekly-pg.repository';
import { OwnerWeeklySqliteRepository } from './owner-weekly-sqlite.repository';

@Injectable()
export class OwnerWeeklyService {
  constructor(
    private readonly sqlite: OwnerWeeklySqliteRepository,
    private readonly pg: OwnerWeeklyPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmOwnerWeeklyPg;
  }

  dashboard(query: Record<string, string | undefined>) {
    const opts = {
      weekEnd: this.parseWeekEnd(query.week_end),
      year: this.optPosInt(query.year),
      isoWeek: this.optPosInt(query.week),
      trendWeeks: this.optPosInt(query.trend_weeks) ?? 8,
    };
    return this.usePg ? this.pg.dashboard(opts) : this.sqlite.dashboard(opts);
  }

  configGet() {
    return this.usePg ? this.pg.configGet() : this.sqlite.configGet();
  }

  configPatch(body: Record<string, unknown>) {
    const updates = (body.targets ?? body.thresholds ?? body) as Record<string, unknown>;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new BadRequestException({ error: 'targets phải là object.' });
    }
    return this.usePg ? this.pg.configPatch(updates) : this.sqlite.configPatch(updates);
  }

  listCashSnapshots(limitRaw?: string) {
    const limit = this.optPosInt(limitRaw) ?? 24;
    return this.usePg ? this.pg.listCashSnapshots(limit) : this.sqlite.listCashSnapshots(limit);
  }

  upsertCashSnapshot(body: Record<string, unknown>) {
    const snapRaw = String(body.snapshot_on ?? '').trim().slice(0, 10);
    if (!snapRaw) throw new BadRequestException({ error: 'snapshot_on bắt buộc (YYYY-MM-DD).' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapRaw)) {
      throw new BadRequestException({ error: 'snapshot_on không hợp lệ.' });
    }
    let balance: number;
    try {
      balance = Math.trunc(Number(body.balance_vnd));
      if (!Number.isFinite(balance)) throw new Error('invalid');
    } catch {
      throw new BadRequestException({ error: 'balance_vnd phải là số nguyên.' });
    }
    const source = String(body.source ?? 'manual').trim().toLowerCase();
    const notes = String(body.notes ?? '').trim();
    try {
      return this.usePg
        ? this.pg.upsertCashSnapshot(snapRaw, balance, source, notes)
        : this.sqlite.upsertCashSnapshot(snapRaw, balance, source, notes);
    } catch (err) {
      if (err instanceof Error && err.message.includes('snapshot_on')) {
        throw new BadRequestException({ error: err.message });
      }
      throw err;
    }
  }

  deleteCashSnapshot(query: Record<string, string | undefined>, body?: Record<string, unknown>) {
    let snapRaw = String(query.snapshot_on ?? '').trim().slice(0, 10);
    if (!snapRaw && body) snapRaw = String(body.snapshot_on ?? '').trim().slice(0, 10);
    if (!snapRaw) throw new BadRequestException({ error: 'snapshot_on bắt buộc.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapRaw)) {
      throw new BadRequestException({ error: 'snapshot_on không hợp lệ.' });
    }
    try {
      return this.usePg
        ? this.pg.deleteCashSnapshot(snapRaw)
        : this.sqlite.deleteCashSnapshot(snapRaw);
    } catch (err) {
      if (err instanceof Error && err.message.includes('snapshot_on')) {
        throw new BadRequestException({ error: err.message });
      }
      throw err;
    }
  }

  export(query: Record<string, string | undefined>) {
    const opts = {
      weekEnd: this.parseWeekEnd(query.week_end),
      year: this.optPosInt(query.year),
      isoWeek: this.optPosInt(query.week),
    };
    return this.usePg ? this.pg.export(opts) : this.sqlite.export(opts);
  }

  alertCron(body: Record<string, unknown>, query: Record<string, string | undefined>) {
    const year = this.optPosInt(String(body.year ?? query.year ?? ''));
    const week = this.optPosInt(
      String(body.week ?? body.iso_week ?? query.iso_week ?? query.week ?? ''),
    );
    return this.usePg ? this.pg.alertCron(year, week) : this.sqlite.alertCron(year, week);
  }

  inboxSync(body: Record<string, unknown>, query: Record<string, string | undefined>) {
    const year = this.optPosInt(String(body.year ?? query.year ?? ''));
    const week = this.optPosInt(String(body.week ?? query.week ?? ''));
    return this.usePg ? this.pg.inboxSync(year, week) : this.sqlite.inboxSync(year, week);
  }

  inboxSummary() {
    return this.usePg ? this.pg.inboxSummary() : this.sqlite.inboxSummary();
  }

  private parseWeekEnd(raw?: string): string | null {
    const text = String(raw ?? '').trim().slice(0, 10);
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    return text;
  }

  private optPosInt(raw?: string): number | null {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.trunc(n);
  }
}
