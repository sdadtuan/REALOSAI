/** WIN program feature flags (see competitive-win-implementation-plan §12.2). */

export function winPwaEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_WIN_PWA === '0') return false;
  if (process.env.NEXT_PUBLIC_PWA_ENABLED === '0') return false;
  return true;
}

export function winOrgUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_ORG_UI === '1';
}

export function winKpiSolutionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_KPI_SOLUTION === '1';
}

export function winPermissionSetsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_PERMISSION_SETS === '1';
}

export function winSimulatorEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_SIMULATOR === '1';
}

export function winBreakGlassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_BREAK_GLASS === '1';
}

export function winScopePilotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_SCOPE_PILOT === '1';
}

export function winSsoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_SSO === '1';
}

export function winFieldAbacEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_FIELD_ABAC === '1';
}

export function winPolicyOpaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_POLICY_OPA === '1';
}

export function winCplDigestEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_CPL_DIGEST === '1';
}

export function winPayslipPortalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_PAYSLIP_PORTAL === '1';
}

export function winLeaveLiteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_LEAVE_LITE === '1';
}

export function winMultiEntityEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIN_MULTI_ENTITY === '1';
}
