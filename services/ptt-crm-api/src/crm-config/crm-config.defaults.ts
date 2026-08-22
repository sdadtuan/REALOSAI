import {
  SALES_PIPELINE_LABELS_VI,
  SALES_PIPELINE_STAGES,
  STAGE_OWNER_ROLE,
  STAGE_SLA_HOURS,
  TERMINAL_STAGES,
} from '../sales/sales-pipeline.util';
import type { PipelineStageDef } from './crm-config.types';

export const DEFAULT_SALES_PIPELINE_KEY = 'sales';

export function defaultSalesPipelineStages(): Omit<
  PipelineStageDef,
  'id' | 'pipeline_key' | 'updated_at'
>[] {
  return SALES_PIPELINE_STAGES.map((stageKey, index) => ({
    stage_key: stageKey,
    label: SALES_PIPELINE_LABELS_VI[stageKey] ?? stageKey,
    sort_order: index,
    sla_hours: STAGE_SLA_HOURS[stageKey] ?? 0,
    owner_role: STAGE_OWNER_ROLE[stageKey] ?? '',
    is_terminal: TERMINAL_STAGES.has(stageKey),
    active: true,
  }));
}

export const DEFAULT_LEAD_SOURCES: Array<{ option_key: string; label: string }> = [
  { option_key: 'manual', label: 'Nhập tay' },
  { option_key: 'web', label: 'Website / Landing' },
  { option_key: 'facebook', label: 'Facebook' },
  { option_key: 'zalo', label: 'Zalo' },
  { option_key: 'google', label: 'Google / Ads' },
  { option_key: 'referral', label: 'Giới thiệu (referral)' },
  { option_key: 'walk_in', label: 'Walk-in / Trực tiếp' },
  { option_key: 'phone', label: 'Gọi điện' },
  { option_key: 'email', label: 'Email' },
  { option_key: 'event', label: 'Sự kiện' },
  { option_key: 'partner', label: 'Đối tác' },
  { option_key: 'marketing', label: 'Chiến dịch marketing' },
  { option_key: 'other', label: 'Khác' },
];

export const DEFAULT_LEAD_CHANNELS: Array<{ option_key: string; label: string }> = [
  { option_key: 'phone', label: 'Gọi điện' },
  { option_key: 'walk_in', label: 'Walk-in / Trực tiếp' },
  { option_key: 'zalo', label: 'Zalo' },
  { option_key: 'facebook', label: 'Facebook' },
  { option_key: 'google', label: 'Google Ads' },
  { option_key: 'email', label: 'Email' },
  { option_key: 'website', label: 'Website' },
  { option_key: 'sms', label: 'SMS' },
  { option_key: 'event', label: 'Sự kiện' },
  { option_key: 'partner', label: 'Đối tác' },
  { option_key: 'other', label: 'Khác' },
];
