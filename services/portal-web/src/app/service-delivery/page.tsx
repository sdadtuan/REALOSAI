'use client';

import { useEffect, useState } from 'react';
import { HubPageLayout } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalOpsLinkedLifecycle,
  fetchPortalOpsLifecycleSummary,
  type OpsPortalSummary,
} from '@/lib/api';
import { isOpsPortalSummaryFeEnabled } from '@/lib/ops-portal-flags';

function kpiLabelVi(label: OpsPortalSummary['kpi']['overall_label']): string {
  if (label === 'Dat') return 'Đạt';
  if (label === 'CanChuY') return 'Cần chú ý';
  if (label === 'KhongDat') return 'Không đạt';
  return 'Đang cập nhật';
}

export default function PortalServiceDeliveryPage() {
  return (
    <PortalPageShell
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: 'Triển khai dịch vụ' },
      ]}
    >
      {({ token }) => <ServiceDeliveryContent token={token} />}
    </PortalPageShell>
  );
}

function ServiceDeliveryContent({ token }: { token: string }) {
  const [summary, setSummary] = useState<OpsPortalSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpsPortalSummaryFeEnabled()) {
      setError('Tóm tắt vận hành chưa bật (NEXT_PUBLIC_OPS_PORTAL_SUMMARY).');
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const linked = await fetchPortalOpsLinkedLifecycle(token);
        if (!linked.enabled || linked.lifecycle_id == null) {
          setSummary(null);
          return;
        }
        setSummary(await fetchPortalOpsLifecycleSummary(token, linked.lifecycle_id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải tóm tắt thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <HubPageLayout title="Triển khai dịch vụ" subtitle="Tiến độ tuần và KPI tháng">
        <p className="muted">Đang tải…</p>
      </HubPageLayout>
    );
  }

  if (error) {
    return (
      <HubPageLayout title="Triển khai dịch vụ" subtitle="Tiến độ tuần và KPI tháng">
        <p className="error">{error}</p>
      </HubPageLayout>
    );
  }

  if (!summary?.enabled) {
    return (
      <HubPageLayout title="Triển khai dịch vụ" subtitle="Tiến độ tuần và KPI tháng">
        <p className="muted">Chưa có hợp đồng triển khai liên kết với tài khoản portal này.</p>
      </HubPageLayout>
    );
  }

  return (
    <HubPageLayout
      title="Triển khai dịch vụ"
      subtitle={`${summary.dv_name} · giai đoạn ${summary.stage}`}
    >
      <section className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Tóm tắt</h3>
        <p>{summary.status_message_vi}</p>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <strong>{summary.weekly.progress_pct}%</strong>
            <p className="muted" style={{ margin: 0 }}>
              Checklist tuần {summary.iso_week}
            </p>
          </div>
          <div>
            <strong>{kpiLabelVi(summary.kpi.overall_label)}</strong>
            <p className="muted" style={{ margin: 0 }}>
              KPI tháng {summary.kpi.period_key}
            </p>
          </div>
          <div>
            <strong>{summary.package_tier}</strong>
            <p className="muted" style={{ margin: 0 }}>
              Gói dịch vụ
            </p>
          </div>
        </div>
      </section>

      {summary.kpi.metrics.length > 0 ? (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Chỉ số KPI</h3>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Chỉ số</th>
                <th>Trạng thái</th>
                <th>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {summary.kpi.metrics.map((m) => (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  <td>{kpiLabelVi(m.status_label)}</td>
                  <td>{m.progress_pct != null ? `${m.progress_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="muted">Team PTT đang cập nhật KPI tháng này.</p>
      )}
    </HubPageLayout>
  );
}
