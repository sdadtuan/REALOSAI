'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { AdminOrgSubNav } from '@/components/rbac/AdminOrgSubNav';
import { JobFunctionPicker } from '@/components/rbac/JobFunctionPicker';
import { WinWizardSteps } from '@/components/win';
import {
  createStaffOrgUser,
  fetchStaffOrgJobFunctionCatalog,
  fetchStaffOrgNextInternalCode,
  fetchStaffOrgPositions,
  fetchStaffOrgTeams,
  type StaffOrgPositionRow,
  type StaffTeamRow,
} from '@/lib/api';
import {
  canEditOrgUsers,
  canViewOrgAdmin,
  useAdminCrmAuth,
} from '@/lib/admin/use-admin-crm-auth';

type StepId = 'profile' | 'access' | 'account' | 'uat';

const UAT_ITEMS = [
  'NV đăng nhập được bằng email + mật khẩu tạm',
  'Menu sidebar khớp chức vụ / job function',
  'Không thấy mục CRM bị cấm (SoD)',
  'Hồ sơ crm_staff hiển thị đúng tên',
  'HR xác nhận NV hiểu quy trình lead cơ bản',
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function AdminOrgUserOnboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewOrgAdmin);
  const canEdit = canEditOrgUsers(user);

  const [crmStaffId, setCrmStaffId] = useState<number | undefined>(undefined);
  const [step, setStep] = useState<StepId>('profile');
  const [startedAt] = useState(() => Date.now());
  const [positions, setPositions] = useState<StaffOrgPositionRow[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [catalog, setCatalog] = useState<Array<{ code: string; label: string }>>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [internalCodeLocked, setInternalCodeLocked] = useState(false);
  const [jobTitle, setJobTitle] = useState('');

  const [positionId, setPositionId] = useState<number | ''>('');
  const [functions, setFunctions] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [accountKind, setAccountKind] = useState<'staff' | 'guest' | 'contractor'>('staff');
  const [expiresAt, setExpiresAt] = useState('');
  const [uatChecks, setUatChecks] = useState<boolean[]>(() => UAT_ITEMS.map(() => false));

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [tempPasswordShown, setTempPasswordShown] = useState('');

  const selectedPosition = useMemo(
    () => positions.find((p) => p.id === positionId) ?? null,
    [positions, positionId],
  );

  const selectPosition = useCallback(
    (id: number) => {
      setPositionId(id);
      const pos = positions.find((p) => p.id === id);
      if (pos) setJobTitle(pos.name);
    },
    [positions],
  );

  useEffect(() => {
    if (!token) return;
    void Promise.all([
      fetchStaffOrgPositions(token),
      fetchStaffOrgTeams(token),
      fetchStaffOrgJobFunctionCatalog(token),
    ]).then(([pos, tms, fnCat]) => {
      setPositions(pos.filter((p) => p.active !== false));
      setTeams(tms);
      setCatalog(fnCat.map((f) => ({ code: f.code, label: f.label })));
    });
  }, [token]);

  useEffect(() => {
    if (!token || internalCodeLocked) return;
    void fetchStaffOrgNextInternalCode(token)
      .then((res) => setInternalCode(res.internal_code))
      .catch(() => setInternalCode('PTTCN100001'));
  }, [token, internalCodeLocked]);

  useEffect(() => {
    const emailParam = searchParams.get('email')?.trim();
    const nameParam = searchParams.get('name')?.trim();
    const phoneParam = searchParams.get('phone')?.trim();
    const jobTitleParam = searchParams.get('job_title')?.trim();
    const internalCodeParam = searchParams.get('internal_code')?.trim();
    const staffIdRaw = searchParams.get('crm_staff_id')?.trim();

    if (emailParam) setEmail(emailParam);
    if (nameParam) {
      setName(nameParam);
      setDisplayName(nameParam);
    }
    if (phoneParam) setPhone(phoneParam);
    if (jobTitleParam) setJobTitle(jobTitleParam);
    if (internalCodeParam) {
      setInternalCode(internalCodeParam);
      setInternalCodeLocked(true);
    }
    if (staffIdRaw && /^\d+$/.test(staffIdRaw)) setCrmStaffId(Number(staffIdRaw));
  }, [searchParams]);

  useEffect(() => {
    if (!positions.length || positionId !== '') return;
    const match = jobTitle
      ? positions.find((p) => p.name === jobTitle || p.code === jobTitle)
      : null;
    if (match) selectPosition(match.id);
  }, [positions, positionId, jobTitle, selectPosition]);

  const steps = useMemo(
    () =>
      (
        [
          { id: 'profile', label: 'Hồ sơ' },
          { id: 'access', label: 'Quyền' },
          { id: 'account', label: 'Tài khoản' },
          { id: 'uat', label: 'UAT' },
        ] as const
      ).map((s) => ({
        ...s,
        status:
          s.id === step
            ? ('current' as const)
            : ['profile', 'access', 'account', 'uat'].indexOf(s.id) <
                ['profile', 'access', 'account', 'uat'].indexOf(step)
              ? ('done' as const)
              : ('pending' as const),
      })),
    [step],
  );

  const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);

  function nextStep() {
    if (step === 'profile') {
      if (!name.trim()) {
        setFormError('Nhập họ tên nhân viên');
        return;
      }
      if (!positionId) {
        setFormError('Chọn chức danh từ danh mục Admin');
        return;
      }
      if (!internalCode.trim()) {
        setFormError('Mã nhân viên chưa sẵn sàng — thử tải lại trang');
        return;
      }
      setDisplayName(name.trim());
      setStep('access');
    } else if (step === 'access') {
      setStep('account');
    } else if (step === 'account') {
      if (!email.trim() || !email.includes('@')) {
        setFormError('Email không hợp lệ');
        return;
      }
      if ((accountKind === 'guest' || accountKind === 'contractor') && !expiresAt) {
        setFormError('Guest/contractor cần ngày hết hạn');
        return;
      }
      setStep('uat');
    }
    setFormError('');
  }

  function prevStep() {
    setFormError('');
    if (step === 'access') setStep('profile');
    else if (step === 'account') setStep('access');
    else if (step === 'uat') setStep('account');
  }

  function toggleTeam(id: number) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function finish() {
    if (!token || !canEdit) return;
    if (uatChecks.some((c) => !c)) {
      setFormError('Tick đủ checklist UAT trước khi hoàn tất');
      return;
    }
    if (!positionId) return;

    setBusy(true);
    setFormError('');
    try {
      const out = await createStaffOrgUser(token, {
        email: email.trim(),
        display_name: displayName.trim() || name.trim(),
        position_id: Number(positionId),
        team_ids: teamIds,
        functions,
        password,
        account_kind: accountKind,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        ...(crmStaffId != null ? { crm_staff_id: crmStaffId } : {}),
        crm_staff: {
          name: name.trim(),
          phone: phone.trim(),
          internal_code: internalCode.trim(),
          job_title: jobTitle.trim() || selectedPosition?.name || '',
        },
      });
      setTempPasswordShown(out.temp_password ?? password);
      router.push(`/admin/crm/org/users?created=${encodeURIComponent(out.user.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo user thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !loading) {
    return (
      <AdminPageShell user={user} onLogout={logout} section="crm-config" title="Onboard NV" loading={loading}>
        <p className="form-error">Cần quyền crm_staff_roster.edit</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Onboard nhân viên"
      subtitle={`Wizard WIN-2 · mục tiêu ≤15 ph · đã ${elapsedMin} phút`}
      breadcrumb={[
        { label: 'Quản trị hệ thống', href: '/admin' },
        { label: 'Người dùng', href: '/admin/crm/org/users' },
        { label: 'Onboard' },
      ]}
      loading={loading}
      actions={
        <Link href="/admin/crm/org/users" className="btn btn-ghost btn-sm">
          ← Danh sách
        </Link>
      }
    >
      <AdminOrgSubNav />
      {crmStaffId != null ? (
        <p className="staff-roster-callout" role="status">
          Đang onboard từ hồ sơ roster (crm_staff #{crmStaffId}).
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {tempPasswordShown ? (
        <p className="muted">
          Mật khẩu tạm: <code>{tempPasswordShown}</code> — copy gửi NV qua kênh bảo mật.
        </p>
      ) : null}

      <WinWizardSteps steps={steps} onStepClick={(id) => setStep(id as StepId)} />

      <div className="onboard-wizard">
        {step === 'profile' ? (
          <div className="page-card onboard-wizard__panel">
            <div className="onboard-wizard__panel-head">
              <h3>Hồ sơ nhân viên</h3>
              <p className="muted">Thông tin cơ bản và chức danh từ danh mục Admin.</p>
            </div>
            <div className="onboard-wizard__grid">
              <label className="onboard-wizard__field onboard-wizard__field--wide">
                <span className="onboard-wizard__label">Họ tên *</span>
                <input
                  className="onboard-wizard__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                />
              </label>
              <label className="onboard-wizard__field">
                <span className="onboard-wizard__label">Số điện thoại</span>
                <input
                  className="onboard-wizard__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  inputMode="tel"
                />
              </label>
              <label className="onboard-wizard__field">
                <span className="onboard-wizard__label">Mã nhân viên</span>
                <input
                  className="onboard-wizard__input onboard-wizard__input--code"
                  value={internalCode}
                  readOnly
                  aria-readonly="true"
                />
                <span className="onboard-wizard__hint">
                  Tự động theo mẫu PTTCN100001, PTTCN100002…
                </span>
              </label>
              <label className="onboard-wizard__field onboard-wizard__field--wide">
                <span className="onboard-wizard__label">Chức danh *</span>
                <select
                  className="onboard-wizard__input"
                  value={positionId === '' ? '' : String(positionId)}
                  onChange={(e) => selectPosition(Number(e.target.value))}
                >
                  <option value="">— Chọn chức danh —</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                <span className="onboard-wizard__hint">
                  Danh sách từ{' '}
                  <Link href="/admin/crm/org/positions" className="onboard-wizard__link">
                    Admin → Chức vụ (HR)
                  </Link>
                </span>
              </label>
            </div>
          </div>
        ) : null}

        {step === 'access' ? (
          <div className="page-card onboard-wizard__panel stack-gap">
            <div className="onboard-wizard__summary">
              <div>
                <div className="muted">Chức danh đã chọn</div>
                <strong>
                  {selectedPosition
                    ? `${selectedPosition.code} — ${selectedPosition.name}`
                    : '—'}
                </strong>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('profile')}>
                Sửa hồ sơ
              </button>
            </div>
            <JobFunctionPicker options={catalog} value={functions} onChange={setFunctions} />
            <div>
              <p className="onboard-wizard__label">Team</p>
              <div className="win-filter-chips">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${teamIds.includes(t.id) ? ' is-active' : ''}`}
                    onClick={() => toggleTeam(t.id)}
                  >
                    {t.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 'account' ? (
          <div className="page-card onboard-wizard__panel stack-gap">
            <label className="onboard-wizard__field onboard-wizard__field--wide">
              <span className="onboard-wizard__label">Email đăng nhập *</span>
              <input
                className="onboard-wizard__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="name@pttads.vn"
              />
            </label>
            <label className="onboard-wizard__field onboard-wizard__field--wide">
              <span className="onboard-wizard__label">Tên hiển thị</span>
              <input
                className="onboard-wizard__input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="onboard-wizard__field onboard-wizard__field--wide">
              <span className="onboard-wizard__label">Mật khẩu tạm</span>
              <div className="onboard-wizard__inline-actions">
                <input
                  className="onboard-wizard__input onboard-wizard__input--code"
                  value={password}
                  readOnly
                />
                <button type="button" className="btn btn-sm" onClick={() => setPassword(generatePassword())}>
                  Tạo lại
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => void navigator.clipboard.writeText(password)}
                >
                  Copy
                </button>
              </div>
            </label>
            <label className="onboard-wizard__field onboard-wizard__field--wide">
              <span className="onboard-wizard__label">Loại tài khoản</span>
              <select
                className="onboard-wizard__input"
                value={accountKind}
                onChange={(e) => setAccountKind(e.target.value as 'staff' | 'guest' | 'contractor')}
              >
                <option value="staff">Nhân viên</option>
                <option value="guest">Khách (guest)</option>
                <option value="contractor">Cộng tác viên</option>
              </select>
            </label>
            {accountKind !== 'staff' ? (
              <label className="onboard-wizard__field">
                <span className="onboard-wizard__label">Ngày hết hạn *</span>
                <input
                  className="onboard-wizard__input"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 'uat' ? (
          <div className="page-card onboard-wizard__panel">
            <ul className="onboard-wizard__uat-list">
              {UAT_ITEMS.map((label, i) => (
                <li key={label}>
                  <label className="onboard-wizard__uat-item">
                    <input
                      type="checkbox"
                      checked={uatChecks[i]}
                      onChange={(e) =>
                        setUatChecks((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                      }
                    />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="onboard-wizard__actions">
          {step !== 'profile' ? (
            <button type="button" className="btn btn-ghost" onClick={prevStep} disabled={busy}>
              Quay lại
            </button>
          ) : null}
          {step !== 'uat' ? (
            <button type="button" className="btn btn-primary" onClick={nextStep} disabled={busy}>
              Tiếp
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void finish()} disabled={busy}>
              Hoàn tất onboard
            </button>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}

export default function AdminOrgUserOnboardPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell
          user={null}
          onLogout={() => {}}
          section="crm-config"
          title="Onboard nhân viên"
          loading
        >
          <span />
        </AdminPageShell>
      }
    >
      <AdminOrgUserOnboardPageContent />
    </Suspense>
  );
}
