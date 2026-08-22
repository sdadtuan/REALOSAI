'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StaffPageShell } from '@/components/layout';
import { clearSession, getStoredUser } from '@/lib/auth';
import { canViewSandboxBoard, canViewSandboxLeads } from '@/lib/sandbox/caps';
import { seedSandboxLeads, tenantIndustry, type SandboxLeadRow } from '@/lib/sandbox/leads-seed';

export default function SandboxLeadsPage() {
  const user = getStoredUser();
  const tenant = user?.tenant ?? 'sandbox_agency';
  const industry = tenantIndustry(tenant);
  const rows = useMemo(() => seedSandboxLeads(tenant), [tenant]);
  const [selected, setSelected] = useState<SandboxLeadRow | null>(null);

  if (!canViewSandboxLeads(user)) {
    return (
      <StaffPageShell user={user} onLogout={() => clearSession()}>
        <p className="error">Sandbox access required.</p>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => clearSession()}
      breadcrumb={[{ label: 'Sandbox', href: '/sandbox/leads' }, { label: 'Leads' }]}
    >
      <h1>Sandbox leads</h1>
      <p className="muted">English preview · tenant {tenant}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(row)}
            >
              <td>{row.full_name}</td>
              <td>{row.company}</td>
              <td>{row.status}</td>
              <td>{row.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected ? (
        <aside className="card" style={{ marginTop: 16 }}>
          <h3>{selected.full_name}</h3>
          <p className="muted">{selected.company}</p>
          <p>Status: {selected.status}</p>
          <p>Created: {selected.created_at}</p>
          <p className="muted">Read-only sandbox preview</p>
        </aside>
      ) : null}
      {canViewSandboxBoard(user) ? (
        <p style={{ marginTop: 16 }}>
          <Link href={`/sandbox/board/${industry}`} className="btn btn-sm">
            Open your industry board
          </Link>
        </p>
      ) : null}
    </StaffPageShell>
  );
}
