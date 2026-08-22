import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  AssignHrAttendanceSiteStaffBody,
  CreateHrAttendanceDeviceBody,
  CreateHrAttendanceSiteBody,
  HrAttendanceDayRow,
  HrAttendanceDeviceRow,
  HrAttendancePunchRow,
  HrAttendancePunchStatus,
  HrAttendanceSiteRow,
  HrAttendanceSource,
  RollupPunchInput,
} from './hr-attendance.types';
import {
  collectRollupSources,
  hashDeviceKey,
  rollupDayTimes,
  workDateInTz,
} from './hr-attendance.util';

const PUNCH_SELECT = `
  p.id, p.staff_id::int, s.name AS staff_name, p.punched_at::text, p.direction, p.source,
  p.device_id::int, d.name AS device_name, p.site_id::int, st.name AS site_name,
  p.pin, p.lat, p.lng, p.accuracy_m, p.outside_geofence, p.status, p.note, p.created_at::text
`;

@Injectable()
export class HrAttendanceRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.readyCache = null;
  }

  async attendanceTablesReady(): Promise<boolean> {
    if (this.readyCache != null) return this.readyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_attendance_punches LIMIT 1`);
      this.readyCache = true;
    } catch {
      this.readyCache = false;
    }
    return this.readyCache;
  }

  private mapDevice(row: Record<string, unknown>): HrAttendanceDeviceRow {
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      serial: String(row.serial ?? ''),
      site_name: String(row.site_name ?? ''),
      timezone: String(row.timezone ?? 'Asia/Ho_Chi_Minh'),
      last_seen_at: row.last_seen_at ? String(row.last_seen_at) : null,
      is_active: Boolean(row.is_active),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async sitesTablesReady(): Promise<boolean> {
    try {
      await this.db.query(`SELECT 1 FROM hr_attendance_sites LIMIT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private mapPunch(row: Record<string, unknown>): HrAttendancePunchRow {
    return {
      id: Number(row.id),
      staff_id: row.staff_id != null ? Number(row.staff_id) : null,
      staff_name: row.staff_name ? String(row.staff_name) : null,
      punched_at: String(row.punched_at ?? ''),
      direction: String(row.direction ?? 'auto') as HrAttendancePunchRow['direction'],
      source: String(row.source ?? 'device') as HrAttendanceSource,
      device_id: row.device_id != null ? Number(row.device_id) : null,
      device_name: row.device_name ? String(row.device_name) : null,
      site_id: row.site_id != null ? Number(row.site_id) : null,
      site_name: row.site_name ? String(row.site_name) : null,
      pin: String(row.pin ?? ''),
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      accuracy_m: row.accuracy_m != null ? Number(row.accuracy_m) : null,
      outside_geofence: Boolean(row.outside_geofence),
      status: String(row.status ?? 'accepted') as HrAttendancePunchStatus,
      note: String(row.note ?? ''),
      created_at: String(row.created_at ?? ''),
    };
  }

  private mapSite(row: Record<string, unknown>): HrAttendanceSiteRow {
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      lat: Number(row.lat ?? 0),
      lng: Number(row.lng ?? 0),
      radius_m: Number(row.radius_m ?? 150),
      is_active: Boolean(row.is_active),
      staff_count: Number(row.staff_count ?? 0),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async findDeviceByKeyHash(keyHash: string): Promise<HrAttendanceDeviceRow | null> {
    const { rows } = await this.db.query(
      `SELECT id, name, serial, site_name, timezone, last_seen_at::text, is_active,
              created_at::text, updated_at::text
       FROM hr_attendance_devices
       WHERE device_key_hash = $1 AND is_active = TRUE
       LIMIT 1`,
      [keyHash],
    );
    return rows[0] ? this.mapDevice(rows[0]) : null;
  }

  async listDevices(): Promise<HrAttendanceDeviceRow[]> {
    const { rows } = await this.db.query(
      `SELECT id, name, serial, site_name, timezone, last_seen_at::text, is_active,
              created_at::text, updated_at::text
       FROM hr_attendance_devices
       ORDER BY name, id`,
    );
    return rows.map((r) => this.mapDevice(r));
  }

  async createDevice(body: CreateHrAttendanceDeviceBody, deviceKey: string): Promise<HrAttendanceDeviceRow> {
    const { rows } = await this.db.query(
      `INSERT INTO hr_attendance_devices (name, serial, device_key_hash, site_name, timezone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, serial, site_name, timezone, last_seen_at::text, is_active,
                 created_at::text, updated_at::text`,
      [
        String(body.name ?? '').trim(),
        String(body.serial ?? '').trim(),
        hashDeviceKey(deviceKey),
        String(body.site_name ?? '').trim(),
        String(body.timezone ?? 'Asia/Ho_Chi_Minh').trim() || 'Asia/Ho_Chi_Minh',
      ],
    );
    return this.mapDevice(rows[0]);
  }

  async touchDeviceLastSeen(deviceId: number): Promise<void> {
    await this.db.query(
      `UPDATE hr_attendance_devices SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [deviceId],
    );
  }

  async resolveStaffIdByPin(pin: string): Promise<number | null> {
    const normalized = String(pin ?? '').trim();
    if (!normalized) return null;
    const { rows } = await this.db.query(
      `SELECT staff_id::int FROM hr_staff_identity WHERE timeclock_pin = $1 LIMIT 1`,
      [normalized],
    );
    return rows[0]?.staff_id != null ? Number(rows[0].staff_id) : null;
  }

  async insertPunch(input: {
    staffId: number | null;
    punchedAt: Date;
    direction: string;
    deviceId: number;
    pin: string;
    rawPayload: Record<string, unknown>;
    status: HrAttendancePunchStatus;
    note?: string;
  }): Promise<{ punch: HrAttendancePunchRow; inserted: boolean }> {
    try {
      const { rows } = await this.db.query(
        `INSERT INTO hr_attendance_punches
           (staff_id, punched_at, direction, source, device_id, pin, raw_payload, status, note)
         VALUES ($1, $2, $3, 'device', $4, $5, $6::jsonb, $7, $8)
         RETURNING id`,
        [
          input.staffId,
          input.punchedAt.toISOString(),
          input.direction,
          input.deviceId,
          input.pin,
          JSON.stringify(input.rawPayload ?? {}),
          input.status,
          input.note ?? '',
        ],
      );
      const punch = await this.getPunchById(Number(rows[0].id));
      return { punch, inserted: true };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        const existing = await this.findDuplicatePunch(input.deviceId, input.pin, input.punchedAt);
        if (existing) return { punch: existing, inserted: false };
      }
      throw err;
    }
  }

  private async findDuplicatePunch(
    deviceId: number,
    pin: string,
    punchedAt: Date,
  ): Promise<HrAttendancePunchRow | null> {
    const { rows } = await this.db.query(
      `SELECT ${PUNCH_SELECT}
       FROM hr_attendance_punches p
       LEFT JOIN crm_staff s ON s.id = p.staff_id
       LEFT JOIN hr_attendance_devices d ON d.id = p.device_id
       LEFT JOIN hr_attendance_sites st ON st.id = p.site_id
       WHERE p.device_id = $1 AND p.pin = $2 AND p.punched_at = $3
       LIMIT 1`,
      [deviceId, pin, punchedAt.toISOString()],
    );
    return rows[0] ? this.mapPunch(rows[0]) : null;
  }

  async getPunchById(id: number): Promise<HrAttendancePunchRow> {
    const { rows } = await this.db.query(
      `SELECT ${PUNCH_SELECT}
       FROM hr_attendance_punches p
       LEFT JOIN crm_staff s ON s.id = p.staff_id
       LEFT JOIN hr_attendance_devices d ON d.id = p.device_id
       LEFT JOIN hr_attendance_sites st ON st.id = p.site_id
       WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException({ error: 'punch_not_found' });
    return this.mapPunch(rows[0]);
  }

  async listStaffPunches(
    staffId: number,
    from?: string,
    to?: string,
  ): Promise<HrAttendancePunchRow[]> {
    const clauses = ['p.staff_id = $1'];
    const params: unknown[] = [staffId];
    if (from) {
      params.push(from);
      clauses.push(`p.punched_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      clauses.push(`p.punched_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    const { rows } = await this.db.query(
      `SELECT ${PUNCH_SELECT}
       FROM hr_attendance_punches p
       LEFT JOIN crm_staff s ON s.id = p.staff_id
       LEFT JOIN hr_attendance_devices d ON d.id = p.device_id
       LEFT JOIN hr_attendance_sites st ON st.id = p.site_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY p.punched_at DESC
       LIMIT 500`,
      params,
    );
    return rows.map((r) => this.mapPunch(r));
  }

  async listUnmappedPunches(limit = 100): Promise<HrAttendancePunchRow[]> {
    const { rows } = await this.db.query(
      `SELECT ${PUNCH_SELECT}
       FROM hr_attendance_punches p
       LEFT JOIN crm_staff s ON s.id = p.staff_id
       LEFT JOIN hr_attendance_devices d ON d.id = p.device_id
       LEFT JOIN hr_attendance_sites st ON st.id = p.site_id
       WHERE p.staff_id IS NULL AND p.status = 'pending_review' AND p.source = 'device'
       ORDER BY p.punched_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapPunch(r));
  }

  async listStaffDays(staffId: number, from?: string, to?: string): Promise<HrAttendanceDayRow[]> {
    const clauses = ['a.staff_id = $1'];
    const params: unknown[] = [staffId];
    if (from) {
      params.push(from);
      clauses.push(`a.work_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      clauses.push(`a.work_date <= $${params.length}::date`);
    }
    const { rows } = await this.db.query(
      `SELECT a.work_date::text, a.check_in, a.check_out, a.break_minutes::int, a.note,
              COALESCE(p.cnt, 0)::int AS punch_count,
              COALESCE(p.sources, '') AS sources
       FROM crm_attendance a
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS cnt,
                string_agg(DISTINCT hp.source, ',' ORDER BY hp.source) AS sources
         FROM hr_attendance_punches hp
         WHERE hp.staff_id = a.staff_id
           AND hp.punched_at >= a.work_date::timestamptz
           AND hp.punched_at < (a.work_date + INTERVAL '1 day')::timestamptz
           AND hp.status = 'accepted'
       ) p ON TRUE
       WHERE ${clauses.join(' AND ')}
       ORDER BY a.work_date DESC
       LIMIT 90`,
      params,
    );
    return rows.map((r) => ({
      work_date: String(r.work_date),
      check_in: String(r.check_in ?? ''),
      check_out: String(r.check_out ?? ''),
      break_minutes: Number(r.break_minutes ?? 0),
      note: String(r.note ?? ''),
      punch_count: Number(r.punch_count ?? 0),
      sources: String(r.sources ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));
  }

  async listPunchesForRollup(staffId: number, workDate: string): Promise<RollupPunchInput[]> {
    const { rows } = await this.db.query(
      `SELECT direction, punched_at::text, status, source
       FROM hr_attendance_punches
       WHERE staff_id = $1
         AND punched_at >= $2::date
         AND punched_at < ($2::date + INTERVAL '1 day')
       ORDER BY punched_at`,
      [staffId, workDate],
    );
    return rows.map((r) => ({
      direction: String(r.direction) as RollupPunchInput['direction'],
      punched_at: String(r.punched_at),
      status: String(r.status) as RollupPunchInput['status'],
      source: String(r.source) as RollupPunchInput['source'],
    }));
  }

  async upsertAttendanceDay(staffId: number, workDate: string, punches: RollupPunchInput[]): Promise<void> {
    const { checkIn, checkOut } = rollupDayTimes(punches);
    const sources = collectRollupSources(punches);
    const note = sources.length ? `sources:${sources.join(',')}` : '';
    await this.db.query(
      `INSERT INTO crm_attendance (staff_id, work_date, check_in, check_out, note, updated_at)
       VALUES ($1, $2::date, $3, $4, $5, NOW())
       ON CONFLICT (staff_id, work_date)
       DO UPDATE SET check_in = EXCLUDED.check_in,
                     check_out = EXCLUDED.check_out,
                     note = CASE WHEN EXCLUDED.note <> '' THEN EXCLUDED.note ELSE crm_attendance.note END,
                     updated_at = NOW()`,
      [staffId, workDate, checkIn, checkOut, note],
    );
  }

  async rollupStaffDates(staffId: number, punchedAts: Date[]): Promise<void> {
    const dates = new Set(punchedAts.map((d) => workDateInTz(d)));
    for (const workDate of dates) {
      const punches = await this.listPunchesForRollup(staffId, workDate);
      await this.upsertAttendanceDay(staffId, workDate, punches);
    }
  }

  async countUnmappedPins(): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM hr_attendance_punches
       WHERE staff_id IS NULL AND status = 'pending_review' AND source = 'device'`,
    );
    return Number(rows[0]?.n ?? 0);
  }

  async countOfflineDevices(hours = 24): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM hr_attendance_devices
       WHERE is_active = TRUE
         AND (last_seen_at IS NULL OR last_seen_at < NOW() - ($1 || ' hours')::interval)`,
      [String(hours)],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async countMissingCheckinToday(): Promise<number> {
    const today = workDateInTz(new Date());
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n
       FROM crm_staff s
       WHERE s.active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM crm_attendance a
           WHERE a.staff_id = s.id AND a.work_date = $1::date AND trim(a.check_in) <> ''
         )`,
      [today],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async assertStaffExists(staffId: number): Promise<void> {
    const { rows } = await this.db.query(`SELECT id FROM crm_staff WHERE id = $1`, [staffId]);
    if (!rows[0]) throw new NotFoundException({ error: 'staff_not_found' });
  }

  validateDateRange(from?: string, to?: string): void {
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      throw new BadRequestException({ error: 'invalid_from_date' });
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException({ error: 'invalid_to_date' });
    }
  }

  async listSites(): Promise<HrAttendanceSiteRow[]> {
    const { rows } = await this.db.query(
      `SELECT s.id, s.name, s.lat, s.lng, s.radius_m::int, s.is_active,
              COALESCE(ss.cnt, 0)::int AS staff_count,
              s.created_at::text, s.updated_at::text
       FROM hr_attendance_sites s
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS cnt FROM hr_attendance_site_staff x WHERE x.site_id = s.id
       ) ss ON TRUE
       WHERE s.is_active = TRUE
       ORDER BY s.name, s.id`,
    );
    return rows.map((r) => this.mapSite(r));
  }

  async createSite(body: CreateHrAttendanceSiteBody): Promise<HrAttendanceSiteRow> {
    const { rows } = await this.db.query(
      `INSERT INTO hr_attendance_sites (name, lat, lng, radius_m)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, lat, lng, radius_m::int, is_active, 0::int AS staff_count,
                 created_at::text, updated_at::text`,
      [
        String(body.name ?? '').trim(),
        Number(body.lat),
        Number(body.lng),
        Number(body.radius_m ?? 150) || 150,
      ],
    );
    return this.mapSite(rows[0]);
  }

  async listStaffSites(staffId: number): Promise<HrAttendanceSiteRow[]> {
    const { rows } = await this.db.query(
      `SELECT s.id, s.name, s.lat, s.lng, s.radius_m::int, s.is_active,
              1::int AS staff_count, s.created_at::text, s.updated_at::text
       FROM hr_attendance_sites s
       INNER JOIN hr_attendance_site_staff ss ON ss.site_id = s.id
       WHERE ss.staff_id = $1 AND s.is_active = TRUE
       ORDER BY s.name`,
      [staffId],
    );
    return rows.map((r) => this.mapSite(r));
  }

  async assignSiteStaff(siteId: number, body: AssignHrAttendanceSiteStaffBody): Promise<number> {
    const staffIds = [...new Set((body.staff_ids ?? []).map((id) => Number(id)).filter(Boolean))];
    await this.db.query(`DELETE FROM hr_attendance_site_staff WHERE site_id = $1`, [siteId]);
    for (const staffId of staffIds) {
      await this.db.query(
        `INSERT INTO hr_attendance_site_staff (site_id, staff_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [siteId, staffId],
      );
    }
    return staffIds.length;
  }

  async insertGpsPunch(input: {
    staffId: number;
    punchedAt: Date;
    direction: string;
    lat: number;
    lng: number;
    accuracyM: number | null;
    siteId: number | null;
    outsideGeofence: boolean;
    status: HrAttendancePunchStatus;
    note?: string;
    rawPayload?: Record<string, unknown>;
  }): Promise<HrAttendancePunchRow> {
    const { rows } = await this.db.query(
      `INSERT INTO hr_attendance_punches
         (staff_id, punched_at, direction, source, lat, lng, accuracy_m, site_id,
          outside_geofence, raw_payload, status, note)
       VALUES ($1, $2, $3, 'gps', $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       RETURNING id`,
      [
        input.staffId,
        input.punchedAt.toISOString(),
        input.direction,
        input.lat,
        input.lng,
        input.accuracyM,
        input.siteId,
        input.outsideGeofence,
        JSON.stringify(input.rawPayload ?? {}),
        input.status,
        input.note ?? '',
      ],
    );
    return this.getPunchById(Number(rows[0].id));
  }

  async listGpsPendingReview(limit = 100): Promise<HrAttendancePunchRow[]> {
    const { rows } = await this.db.query(
      `SELECT ${PUNCH_SELECT}
       FROM hr_attendance_punches p
       LEFT JOIN crm_staff s ON s.id = p.staff_id
       LEFT JOIN hr_attendance_devices d ON d.id = p.device_id
       LEFT JOIN hr_attendance_sites st ON st.id = p.site_id
       WHERE p.source = 'gps' AND p.status = 'pending_review'
       ORDER BY p.punched_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapPunch(r));
  }

  async reviewPunch(
    punchId: number,
    action: 'accept' | 'reject',
    note: string,
  ): Promise<HrAttendancePunchRow> {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    const { rows } = await this.db.query(
      `UPDATE hr_attendance_punches
       SET status = $2, note = CASE WHEN $3 <> '' THEN $3 ELSE note END
       WHERE id = $1 AND status = 'pending_review'
       RETURNING id`,
      [punchId, status, note],
    );
    if (!rows[0]) throw new NotFoundException({ error: 'punch_not_found_or_not_pending' });
    const punch = await this.getPunchById(punchId);
    if (punch.staff_id && status === 'accepted') {
      await this.rollupStaffDates(punch.staff_id, [new Date(punch.punched_at)]);
    }
    return punch;
  }

  async countGpsPendingReview(): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM hr_attendance_punches
       WHERE source = 'gps' AND status = 'pending_review'`,
    );
    return Number(rows[0]?.n ?? 0);
  }
}
