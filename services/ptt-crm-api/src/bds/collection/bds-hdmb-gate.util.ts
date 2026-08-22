import { BadRequestException } from '@nestjs/common';
import { isLegalDocValid, type LegalGateDoc } from '../project-os/bds-legal-gate.util';

export type HdmbGateInput = {
  docs: LegalGateDoc[];
  now: Date;
  buyerWaiveGuarantee?: boolean;
  waiveFileId?: string;
};

function docOfType(docs: LegalGateDoc[], docType: string): LegalGateDoc | undefined {
  return docs.find((d) => d.doc_type === docType);
}

export function assertHdmbLegalGate(input: HdmbGateInput): void {
  const { docs, now, buyerWaiveGuarantee, waiveFileId } = input;

  const soXd = docOfType(docs, 'so_xd_du_dieu_kien_ban');
  if (!soXd || !isLegalDocValid(soXd, now)) {
    throw new BadRequestException({ error: 'legal_gate_hdmb' });
  }

  const baoLanh = docOfType(docs, 'bao_lanh_nh');
  const baoLanhOk = baoLanh != null && isLegalDocValid(baoLanh, now);
  const waiveOk =
    buyerWaiveGuarantee === true && String(waiveFileId ?? '').trim().length >= 1;
  if (!baoLanhOk && !waiveOk) {
    throw new BadRequestException({ error: 'legal_gate_hdmb' });
  }

  const giaiChap = docOfType(docs, 'giai_chap');
  if (giaiChap != null && !isLegalDocValid(giaiChap, now)) {
    throw new BadRequestException({ error: 'legal_gate_hdmb' });
  }

  const mauHdmb = docOfType(docs, 'mau_hdmb');
  if (!mauHdmb || !isLegalDocValid(mauHdmb, now)) {
    throw new BadRequestException({ error: 'legal_gate_hdmb' });
  }
}

export function assertHdmbPaidPct(paidPct: number, minPct: number): void {
  if (paidPct + 1e-9 < minPct) {
    throw new BadRequestException({ error: 'paid_pct' });
  }
}

export function evaluateHdmbLegalGate(input: HdmbGateInput): {
  so_xd: boolean;
  bao_lanh: boolean;
  giai_chap: boolean;
  mau_hdmb: boolean;
  ready: boolean;
} {
  const { docs, now, buyerWaiveGuarantee, waiveFileId } = input;
  const soXd = docOfType(docs, 'so_xd_du_dieu_kien_ban');
  const baoLanh = docOfType(docs, 'bao_lanh_nh');
  const giaiChap = docOfType(docs, 'giai_chap');
  const mauHdmb = docOfType(docs, 'mau_hdmb');

  const soXdOk = soXd != null && isLegalDocValid(soXd, now);
  const baoLanhOk =
    (baoLanh != null && isLegalDocValid(baoLanh, now)) ||
    (buyerWaiveGuarantee === true && String(waiveFileId ?? '').trim().length >= 1);
  const giaiChapOk = giaiChap == null || isLegalDocValid(giaiChap, now);
  const mauHdmbOk = mauHdmb != null && isLegalDocValid(mauHdmb, now);

  const ready = soXdOk && baoLanhOk && giaiChapOk && mauHdmbOk;
  return {
    so_xd: soXdOk,
    bao_lanh: baoLanhOk,
    giai_chap: giaiChapOk,
    mau_hdmb: mauHdmbOk,
    ready,
  };
}
