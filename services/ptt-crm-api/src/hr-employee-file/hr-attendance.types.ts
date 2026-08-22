export type HrAttendanceDirection = 'in' | 'out' | 'auto';
export type HrAttendanceSource = 'device' | 'gps' | 'manual';
export type HrAttendancePunchStatus = 'accepted' | 'pending_review' | 'rejected' | 'duplicate';

export type HrAttendanceDeviceRow = {
  id: number;
  name: string;
  serial: string;
  site_name: string;
  timezone: string;
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HrAttendancePunchRow = {
  id: number;
  staff_id: number | null;
  staff_name: string | null;
  punched_at: string;
  direction: HrAttendanceDirection;
  source: HrAttendanceSource;
  device_id: number | null;
  device_name: string | null;
  site_id: number | null;
  site_name: string | null;
  pin: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  outside_geofence: boolean;
  status: HrAttendancePunchStatus;
  note: string;
  created_at: string;
};

export type HrAttendanceDayRow = {
  work_date: string;
  check_in: string;
  check_out: string;
  break_minutes: number;
  note: string;
  punch_count: number;
  sources: string[];
};

export type CreateHrAttendanceDeviceBody = {
  name: string;
  serial?: string;
  site_name?: string;
  timezone?: string;
};

export type DeviceIngestRecord = {
  pin?: string | number;
  time?: string;
  datetime?: string;
  punched_at?: string;
  status?: string | number;
  direction?: string;
  in_out?: string;
};

export type DeviceIngestBody = {
  records?: DeviceIngestRecord[];
  AttLog?: DeviceIngestRecord[];
};

export type HrAttendanceStaffQuery = {
  from?: string;
  to?: string;
};

export type HrAttendanceHubSummary = {
  unmapped_pins: number;
  devices_offline: number;
  missing_checkin_today: number;
  gps_pending_review: number;
};

export type HrAttendanceSiteRow = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  staff_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateHrAttendanceSiteBody = {
  name: string;
  lat: number;
  lng: number;
  radius_m?: number;
};

export type GpsPunchBody = {
  direction: 'in' | 'out';
  lat: number;
  lng: number;
  accuracy_m?: number;
  punched_at?: string;
};

export type ReviewHrAttendancePunchBody = {
  action: 'accept' | 'reject';
  note?: string;
};

export type AssignHrAttendanceSiteStaffBody = {
  staff_ids: number[];
};

export type RollupPunchInput = {
  direction: HrAttendanceDirection;
  punched_at: string;
  status: HrAttendancePunchStatus;
  source: HrAttendanceSource;
};
