'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EffectiveCapsPreview } from '@/components/rbac/EffectiveCapsPreview';
import { JobFunctionPicker } from '@/components/rbac/JobFunctionPicker';
import { ClientScopePicker } from '@/components/rbac/ClientScopePicker';
import { WinReloginToast, WinSodBanner } from '@/components/win';
import { PermissionSetPicker } from '@/components/rbac/PermissionSetPicker';
import {
  fetchStaffOrgTeams,
  fetchStaffPermissionSets,
  fetchStaffUserEffectiveCaps,
  fetchStaffUserJobFunctions,
  fetchStaffUserClientScope,
  fetchStaffUserPermissionSets,
  offboardStaffOrgUser,
  patchStaffOrgUser,
  putStaffUserJobFunctions,
  putStaffUserClientScope,
  putStaffUserPermissionSets,
  type StaffOrgPositionRow,
  type StaffOrgUserSummary,
  type StaffPermissionSetSummary,
  type StaffTeamRow,
  type StaffUserEffectiveCaps,
} from '@/lib/api';
import { winPermissionSetsEnabled, winScopePilotEnabled } from '@/lib/win/flags';
import { detectSodViolations } from '@/lib/rbac/sod-rules';

type Props = {
  token: string;
  user: StaffOrgUserSummary;
  positions: StaffOrgPositionRow[];
  functionOptions: Array<{ code: string; label: string }>;
  canEdit: boolean;
  onSaved?: (user: StaffOrgUserSummary) => void;
  onOffboarded?: () => void;
};

export function UserIdentityCard({
  token,
  user,
  positions,
  functionOptions,
  canEdit,
  onSaved,
  onOffboarded,
}: Props) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [positionId, setPositionId] = useState(user.position_id);
  const [functions, setFunctions] = useState<string[]>(user.job_functions ?? []);
  const [teamIds, setTeamIds] = useState<number[]>(user.team_ids ?? []);
  const [setCodes, setSetCodes] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [setOptions, setSetOptions] = useState<StaffPermissionSetSummary[]>([]);
  const [teams, setTeams] = useState<StaffTeamRow[]>([]);
  const [preview, setPreview] = useState<StaffUserEffectiveCaps | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRelogin, setShowRelogin] = useState(false);
  const [showOffboard, setShowOffboard] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  const sodViolations = useMemo(() => detectSodViolations(functions), [functions]);

  const loadDetail = useCallback(async () => {
    const detail = await fetchStaffUserJobFunctions(token, user.id);
    setFunctions([...(detail.functions ?? [])].sort());
    if (winPermissionSetsEnabled()) {
      try {
        const sets = await fetchStaffUserPermissionSets(token, user.id);
        setSetCodes([...(sets.set_codes ?? [])].sort());
      } catch {
        setSetCodes([]);
      }
    }
    if (winScopePilotEnabled()) {
      try {
        const scope = await fetchStaffUserClientScope(token, user.id);
        setClientIds([...(scope.client_ids ?? [])].sort());
      } catch {
        setClientIds([]);
      }
    }
    try {
      setPreview(await fetchStaffUserEffectiveCaps(token, user.id));
    } catch {
      setPreview(null);
    }
  }, [token, user.id]);

  useEffect(() => {
    setDisplayName(user.display_name);
    setPositionId(user.position_id);
    setFunctions(user.job_functions ?? []);
    setTeamIds(user.team_ids ?? []);
    void loadDetail();
  }, [user, loadDetail]);

  useEffect(() => {
    void fetchStaffOrgTeams(token).then(setTeams).catch(() => setTeams([]));
  }, [token]);

  useEffect(() => {
    if (!winPermissionSetsEnabled()) return;
    void fetchStaffPermissionSets(token).then(setSetOptions).catch(() => setSetOptions([]));
  }, [token]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    setError('');
    try {
      if (sodViolations.length) {
        setError('SoD conflict — bỏ bớt job function trước khi lưu');
        return;
      }
      const patched = await patchStaffOrgUser(token, user.id, {
        display_name: displayName,
        position_id: positionId,
        team_ids: teamIds,
      });
      await putStaffUserJobFunctions(token, user.id, functions);
      if (winPermissionSetsEnabled()) {
        await putStaffUserPermissionSets(token, user.id, setCodes);
      }
      if (winScopePilotEnabled()) {
        await putStaffUserClientScope(token, user.id, clientIds);
      }
      await loadDetail();
      onSaved?.({ ...patched, job_functions: functions });
      setShowRelogin(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function confirmOffboard() {
    const target = Number(reassignTo);
    if (!Number.isFinite(target) || target <= 0) {
      setError('Chọn NV nhận lead');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await offboardStaffOrgUser(token, user.id, { reassign_to: target, deactivate: true });
      setShowOffboard(false);
      onOffboarded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Offboard thất bại');
    } finally {
      setBusy(false);
    }
  }

  function toggleTeam(teamId: number) {
    if (!canEdit) return;
    setTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  }

  function exportJson() {
    const payload = {
      user_id: user.id,
      email: user.email,
      display_name: displayName,
      position_id: positionId,
      team_ids: teamIds,
      job_functions: functions,
      set_codes: setCodes,
      client_ids: clientIds,
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  return (
    <div className="user-identity-card stack-gap">
      {error ? <p className="form-error">{error}</p> : null}
      {!user.active ? <p className="muted">Tài khoản đã ngưng hoạt động</p> : null}

      <section>
        <h3 className="muted" style={{ marginTop: 0, fontSize: '0.8rem' }}>
          Hồ sơ HR
        </h3>
        {user.crm_staff_id ? (
          <Link href={`/crm/staff/${user.crm_staff_id}`} className="nav-link">
            crm_staff #{user.crm_staff_id} — {user.email}
          </Link>
        ) : (
          <p className="muted">Chưa liên kết crm_staff (match theo email khi onboard)</p>
        )}
      </section>

      <label>
        Tên hiển thị
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={!canEdit || busy}
        />
      </label>

      <label>
        Chức vụ
        <select
          value={positionId}
          onChange={(e) => setPositionId(Number(e.target.value))}
          disabled={!canEdit || busy}
        >
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </label>

      <JobFunctionPicker
        options={functionOptions}
        value={functions}
        disabled={!canEdit || busy}
        onChange={setFunctions}
      />

      {winPermissionSetsEnabled() ? (
        <PermissionSetPicker
          options={setOptions}
          value={setCodes}
          disabled={!canEdit || busy}
          onChange={setSetCodes}
        />
      ) : null}

      {winScopePilotEnabled() ? (
        <ClientScopePicker
          token={token}
          value={clientIds}
          disabled={!canEdit || busy}
          onChange={setClientIds}
        />
      ) : null}

      {sodViolations.map((v) => (
        <WinSodBanner key={v.id} sodId={v.id} message={v.message} />
      ))}

      <section>
        <p className="muted" style={{ margin: '0 0 0.35rem' }}>
          Team
        </p>
        <div className="win-filter-chips">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip${teamIds.includes(t.id) ? ' is-active' : ''}`}
              disabled={!canEdit || busy}
              onClick={() => toggleTeam(t.id)}
            >
              {t.code}
            </button>
          ))}
        </div>
      </section>

      <details>
        <summary className="muted">Effective caps preview</summary>
        <EffectiveCapsPreview preview={preview} />
      </details>

      <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportJson}>
          Export JSON
        </button>
        {canEdit && user.active ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowOffboard(true)}
              disabled={busy}
            >
              Offboard
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy}>
              Lưu
            </button>
          </>
        ) : null}
      </div>

      {showOffboard ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowOffboard(false)}>
          <div className="modal-card" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Offboard {user.display_name}</h3>
            <p className="muted">Chuyển lead sang NV khác (crm_staff id) rồi deactivate.</p>
            <label>
              NV nhận lead (crm_staff id)
              <input
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                placeholder="VD: 12"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowOffboard(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmOffboard()} disabled={busy}>
                Xác nhận offboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRelogin ? <WinReloginToast /> : null}
    </div>
  );
}
