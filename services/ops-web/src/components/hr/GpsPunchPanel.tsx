'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchMyAttendanceSites,
  submitGpsPunch,
  type HrAttendanceSiteDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  token: string;
};

type GeoCoords = {
  lat: number;
  lng: number;
  accuracy: number;
};

type GeoState = GeoCoords | null;

function readGeolocation(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(new Error(err.message || 'Không lấy được vị trí')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export function GpsPunchPanel({ token }: Props) {
  const [sites, setSites] = useState<HrAttendanceSiteDto[]>([]);
  const [geo, setGeo] = useState<GeoState>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchMyAttendanceSites(token);
      setSites(out.sites);
    } catch (err) {
      setSites([]);
      setError(err instanceof Error ? err.message : 'Không tải site chấm công');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshLocation() {
    setError('');
    try {
      const pos = await readGeolocation();
      setGeo(pos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GPS lỗi');
    }
  }

  async function punch(direction: 'in' | 'out') {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const pos = geo ?? (await readGeolocation());
      setGeo(pos);
      const out = await submitGpsPunch(token, {
        direction,
        lat: pos.lat,
        lng: pos.lng,
        accuracy_m: pos.accuracy,
        punched_at: new Date().toISOString(),
      });
      if (out.pending_review) {
        setMsg(
          `Đã gửi ${direction === 'in' ? 'Vào' : 'Ra'} — chờ HR duyệt (ngoài vùng hoặc độ chính xác thấp).`,
        );
      } else {
        setMsg(`Chấm ${direction === 'in' ? 'Vào' : 'Ra'} thành công${out.matched_site ? ` @ ${out.matched_site.name}` : ''}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chấm công thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <section className="page-card stack-gap">
      <div>
        <h2 className="section-title" style={{ margin: 0 }}>
          Chấm công GPS
        </h2>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          Cần cap <code>crm_hr_attendance.gps</code> và hồ sơ NV đã liên kết.
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Chưa được gán site geofence. Liên hệ HR.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {sites.map((s) => (
            <li key={s.id}>
              {s.name} · bán kính {s.radius_m}m
            </li>
          ))}
        </ul>
      )}

      {geo ? (
        <p className="muted mono" style={{ margin: 0, fontSize: '0.8rem' }}>
          {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} · ±{Math.round(geo.accuracy)}m
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {msg ? <p className="success">{msg}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refreshLocation()}>
          Lấy vị trí
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void punch('in')}>
          Vào ca
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void punch('out')}>
          Ra ca
        </button>
      </div>
    </section>
  );
}
