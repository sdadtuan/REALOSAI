'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchAgency,
  fetchAgencyBasket,
  fetchBdsAgencies,
  postAgency,
  postAgencyActivate,
  postAgencyContract,
  postAgencyGrantUnits,
  postAgencyRevokeUnit,
  postAgencySuspend,
  postAgencyTierOverride,
  type BdsAgency,
  type BdsBasketUnit,
} from '@/lib/bds/api';
import { agencyActivateRole, tierOverrideRole } from '@/lib/bds/actor-role';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { w2ActionCopy } from '@/lib/bds/w2-copy';

export default function BdsAgencyDetailPage() {
  const params = useParams();
  const agencyId = String(params.id ?? '');
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_agencies', action: 'view' },
  ]);
  const canEdit = hasCap(user, 'bds_agencies', 'edit');
  const canCreate = hasCap(user, 'bds_agencies', 'create');
  const canSuspend = hasCap(user, 'bds_agencies', 'suspend');
  const canTierOverride = hasCap(user, 'bds_agency_tiers', 'override');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const [agency, setAgency] = useState<BdsAgency | null>(null);
  const [basket, setBasket] = useState<BdsBasketUnit[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [grantBlocked, setGrantBlocked] = useState(false);
  const [productIdsRaw, setProductIdsRaw] = useState('');
  const [exclusivity, setExclusivity] = useState<'shared' | 'exclusive'>('shared');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeProductId, setRevokeProductId] = useState('');
  const [tierCode, setTierCode] = useState('');
  const [tierReason, setTierReason] = useState('');

  const reload = async (accessToken: string, pid?: number) => {
    try {
      const [ag, bk] = await Promise.all([
        fetchAgency(accessToken, agencyId),
        fetchAgencyBasket(accessToken, agencyId, pid),
      ]);
      setAgency(ag);
      setBasket(bk);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải đại lý thất bại');
    }
  };

  useEffect(() => {
    if (!token) return;
    void reload(token, projectId > 0 ? projectId : undefined);
  }, [token, agencyId, projectId]);

  const runAction = async (fn: () => Promise<unknown>, onContract?: boolean) => {
    if (!token) return;
    setActionError('');
    setBusy(true);
    try {
      await fn();
      if (onContract) setGrantBlocked(false);
      await reload(token, projectId > 0 ? projectId : undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      const copy = w2ActionCopy(msg);
      setActionError(copy);
      if (/\bcontract\b/i.test(msg)) setGrantBlocked(true);
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  const productIds = productIdsRaw
    .split(/[,;\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title={agency ? `${agency.code} · ${agency.name}` : 'Đại lý'} subtitle="Chi tiết đại lý">
        <p style={{ marginTop: 0 }}>
          <Link href="/crm/bds/agencies" className="nav-link">
            ← Mạng đại lý
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="error">{loadError}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}

        {agency ? (
          <p className="muted">
            Trạng thái: {agency.status}
            {agency.tier_id ? ` · Hạng ${agency.tier_id}` : ''}
          </p>
        ) : null}

        {(canEdit || canCreate) && agency ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                onClick={() =>
                  void runAction(() =>
                    postAgencyActivate(token!, agencyId, { actor_role: agencyActivateRole() }),
                  )
                }
              >
                Kích hoạt
              </button>
            ) : null}
            {canSuspend ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => void runAction(() => postAgencySuspend(token!, agencyId))}
              >
                Tạm dừng
              </button>
            ) : null}
          </div>
        ) : null}

        <BdsProjectField token={token ?? ''} projectId={projectId} onProjectChange={setProjectId} />

        {projectId > 0 && canEdit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction(
                () => postAgencyContract(token!, agencyId, { project_id: projectId }),
                true,
              );
            }}
            style={{ marginBottom: '1rem' }}
          >
            <button type="submit" className="btn btn-sm btn-secondary" disabled={busy}>
              Tạo HĐ phân phối (dự án hiện tại)
            </button>
          </form>
        ) : null}

        <h3>Giỏ căn</h3>
        <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
          {basket.map((u) => (
            <li key={u.product_id}>
              product #{u.product_id}
              {u.exclusivity ? ` · ${u.exclusivity}` : ''}
            </li>
          ))}
        </ul>

        {canEdit && projectId > 0 ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (productIds.length === 0) return;
                const body: Parameters<typeof postAgencyGrantUnits>[2] = {
                  project_id: projectId,
                  product_ids: productIds,
                  exclusivity,
                };
                if (exclusivity === 'exclusive' && canTierOverride) {
                  body.actor_role = tierOverrideRole();
                }
                void runAction(() => postAgencyGrantUnits(token!, agencyId, body));
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
            >
              <input
                value={productIdsRaw}
                onChange={(e) => setProductIdsRaw(e.target.value)}
                placeholder="product_ids (CSV)"
                disabled={busy || grantBlocked}
                style={inputStyle}
              />
              <select
                value={exclusivity}
                onChange={(e) => setExclusivity(e.target.value as 'shared' | 'exclusive')}
                disabled={busy || grantBlocked || !canTierOverride}
                style={selectStyle}
              >
                <option value="shared">shared</option>
                <option value="exclusive">exclusive</option>
              </select>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={busy || grantBlocked || productIds.length === 0}
                title={grantBlocked ? 'Chưa có HĐ phân phối — không cấp giỏ.' : undefined}
              >
                Cấp giỏ
              </button>
            </form>
            {grantBlocked ? (
              <p className="muted">Chưa có HĐ phân phối — không cấp giỏ. Tạo HĐ trước.</p>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const pid = Number(revokeProductId);
                if (!Number.isFinite(pid) || pid <= 0 || !revokeReason.trim()) return;
                void runAction(() =>
                  postAgencyRevokeUnit(token!, agencyId, pid, revokeReason.trim()),
                );
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
            >
              <input
                value={revokeProductId}
                onChange={(e) => setRevokeProductId(e.target.value)}
                placeholder="product_id thu hồi"
                disabled={busy}
                style={inputStyle}
              />
              <input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Lý do (bắt buộc)"
                disabled={busy}
                style={inputStyle}
              />
              <button type="submit" className="btn btn-sm btn-secondary" disabled={busy || !revokeReason.trim()}>
                Thu hồi
              </button>
            </form>
          </>
        ) : null}

        {canTierOverride ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tierReason.trim().length < 10 || !tierCode.trim()) return;
              void runAction(() =>
                postAgencyTierOverride(token!, agencyId, {
                  tier_code: tierCode.trim(),
                  actor_role: tierOverrideRole(),
                  reason: tierReason.trim(),
                }),
              );
            }}
            style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
          >
            <input value={tierCode} onChange={(e) => setTierCode(e.target.value)} placeholder="tier_code" disabled={busy} style={inputStyle} />
            <input value={tierReason} onChange={(e) => setTierReason(e.target.value)} placeholder="Lý do ≥10 ký tự" disabled={busy} style={inputStyle} />
            <button type="submit" className="btn btn-sm btn-secondary" disabled={busy || tierReason.trim().length < 10}>
              Override hạng
            </button>
          </form>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 120,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;

const selectStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;
