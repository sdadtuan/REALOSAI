'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { WinFieldMask } from '@/components/rbac/WinFieldMask';
import {
  AddressPairFields,
  emptyAddress,
  pickAddress,
} from '@/components/hr/AddressPairFields';
import { InsurancePanel } from '@/components/hr/InsurancePanel';
import { DependentsPanel } from '@/components/hr/DependentsPanel';
import { LifecycleSection } from '@/components/hr/LifecycleSection';
import { ContractPanel } from '@/components/hr/ContractPanel';
import { IdentityHeader, type EmployeeFileTab } from '@/components/hr/IdentityHeader';
import { WalletPanel } from '@/components/hr/WalletPanel';
import { AttendancePanel } from '@/components/hr/AttendancePanel';
import type { StoredStaffUser } from '@/lib/auth';
import {
  fetchHrStaffProfile,
  patchHrStaffIdentity,
  putHrStaffAddresses,
  type HrStaffAddressDto,
  type HrStaffIdentityDto,
  type HrStaffProfileDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
  user: StoredStaffUser;
  crmPanel: ReactNode;
  onProfileError?: (message: string) => void;
};

type DirtyState = { identity: boolean; addresses: boolean };

export function EmployeeFileShell({ staffId, token, user, crmPanel, onProfileError }: Props) {
  const [profile, setProfile] = useState<HrStaffProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EmployeeFileTab>('wallet');
  const [walletPct, setWalletPct] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [contractExpiring, setContractExpiring] = useState(false);
  const [insuranceExpiring, setInsuranceExpiring] = useState(false);
  const [pendingTab, setPendingTab] = useState<EmployeeFileTab | null>(null);
  const [identityDraft, setIdentityDraft] = useState<HrStaffIdentityDto>({});
  const [permanentDraft, setPermanentDraft] = useState<HrStaffAddressDto>(emptyAddress('permanent'));
  const [temporaryDraft, setTemporaryDraft] = useState<HrStaffAddressDto>(emptyAddress('temporary'));
  const [dirty, setDirty] = useState<DirtyState>({ identity: false, addresses: false });
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingAddresses, setSavingAddresses] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHrStaffProfile(token, staffId);
      setProfile(data);
      setWalletPct(data.wallet_pct ?? data.completeness_pct ?? 0);
      setExpiringCount(data.expiring_count ?? 0);
      setContractExpiring(Boolean(data.active_contract?.expiring_soon));
      setInsuranceExpiring(Boolean(data.insurance_summary?.bhyt_expiring_soon));
      setIdentityDraft(data.identity);
      setPermanentDraft(pickAddress(data.addresses, 'permanent'));
      setTemporaryDraft(pickAddress(data.addresses, 'temporary'));
      setDirty({ identity: false, addresses: false });
    } catch (err) {
      onProfileError?.(err instanceof Error ? err.message : 'Không tải hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [onProfileError, staffId, token]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const canEditIdentity = Boolean(profile?.can_edit_roster);
  const canEditPii = Boolean(profile?.can_edit_pii);

  const railTasks = useMemo(() => {
    if (!profile) return [];
    const tasks: string[] = [];
    if (!profile.identity.legal_name?.trim()) tasks.push('Thiếu họ tên pháp lý');
    if (!profile.identity.cccd?.trim() && !profile.identity.cccd_masked) tasks.push('Thiếu CCCD');
    const permanent = pickAddress(profile.addresses, 'permanent');
    const temporary = pickAddress(profile.addresses, 'temporary');
    if (!permanent.line1?.trim()) tasks.push('Thiếu địa chỉ thường trú');
    if (!temporary.line1?.trim() && !temporary.same_as_permanent) tasks.push('Thiếu địa chỉ tạm trú');
    return tasks;
  }, [profile]);

  function requestTab(tab: EmployeeFileTab) {
    if (tab === activeTab) return;
    if (activeTab === 'profile' && tab !== 'profile' && (dirty.identity || dirty.addresses)) {
      setPendingTab(tab);
      return;
    }
    setActiveTab(tab);
  }

  function discardDirty() {
    if (!profile) return;
    setIdentityDraft(profile.identity);
    setPermanentDraft(pickAddress(profile.addresses, 'permanent'));
    setTemporaryDraft(pickAddress(profile.addresses, 'temporary'));
    setDirty({ identity: false, addresses: false });
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  }

  async function saveIdentity() {
    if (!profile) return;
    setSavingIdentity(true);
    setSaveMsg('');
    try {
      const out = await patchHrStaffIdentity(token, staffId, identityDraft);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              identity: out.identity,
              completeness_pct: out.completeness_pct,
            }
          : prev,
      );
      setIdentityDraft(out.identity);
      setDirty((d) => ({ ...d, identity: false }));
      setSaveMsg('Đã lưu định danh');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveAddresses() {
    if (!profile) return;
    setSavingAddresses(true);
    setSaveMsg('');
    try {
      const out = await putHrStaffAddresses(token, staffId, [permanentDraft, temporaryDraft]);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              addresses: out.addresses,
              completeness_pct: out.completeness_pct,
            }
          : prev,
      );
      setPermanentDraft(pickAddress(out.addresses, 'permanent'));
      setTemporaryDraft(pickAddress(out.addresses, 'temporary'));
      setDirty((d) => ({ ...d, addresses: false }));
      setSaveMsg('Đã lưu địa chỉ');
      if (pendingTab) {
        setActiveTab(pendingTab);
        setPendingTab(null);
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSavingAddresses(false);
    }
  }

  if (loading && !profile) {
    return <p className="muted">Đang tải hồ sơ nhân viên…</p>;
  }

  if (!profile) {
    return (
      <p className="muted">
        Hồ sơ 360 chưa sẵn sàng (cần bật <code>PTT_HR_EMPLOYEE_FILE</code> và apply DDL P1).
      </p>
    );
  }

  return (
    <div className="employee-file-shell">
      <IdentityHeader
        profile={profile}
        activeTab={activeTab}
        onTabChange={requestTab}
        walletPct={walletPct}
        expiringCount={expiringCount}
        contractExpiring={contractExpiring}
        insuranceExpiring={insuranceExpiring}
        showFamilyTab={Boolean(profile.can_view_dependents)}
        showAttendanceTab={Boolean(profile.can_view_attendance)}
      />
      {saveMsg ? (
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          {saveMsg}
        </p>
      ) : null}
      {pendingTab ? (
        <div className="page-card" style={{ marginTop: '0.75rem', borderColor: 'var(--warn-border, #d4a017)' }}>
          <p style={{ margin: 0 }}>Có thay đổi chưa lưu. Lưu từng sổ hoặc bỏ thay đổi trước khi đổi tab.</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={discardDirty}>
              Bỏ thay đổi
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'wallet' ? (
        <div className="employee-file-canvas employee-file-canvas--full">
          <WalletPanel
            staffId={staffId}
            token={token}
            canEdit={Boolean(profile.can_edit_docs)}
            onWalletChange={(pct, exp) => {
              setWalletPct(pct);
              setExpiringCount(exp);
              setProfile((prev) => (prev ? { ...prev, wallet_pct: pct, completeness_pct: pct, expiring_count: exp } : prev));
            }}
          />
        </div>
      ) : null}

      {activeTab === 'contracts' ? (
        <div className="employee-file-canvas employee-file-canvas--full">
          <ContractPanel
            staffId={staffId}
            token={token}
            canEdit={Boolean(profile.can_edit_contract)}
            canViewPii={Boolean(profile.can_view_pii)}
            canEditPii={Boolean(profile.can_edit_pii)}
            onActiveContractChange={(active) => {
              setContractExpiring(Boolean(active?.expiring_soon));
              setProfile((prev) => (prev ? { ...prev, active_contract: active } : prev));
            }}
          />
        </div>
      ) : null}

      {activeTab === 'insurance' ? (
        <div className="employee-file-canvas employee-file-canvas--full">
          <InsurancePanel
            staffId={staffId}
            token={token}
            canEdit={Boolean(profile.can_edit_insurance)}
            canViewPii={Boolean(profile.can_view_pii)}
            canEditPii={Boolean(profile.can_edit_pii)}
            onInsuranceChange={(summary) => {
              setInsuranceExpiring(Boolean(summary?.bhyt_expiring_soon));
              setProfile((prev) => (prev ? { ...prev, insurance_summary: summary } : prev));
            }}
          />
        </div>
      ) : null}

      {activeTab === 'family' && profile.can_view_dependents ? (
        <div className="employee-file-canvas employee-file-canvas--full">
          <DependentsPanel
            staffId={staffId}
            token={token}
            canEdit={Boolean(profile.can_edit_dependents)}
            canViewPii={Boolean(profile.can_view_pii)}
          />
        </div>
      ) : null}

      {activeTab === 'attendance' && profile.can_view_attendance ? (
        <div className="employee-file-canvas employee-file-canvas--full">
          <AttendancePanel staffId={staffId} token={token} />
        </div>
      ) : null}

      {activeTab === 'profile' ? (
        <div className="employee-file-body">
          <aside className="employee-file-rail page-card">
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>Việc tiếp theo</h3>
            {railTasks.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Hồ sơ cơ bản đủ.
              </p>
            ) : (
              <ul className="employee-file-rail__list">
                {railTasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            )}
          </aside>
          <div className="employee-file-canvas stack-gap">
            <LifecycleSection
              staffId={staffId}
              token={token}
              canEdit={canEditIdentity}
              initial={profile.lifecycle_summary ?? null}
              onLifecycleChange={(lc) => {
                if (!lc) return;
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        lifecycle_summary: {
                          stage: lc.stage,
                          stage_label: lc.stage_label,
                          stage_changed_on: lc.stage_changed_on ?? null,
                        },
                      }
                    : prev,
                );
              }}
            />
            <section className="page-card">
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Định danh</h2>
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span className="form-label">Họ tên pháp lý</span>
                  <input
                    className="form-input"
                    value={identityDraft.legal_name ?? ''}
                    disabled={!canEditIdentity}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, legal_name: e.target.value }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Ngày sinh</span>
                  <input
                    type="date"
                    className="form-input"
                    value={identityDraft.dob ?? ''}
                    disabled={!canEditIdentity}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, dob: e.target.value || null }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">CCCD</span>
                  {profile.identity.pii_masked && !canEditPii ? (
                    <WinFieldMask
                      user={user}
                      value={identityDraft.cccd}
                      section="crm_hr_pii"
                      action="view"
                      variant="pii"
                    />
                  ) : (
                    <input
                      className="form-input mono"
                      value={identityDraft.cccd ?? ''}
                      disabled={!canEditIdentity || !canEditPii}
                      onChange={(e) => {
                        setIdentityDraft((d) => ({ ...d, cccd: e.target.value }));
                        setDirty((x) => ({ ...x, identity: true }));
                      }}
                    />
                  )}
                </label>
                <label className="form-field">
                  <span className="form-label">MST</span>
                  {profile.identity.pii_masked && !canEditPii ? (
                    <WinFieldMask
                      user={user}
                      value={identityDraft.tax_code}
                      section="crm_hr_pii"
                      action="view"
                      variant="pii"
                    />
                  ) : (
                    <input
                      className="form-input mono"
                      value={identityDraft.tax_code ?? ''}
                      disabled={!canEditIdentity || !canEditPii}
                      onChange={(e) => {
                        setIdentityDraft((d) => ({ ...d, tax_code: e.target.value }));
                        setDirty((x) => ({ ...x, identity: true }));
                      }}
                    />
                  )}
                </label>
                <label className="form-field">
                  <span className="form-label">PIN máy chấm công</span>
                  <input
                    className="form-input mono"
                    value={identityDraft.timeclock_pin ?? ''}
                    disabled={!canEditIdentity}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, timeclock_pin: e.target.value }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                    placeholder="Trùng mã trên máy ZK/ADMS"
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Ngân hàng</span>
                  <input
                    className="form-input"
                    value={identityDraft.bank_name ?? ''}
                    disabled={!canEditIdentity || !canEditPii}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, bank_name: e.target.value }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Số TK</span>
                  <input
                    className="form-input mono"
                    value={identityDraft.bank_account ?? ''}
                    disabled={!canEditIdentity || !canEditPii}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, bank_account: e.target.value }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                  />
                </label>
                <label className="form-field">
                  <span className="form-label">Chủ TK</span>
                  <input
                    className="form-input"
                    value={identityDraft.bank_holder ?? ''}
                    disabled={!canEditIdentity || !canEditPii}
                    onChange={(e) => {
                      setIdentityDraft((d) => ({ ...d, bank_holder: e.target.value }));
                      setDirty((x) => ({ ...x, identity: true }));
                    }}
                  />
                </label>
              </div>
              <footer style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!canEditIdentity || !dirty.identity || savingIdentity}
                  onClick={() => void saveIdentity()}
                >
                  {savingIdentity ? 'Đang lưu…' : 'Lưu định danh'}
                </button>
              </footer>
            </section>

            <section className="page-card">
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Địa chỉ</h2>
              <AddressPairFields
                permanent={permanentDraft}
                temporary={temporaryDraft}
                canEdit={canEditIdentity}
                onPermanentChange={(next) => {
                  setPermanentDraft(next);
                  setDirty((x) => ({ ...x, addresses: true }));
                }}
                onTemporaryChange={(next) => {
                  setTemporaryDraft(next);
                  setDirty((x) => ({ ...x, addresses: true }));
                }}
              />
              <footer style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!canEditIdentity || !dirty.addresses || savingAddresses}
                  onClick={() => void saveAddresses()}
                >
                  {savingAddresses ? 'Đang lưu…' : 'Lưu địa chỉ'}
                </button>
              </footer>
            </section>
          </div>
        </div>
      ) : activeTab === 'crm' ? (
        <div className="employee-file-canvas employee-file-canvas--full">{crmPanel}</div>
      ) : null}
    </div>
  );
}
