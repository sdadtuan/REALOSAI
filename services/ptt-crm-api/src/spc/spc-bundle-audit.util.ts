import { resolveQuotePriceFromPricingModel } from './spc-quote-pricing.util';
import type { SpcPricingModel } from './spc.types';

export type SpcBundlePriceAuditStatus =
  | 'ok'
  | 'warn_below_floor'
  | 'warn_above_ceiling'
  | 'no_components';

export type SpcBundlePriceAuditItem = {
  component_code: string;
  name_vi: string;
  qty: number;
  min_vnd: number;
  max_vnd: number;
};

export type SpcBundlePriceAudit = {
  sku_code: string;
  offer_min_vnd: number;
  offer_max_vnd: number;
  components_min_sum_vnd: number;
  components_max_sum_vnd: number;
  delta_min_vnd: number;
  delta_max_vnd: number;
  status: SpcBundlePriceAuditStatus;
  message_vi: string;
  items: SpcBundlePriceAuditItem[];
};

export function auditBundlePrice(
  skuCode: string,
  offerPricing: SpcPricingModel | Record<string, unknown>,
  items: Array<{
    component_code: string;
    name_vi?: string;
    included?: boolean;
    qty?: number;
    pricing_model?: SpcPricingModel | Record<string, unknown>;
  }>,
): SpcBundlePriceAudit {
  const sku = String(skuCode ?? '').trim().toUpperCase();
  const included = (items ?? []).filter((item) => item.included !== false);
  let componentsMinSum = 0;
  let componentsMaxSum = 0;
  const lineItems: SpcBundlePriceAuditItem[] = included.map((item) => {
    const ref = resolveQuotePriceFromPricingModel(item.pricing_model ?? {});
    const qty = Math.max(1, Number(item.qty ?? 1));
    componentsMinSum += ref.min_vnd * qty;
    componentsMaxSum += ref.max_vnd * qty;
    return {
      component_code: String(item.component_code ?? ''),
      name_vi: String(item.name_vi ?? item.component_code ?? ''),
      qty,
      min_vnd: ref.min_vnd,
      max_vnd: ref.max_vnd,
    };
  });

  const offer = resolveQuotePriceFromPricingModel(offerPricing);
  let status: SpcBundlePriceAuditStatus = 'ok';
  let messageVi = 'Giá gói nằm trong band tổng component.';

  if (!lineItems.length) {
    status = 'no_components';
    messageVi = 'Gói chưa gắn component — không so sánh được.';
  } else if (offer.max_vnd < componentsMinSum) {
    status = 'warn_below_floor';
    messageVi = 'Giá gói (max) thấp hơn tổng min component — có thể là bundle discount.';
  } else if (offer.min_vnd > componentsMaxSum) {
    status = 'warn_above_ceiling';
    messageVi = 'Giá gói (min) cao hơn tổng max component.';
  }

  return {
    sku_code: sku,
    offer_min_vnd: offer.min_vnd,
    offer_max_vnd: offer.max_vnd,
    components_min_sum_vnd: componentsMinSum,
    components_max_sum_vnd: componentsMaxSum,
    delta_min_vnd: offer.min_vnd - componentsMinSum,
    delta_max_vnd: offer.max_vnd - componentsMaxSum,
    status,
    message_vi: messageVi,
    items: lineItems,
  };
}
