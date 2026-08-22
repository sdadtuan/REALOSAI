import {
  PortalReportChannelKpi,
  PortalReportSummaryInput,
  PortalReportSummarySnapshot,
} from './portal-ai-report.types';

const CHANNEL_LABEL: Record<PortalReportChannelKpi['channel'], string> = {
  meta: 'Meta',
  google: 'Google',
  zalo: 'Zalo',
};

function formatVndShort(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 VND';
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ VND`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu VND`;
  }
  return `${Math.round(value).toLocaleString('vi-VN')} VND`;
}

function formatCpl(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'chưa tính được';
  }
  return formatVndShort(value);
}

function formatRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'chưa đủ dữ liệu';
  }
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}x`;
}

function topChannel(channels: PortalReportChannelKpi[]): PortalReportChannelKpi | null {
  if (channels.length === 0) {
    return null;
  }
  return [...channels].sort((a, b) => b.spend - a.spend)[0] ?? null;
}

export function buildPortalReportSummary(input: PortalReportSummaryInput): PortalReportSummarySnapshot {
  const { period, kpis, channels } = input;
  const bullets: string[] = [];

  if (kpis.total_spend <= 0 && kpis.total_leads_crm <= 0) {
    return {
      narrative: `Trong ${period.label}, hệ thống chưa ghi nhận chi phí quảng cáo hoặc lead CRM. Vui lòng kiểm tra đồng bộ dữ liệu hoặc liên hệ account manager nếu đã chạy chiến dịch.`,
      bullets: ['Chưa có dữ liệu performance trong kỳ đã chọn.'],
    };
  }

  const sentence1 = `Trong ${period.label}, tổng chi phí quảng cáo đạt ${formatVndShort(kpis.total_spend)} với ${kpis.total_leads_crm.toLocaleString('vi-VN')} lead CRM trên ${kpis.campaigns_tracked.toLocaleString('vi-VN')} chiến dịch theo dõi.`;

  let sentence2 = `CPL trung bình ${formatCpl(kpis.avg_cpl)}`;
  if (kpis.over_target_rows > 0) {
    sentence2 += `; có ${kpis.over_target_rows.toLocaleString('vi-VN')} dòng vượt target CPL`;
  } else {
    sentence2 += '; không có dòng vượt target CPL trong kỳ';
  }
  sentence2 += '.';

  let sentence3 = `ROAS ước tính ${formatRoas(kpis.avg_roas)}`;
  if (kpis.unmapped_spend_pct > 0) {
    sentence3 += `; ${kpis.unmapped_spend_pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% chi phí chưa map đủ attribution`;
  }
  sentence3 += '.';

  const leadChannel = [...channels].sort((a, b) => b.leads_crm - a.leads_crm)[0];
  if (leadChannel && leadChannel.leads_crm > 0) {
    bullets.push(
      `${CHANNEL_LABEL[leadChannel.channel]} đóng góp nhiều lead nhất (${leadChannel.leads_crm.toLocaleString('vi-VN')} lead).`,
    );
  }

  const spendLeader = topChannel(channels);
  if (spendLeader && spendLeader.spend > 0) {
    bullets.push(
      `Chi tiêu lớn nhất tại ${CHANNEL_LABEL[spendLeader.channel]} (${formatVndShort(spendLeader.spend)}).`,
    );
  }

  if (kpis.over_target_rows > 0) {
    bullets.push(`${kpis.over_target_rows.toLocaleString('vi-VN')} dòng cần theo dõi vì CPL vượt target.`);
  } else if (kpis.total_leads_crm > 0) {
    bullets.push('CPL trong kỳ nằm trong target đã cấu hình.');
  }

  if (kpis.unmapped_spend_pct >= 10) {
    bullets.push('Nên rà soát mapping chiến dịch để giảm chi phí chưa gán attribution.');
  }

  return {
    narrative: [sentence1, sentence2, sentence3].join(' '),
    bullets: bullets.slice(0, 5),
  };
}
