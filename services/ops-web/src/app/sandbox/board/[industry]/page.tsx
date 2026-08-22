'use client';

import { StaffPageShell } from '@/components/layout';
import { clearSession, getStoredUser } from '@/lib/auth';
import { getSandboxBoardKpis } from '@/lib/sandbox/board-data';
import { canViewSandboxBoard } from '@/lib/sandbox/caps';

type Props = { params: { industry: string } };

export default function SandboxBoardPage({ params }: Props) {
  const user = getStoredUser();
  const industry = params.industry || 'agency';
  const kpis = getSandboxBoardKpis(user?.tenant ?? 'sandbox_agency', industry);

  if (!canViewSandboxBoard(user)) {
    return (
      <StaffPageShell user={user} onLogout={() => clearSession()}>
        <p className="error">Sandbox board access required.</p>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => clearSession()}
      breadcrumb={[
        { label: 'Sandbox', href: '/sandbox/leads' },
        { label: `${industry} board` },
      ]}
    >
      <p className="badge badge-warn">Sample data — not PO-signed metrics</p>
      <h1>{industry} industry board</h1>
      <div
        className="kpi-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}
      >
        <div className="card">
          <h3>Leads this week</h3>
          <p className="amt">{kpis.leads_this_week}</p>
        </div>
        <div className="card">
          <h3>CPL (demo)</h3>
          <p className="amt">${kpis.cpl_demo_usd}</p>
        </div>
        <div className="card">
          <h3>Demo booked</h3>
          <p className="amt">{kpis.demos_booked}</p>
        </div>
      </div>
    </StaffPageShell>
  );
}
