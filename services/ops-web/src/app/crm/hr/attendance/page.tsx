'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import {
  assignHrAttendanceSiteStaff,
  createHrAttendanceDevice,
  createHrAttendanceSite,
  fetchHrAttendanceDevices,
  fetchHrAttendanceSites,
  fetchHrUnmappedAttendancePins,
  importHrAttendanceCsv,
  type HrAttendanceDeviceDto,
  type HrAttendancePunchDto,
  type HrAttendanceSiteDto,
} from '@/lib/hr-employee-file-api';
import { canViewHrHub } from '@/lib/crm/hr-hub';
import { hasCap } from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function HrAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [devices, setDevices] = useState<HrAttendanceDeviceDto[]>([]);
  const [sites, setSites] = useState<HrAttendanceSiteDto[]>([]);
  const [unmapped, setUnmapped] = useState<HrAttendancePunchDto[]>([]);
  const [csvText, setCsvText] = useState('');
  const [deviceId, setDeviceId] = useState<number | ''>('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceKey, setNewDeviceKey] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteLat, setSiteLat] = useState('21.0285');
  const [siteLng, setSiteLng] = useState('105.8542');
  const [siteRadius, setSiteRadius] = useState('150');
  const [assignSiteId, setAssignSiteId] = useState<number | ''>('');
  const [assignStaffIds, setAssignStaffIds] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const canDevice = Boolean(
    user &&
      (hasCap(user, 'crm_hr_attendance', 'device') || hasCap(user, 'crm_staff_roster', 'edit')),
  );

  const ensureAuth = useCallback(async (): Promise<StoredStaffUser | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    setToken(access);
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewHrHub(me)) {
        setError('Không có quyền truy cập module Nhân sự');
        return null;
      }
      return me;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      setToken(access);
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return me;
    }
  }, [router]);

  const load = useCallback(async () => {
    if (!token || !canDevice) return;
    try {
      const [devs, siteRows, pins] = await Promise.all([
        fetchHrAttendanceDevices(token),
        fetchHrAttendanceSites(token),
        fetchHrUnmappedAttendancePins(token),
      ]);
      setDevices(devs);
      setSites(siteRows);
      setUnmapped(pins);
      if (!deviceId && devs[0]) setDeviceId(devs[0].id);
      if (!assignSiteId && siteRows[0]) setAssignSiteId(siteRows[0].id);
    } catch {
      setDevices([]);
      setUnmapped([]);
    }
  }, [canDevice, deviceId, token]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleImport() {
    if (!token || !csvText.trim()) return;
    setMsg('');
    setError('');
    try {
      const out = await importHrAttendanceCsv(token, csvText, deviceId ? Number(deviceId) : undefined);
      setMsg(
        `Import ${out.imported} dòng · accepted ${out.accepted} · duplicate ${out.duplicate} · pending ${out.pending_review}`,
      );
      setCsvText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import thất bại');
    }
  }

  async function handleCreateDevice() {
    if (!token || !newDeviceName.trim()) return;
    setMsg('');
    setError('');
    try {
      const out = await createHrAttendanceDevice(token, { name: newDeviceName.trim() });
      setNewDeviceKey(out.device_key);
      setNewDeviceName('');
      setMsg(`Đã tạo thiết bị «${out.device.name}». Lưu device key ngay — chỉ hiện 1 lần.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo thiết bị thất bại');
    }
  }

  async function handleCreateSite() {
    if (!token || !siteName.trim()) return;
    setMsg('');
    setError('');
    try {
      const site = await createHrAttendanceSite(token, {
        name: siteName.trim(),
        lat: Number(siteLat),
        lng: Number(siteLng),
        radius_m: Number(siteRadius) || 150,
      });
      setSiteName('');
      setMsg(`Đã tạo site «${site.name}».`);
      await load();
      setAssignSiteId(site.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo site thất bại');
    }
  }

  async function handleAssignStaff() {
    if (!token || !assignSiteId) return;
    setMsg('');
    setError('');
    try {
      const staffIds = assignStaffIds
        .split(/[,\s]+/)
        .map((x) => Number(x.trim()))
        .filter(Boolean);
      await assignHrAttendanceSiteStaff(token, Number(assignSiteId), staffIds);
      setAssignStaffIds('');
      setMsg(`Đã gán ${staffIds.length} NV vào site.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gán NV thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <CrmHrPageShell user={user} onLogout={logout} title="Chấm công" subtitle="HR-P7 máy · HR-P8 GPS geofence">
      <p className="muted" style={{ marginTop: 0 }}>
        <Link href="/crm/hr" className="link">
          ← HR Hub
        </Link>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="success">{msg}</p> : null}

      {!canDevice ? (
        <section className="page-card">
          <p className="muted" style={{ margin: 0 }}>
            Cần cap <code>crm_hr_attendance.device</code> hoặc <code>crm_staff_roster.edit</code> để quản lý máy.
          </p>
        </section>
      ) : (
        <>
          <section className="page-card stack-gap">
            <h2 className="section-title" style={{ margin: 0 }}>
              Site GPS ({sites.length})
            </h2>
            {sites.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Tạo site geofence để NV chấm GPS qua Phiếu lương của tôi.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                {sites.map((s) => (
                  <li key={s.id}>
                    {s.name} · {s.lat.toFixed(4)}, {s.lng.toFixed(4)} · {s.radius_m}m · {s.staff_count} NV
                  </li>
                ))}
              </ul>
            )}
            <div className="form-grid form-grid--2">
              <label className="form-field">
                <span className="form-label">Tên site</span>
                <input className="form-input" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Bán kính (m)</span>
                <input className="form-input mono" value={siteRadius} onChange={(e) => setSiteRadius(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Lat</span>
                <input className="form-input mono" value={siteLat} onChange={(e) => setSiteLat(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Lng</span>
                <input className="form-input mono" value={siteLng} onChange={(e) => setSiteLng(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void handleCreateSite()}>
              Tạo site
            </button>
            {sites.length > 0 ? (
              <div className="stack-gap" style={{ marginTop: '0.75rem' }}>
                <label className="form-field">
                  <span className="form-label">Gán NV (staff_id, cách nhau dấu phẩy)</span>
                  <select
                    className="form-input"
                    value={assignSiteId}
                    onChange={(e) => setAssignSiteId(e.target.value ? Number(e.target.value) : '')}
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="form-input mono"
                  value={assignStaffIds}
                  onChange={(e) => setAssignStaffIds(e.target.value)}
                  placeholder="1, 2, 3"
                />
                <button type="button" className="btn btn-secondary" onClick={() => void handleAssignStaff()}>
                  Gán NV vào site
                </button>
              </div>
            ) : null}
          </section>

          <section className="page-card stack-gap">
            <h2 className="section-title" style={{ margin: 0 }}>
              Thiết bị ({devices.length})
            </h2>
            {devices.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Chưa có máy. Tạo thiết bị và cấu hình máy push tới{' '}
                <code>POST /api/v1/hr/attendance/device/ingest</code> với header <code>X-Device-Key</code>.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                {devices.map((d) => (
                  <li key={d.id}>
                    {d.name}
                    {d.serial ? ` · ${d.serial}` : ''}
                    {d.site_name ? ` · ${d.site_name}` : ''}
                    {d.last_seen_at ? (
                      <span className="muted"> · seen {new Date(d.last_seen_at).toLocaleString('vi-VN')}</span>
                    ) : (
                      <span className="muted"> · chưa thấy</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="form-grid form-grid--2" style={{ maxWidth: 480 }}>
              <label className="form-field">
                <span className="form-label">Tên máy mới</span>
                <input
                  className="form-input"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="Máy VP HN"
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={() => void handleCreateDevice()}>
                  Tạo thiết bị
                </button>
              </div>
            </div>
            {newDeviceKey ? (
              <p className="mono" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                Device key: {newDeviceKey}
              </p>
            ) : null}
          </section>

          <section className="page-card stack-gap">
            <h2 className="section-title" style={{ margin: 0 }}>
              Import CSV
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Cột: pin, datetime, direction (in/out). Hỗ trợ mọi hãng xuất CSV.
            </p>
            {devices.length > 0 ? (
              <label className="form-field" style={{ maxWidth: 320 }}>
                <span className="form-label">Thiết bị</span>
                <select
                  className="form-input"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value ? Number(e.target.value) : '')}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <textarea
              className="form-input"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'pin,datetime,direction\n101,2026-08-19 08:30:00,in\n101,2026-08-19 17:30:00,out'}
            />
            <button type="button" className="btn btn-primary" onClick={() => void handleImport()}>
              Import CSV
            </button>
          </section>

          {unmapped.length > 0 ? (
            <section className="page-card stack-gap">
              <h2 className="section-title" style={{ margin: 0 }}>
                PIN chưa map ({unmapped.length})
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Gán <code>timeclock_pin</code> trên tab Hồ sơ NV trùng mã máy.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
                {unmapped.slice(0, 20).map((p) => (
                  <li key={p.id}>
                    PIN <span className="mono">{p.pin}</span> · {new Date(p.punched_at).toLocaleString('vi-VN')}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </CrmHrPageShell>
  );
}
