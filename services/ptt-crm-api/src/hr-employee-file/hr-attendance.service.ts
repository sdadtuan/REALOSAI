import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrAttendanceRepository } from './hr-attendance.repository';
import {
  matchGeofenceSite,
  resolveGpsPunchedAt,
  shouldGpsPendingReview,
} from './hr-attendance-geofence.util';
import type {
  AssignHrAttendanceSiteStaffBody,
  CreateHrAttendanceDeviceBody,
  CreateHrAttendanceSiteBody,
  DeviceIngestBody,
  DeviceIngestRecord,
  GpsPunchBody,
  HrAttendanceStaffQuery,
  ReviewHrAttendancePunchBody,
} from './hr-attendance.types';
import {
  generateDeviceKey,
  hashDeviceKey,
  normalizePin,
  parseAttendanceCsv,
  parseDeviceDirection,
  parseDevicePunchedAt,
  workDateInTz,
} from './hr-attendance.util';

@Injectable()
export class HrAttendanceService {
  constructor(
    private readonly attendanceRepo: HrAttendanceRepository,
    private readonly staffRepo: HrEmployeeFileRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) throw new ForbiddenException({ error: 'staff_required' });
    return payload;
  }

  private async ensureReady(): Promise<void> {
    if (!(await this.attendanceRepo.attendanceTablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_attendance_not_ready' });
    }
  }

  private async caps(user: StaffJwtPayload) {
    const me = await this.staffAuth.me(user);
    const canView =
      this.staffAuth.hasCap(me.caps, 'crm_payroll_attendance', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'device') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view');
    const canDevice =
      this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'device') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit');
    const canGps = this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'gps');
    const canReview = this.staffAuth.hasCap(me.caps, 'crm_hr_attendance', 'review');
    return { me, canView, canDevice, canGps, canReview };
  }

  private async resolveLinkedStaffId(payload: StaffJwtPayload): Promise<number> {
    const staffId = await this.staffAuth.resolveCrmStaffUserId(payload);
    if (!staffId) throw new ForbiddenException({ error: 'staff_profile_not_linked' });
    return staffId;
  }

  private async ensureSitesReady(): Promise<void> {
    if (!(await this.attendanceRepo.sitesTablesReady())) {
      throw new ServiceUnavailableException({ error: 'hr_attendance_sites_not_ready' });
    }
  }

  async resolveDeviceFromKey(deviceKey: string | undefined) {
    const key = String(deviceKey ?? '').trim();
    if (!key) throw new UnauthorizedException({ error: 'device_key_required' });
    await this.ensureReady();
    const device = await this.attendanceRepo.findDeviceByKeyHash(hashDeviceKey(key));
    if (!device) throw new UnauthorizedException({ error: 'invalid_device_key' });
    return device;
  }

  private extractRecords(body: DeviceIngestBody): DeviceIngestRecord[] {
    if (Array.isArray(body.records) && body.records.length) return body.records;
    if (Array.isArray(body.AttLog) && body.AttLog.length) return body.AttLog;
    return [];
  }

  private async ingestRecords(
    deviceId: number,
    records: DeviceIngestRecord[],
  ): Promise<{
    accepted: number;
    duplicate: number;
    pending_review: number;
    punches: Array<{ id: number; pin: string; status: string }>;
  }> {
    let accepted = 0;
    let duplicate = 0;
    let pendingReview = 0;
    const rollupByStaff = new Map<number, Date[]>();
    const punchSummaries: Array<{ id: number; pin: string; status: string }> = [];

    for (const rec of records) {
      const pin = normalizePin(rec.pin);
      const punchedAt = parseDevicePunchedAt(rec);
      if (!pin || !punchedAt) continue;

      const staffId = await this.attendanceRepo.resolveStaffIdByPin(pin);
      const status = staffId ? 'accepted' : 'pending_review';
      const direction = parseDeviceDirection(rec);

      const { punch, inserted } = await this.attendanceRepo.insertPunch({
        staffId,
        punchedAt,
        direction,
        deviceId,
        pin,
        rawPayload: rec as Record<string, unknown>,
        status,
        note: staffId ? '' : 'unmapped_pin',
      });

      punchSummaries.push({ id: punch.id, pin: punch.pin, status: punch.status });
      if (!inserted || punch.status === 'duplicate') {
        duplicate += 1;
        continue;
      }
      if (status === 'pending_review') {
        pendingReview += 1;
        continue;
      }
      accepted += 1;
      if (staffId) {
        const list = rollupByStaff.get(staffId) ?? [];
        list.push(punchedAt);
        rollupByStaff.set(staffId, list);
      }
    }

    for (const [staffId, dates] of rollupByStaff) {
      await this.attendanceRepo.rollupStaffDates(staffId, dates);
    }

    return {
      accepted,
      duplicate,
      pending_review: pendingReview,
      punches: punchSummaries,
    };
  }

  async deviceIngest(deviceKey: string | undefined, body: DeviceIngestBody) {
    const device = await this.resolveDeviceFromKey(deviceKey);
    const records = this.extractRecords(body);
    await this.attendanceRepo.touchDeviceLastSeen(device.id);
    const result = await this.ingestRecords(device.id, records);
    return { ok: true, device_id: device.id, ...result };
  }

  async importCsv(payload: StaffJwtPayload | undefined, csvText: string, deviceId?: number) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    const { canDevice } = await this.caps(user);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });

    let targetDeviceId = deviceId;
    if (!targetDeviceId) {
      const devices = await this.attendanceRepo.listDevices();
      if (!devices.length) {
        throw new ForbiddenException({ error: 'no_attendance_device' });
      }
      targetDeviceId = devices[0].id;
    }

    const rows = parseAttendanceCsv(csvText);
    const records: DeviceIngestRecord[] = rows.map((r) => ({
      pin: r.pin,
      time: r.punched_at.toISOString(),
      direction: r.direction,
    }));

    await this.attendanceRepo.touchDeviceLastSeen(targetDeviceId);
    const result = await this.ingestRecords(targetDeviceId, records);
    return { ok: true, device_id: targetDeviceId, imported: rows.length, ...result };
  }

  async listDevices(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const devices = await this.attendanceRepo.listDevices();
    return { ok: true, devices };
  }

  async createDevice(payload: StaffJwtPayload | undefined, body: CreateHrAttendanceDeviceBody) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    if (!String(body.name ?? '').trim()) {
      throw new ForbiddenException({ error: 'device_name_required' });
    }
    const deviceKey = generateDeviceKey();
    const device = await this.attendanceRepo.createDevice(body, deviceKey);
    return { ok: true, device, device_key: deviceKey };
  }

  async staffAttendance(
    payload: StaffJwtPayload | undefined,
    staffId: number,
    query: HrAttendanceStaffQuery,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canView } = await this.caps(payload!);
    if (!canView) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_payroll_attendance' });
    await this.staffRepo.assertStaffExists(staffId);
    this.attendanceRepo.validateDateRange(query.from, query.to);

    const [punches, days] = await Promise.all([
      this.attendanceRepo.listStaffPunches(staffId, query.from, query.to),
      this.attendanceRepo.listStaffDays(staffId, query.from, query.to),
    ]);

    return { ok: true, punches, days, today: workDateInTz(new Date()) };
  }

  async listUnmapped(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const punches = await this.attendanceRepo.listUnmappedPunches();
    return { ok: true, punches };
  }

  async hubSummary(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canView } = await this.caps(payload!);
    if (!canView) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_payroll_attendance' });
    const [unmapped_pins, devices_offline, missing_checkin_today, gps_pending_review] =
      await Promise.all([
      this.attendanceRepo.countUnmappedPins(),
      this.attendanceRepo.countOfflineDevices(),
      this.attendanceRepo.countMissingCheckinToday(),
      this.attendanceRepo.countGpsPendingReview(),
    ]);
    return { ok: true, unmapped_pins, devices_offline, missing_checkin_today, gps_pending_review };
  }

  async listSites(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.ensureSitesReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const sites = await this.attendanceRepo.listSites();
    return { ok: true, sites };
  }

  async createSite(payload: StaffJwtPayload | undefined, body: CreateHrAttendanceSiteBody) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.ensureSitesReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    if (!String(body.name ?? '').trim()) {
      throw new BadRequestException({ error: 'site_name_required' });
    }
    if (!Number.isFinite(Number(body.lat)) || !Number.isFinite(Number(body.lng))) {
      throw new BadRequestException({ error: 'invalid_coordinates' });
    }
    const site = await this.attendanceRepo.createSite(body);
    return { ok: true, site };
  }

  async assignSiteStaff(
    payload: StaffJwtPayload | undefined,
    siteId: number,
    body: AssignHrAttendanceSiteStaffBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    await this.ensureSitesReady();
    const { canDevice } = await this.caps(payload!);
    if (!canDevice) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const assigned = await this.attendanceRepo.assignSiteStaff(siteId, body);
    return { ok: true, site_id: siteId, assigned };
  }

  async mySites(payload: StaffJwtPayload | undefined) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.ensureSitesReady();
    const staffId = await this.resolveLinkedStaffId(user);
    const sites = await this.attendanceRepo.listStaffSites(staffId);
    return { ok: true, staff_id: staffId, sites };
  }

  async gpsPunch(payload: StaffJwtPayload | undefined, body: GpsPunchBody) {
    const user = this.requireUser(payload);
    await this.ensureReady();
    await this.ensureSitesReady();
    const { canGps } = await this.caps(user);
    if (!canGps) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });

    const staffId = await this.resolveLinkedStaffId(user);
    await this.staffRepo.assertStaffExists(staffId);

    const direction = body.direction === 'out' ? 'out' : 'in';
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException({ error: 'invalid_coordinates' });
    }

    const sites = await this.attendanceRepo.listStaffSites(staffId);
    const accuracyM = body.accuracy_m != null ? Number(body.accuracy_m) : null;
    const match = matchGeofenceSite(lat, lng, accuracyM, sites);
    const pending =
      shouldGpsPendingReview(match.outsideGeofence, accuracyM, match.site?.radius_m ?? 150) ||
      !sites.length;

    const punchedAt = resolveGpsPunchedAt(body.punched_at);
    const punch = await this.attendanceRepo.insertGpsPunch({
      staffId,
      punchedAt,
      direction,
      lat,
      lng,
      accuracyM: Number.isFinite(Number(accuracyM)) ? Number(accuracyM) : null,
      siteId: match.site?.id ?? null,
      outsideGeofence: match.outsideGeofence || !sites.length,
      status: pending ? 'pending_review' : 'accepted',
      note: pending
        ? match.outsideGeofence || !sites.length
          ? 'outside_geofence'
          : 'low_accuracy'
        : '',
      rawPayload: body as Record<string, unknown>,
    });

    if (!pending) {
      await this.attendanceRepo.rollupStaffDates(staffId, [punchedAt]);
    }

    return {
      ok: true,
      punch,
      pending_review: pending,
      matched_site: match.site,
      distance_m: match.distanceM,
    };
  }

  async listGpsPending(payload: StaffJwtPayload | undefined) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canReview } = await this.caps(payload!);
    if (!canReview) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const punches = await this.attendanceRepo.listGpsPendingReview();
    return { ok: true, punches };
  }

  async reviewPunch(
    payload: StaffJwtPayload | undefined,
    punchId: number,
    body: ReviewHrAttendancePunchBody,
  ) {
    this.requireUser(payload);
    await this.ensureReady();
    const { canReview } = await this.caps(payload!);
    if (!canReview) throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    const action = body.action === 'reject' ? 'reject' : 'accept';
    const punch = await this.attendanceRepo.reviewPunch(punchId, action, String(body.note ?? ''));
    return { ok: true, punch };
  }
}
