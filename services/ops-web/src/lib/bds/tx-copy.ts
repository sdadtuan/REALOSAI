export function txGateCopy(message: string): string {
  if (/paid_pct/i.test(message)) return 'Chưa đủ % thu — Công nợ phải ghi phiếu.';
  if (/legal_gate/i.test(message)) return 'Chưa đủ điều kiện bán — Pháp chế bật cổng.';
  return message;
}

export function parseRequiredRowVersion(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const rv = Number(trimmed);
  if (!Number.isInteger(rv) || rv < 0) return null;
  return rv;
}

export function parseContractSubmit(
  contractNo: string,
  rowVersionRaw: string,
): { contract_no: string; row_version: number } | null {
  const contract_no = contractNo.trim();
  const row_version = parseRequiredRowVersion(rowVersionRaw);
  if (!contract_no || row_version === null) return null;
  return { contract_no, row_version };
}
