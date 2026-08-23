'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import { fetchBdsAgencies } from '@/lib/bds/api';
import type { BdsAgency, BdsCommissionStatement } from '@/lib/bds/types';
import { BdsCommissionAdvancePanel } from '@/lib/bds/BdsCommissionAdvancePanel';
import { BdsCommissionLedgerPanel } from '@/lib/bds/BdsCommissionLedgerPanel';
import { BdsCommissionPeriodPanel } from '@/lib/bds/BdsCommissionPeriodPanel';
import { BdsCommissionSchemePanel } from '@/lib/bds/BdsCommissionSchemePanel';
import { hideCommissionSchemePct } from '@/lib/bds/caps';
import { defaultPeriodMonthInput, toPeriodMonthStart } from '@/lib/bds/w3-period';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

type CommissionsTab = 'scheme' | 'ledger' | 'period' | 'advance';

const TABS: { id: CommissionsTab; label: string }[] = [
  { id: 'scheme', label: 'Scheme' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'period', label: 'Kỳ' },
  { id: 'advance', label: 'Tạm ứng' },
];

export default function BdsCommissionsPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_commission', action: 'view' },
  ]);

  const canApprove = hasCap(user, 'bds_commission', 'approve');
  const canPayout = hasCap(user, 'bds_commission', 'payout');
  const canRecalcTiers = hasCap(user, 'bds_agency_tiers', 'configure');
  const hidePct = hideCommissionSchemePct(user);

  const [tab, setTab] = useState<CommissionsTab>('ledger');
  const [agencies, setAgencies] = useState<BdsAgency[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [periodInput, setPeriodInput] = useState(defaultPeriodMonthInput);
  const [periodMonth, setPeriodMonth] = useState(() => toPeriodMonthStart(defaultPeriodMonthInput()));
  const [reloadToken, setReloadToken] = useState(0);
  const [statement, setStatement] = useState<BdsCommissionStatement | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    void fetchBdsAgencies(token)
      .then((rows) => {
        setAgencies(rows);
        setAgencyId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Tải đại lý thất bại'));
  }, [token]);

  const onPeriodChange = (value: string) => {
    setPeriodInput(value);
    setPeriodMonth(toPeriodMonthStart(value));
    setStatement(null);
  };

  const bumpReload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  const onStatementChange = useCallback((stmt: BdsCommissionStatement | null) => {
    setStatement(stmt);
  }, []);

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Hoa hồng" subtitle="Scheme · Ledger · Kỳ · Tạm ứng">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="error">{loadError}</p> : null}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
            alignItems: 'end',
          }}
        >
          <label>
            Đại lý{' '}
            <select value={agencyId} onChange={(e) => {
              setAgencyId(e.target.value);
              setStatement(null);
            }}>
              <option value="">— chọn —</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kỳ{' '}
            <input type="month" value={periodInput} onChange={(e) => onPeriodChange(e.target.value)} />
          </label>
        </div>

        <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'scheme' && token ? (
          <BdsCommissionSchemePanel token={token} user={user} agencies={agencies} />
        ) : null}
        {tab === 'ledger' && token ? (
          <BdsCommissionLedgerPanel
            token={token}
            agencyId={agencyId}
            periodMonth={periodMonth}
            reloadToken={reloadToken}
            hidePct={hidePct}
            onRefresh={bumpReload}
          />
        ) : null}
        {tab === 'period' && token ? (
          <BdsCommissionPeriodPanel
            token={token}
            agencyId={agencyId}
            periodMonth={periodMonth}
            canApprove={canApprove}
            canPayout={canPayout}
            statement={statement}
            onStatementChange={onStatementChange}
            onPaid={bumpReload}
          />
        ) : null}
        {tab === 'advance' && token ? (
          <BdsCommissionAdvancePanel
            token={token}
            agencyId={agencyId}
            periodMonth={periodMonth}
            canPayout={canPayout}
            statementStatus={statement?.status ?? ''}
            onSuccess={() => undefined}
          />
        ) : null}

        {canRecalcTiers ? (
          <p style={{ marginTop: '1.5rem' }}>
            <Link href="/crm/bds/tiers">Recalc hạng đại lý →</Link>
          </p>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
