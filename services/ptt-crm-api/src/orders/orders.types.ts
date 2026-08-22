export type OrderStatus = 'draft' | 'confirmed' | 'fulfilled' | 'cancelled';

export interface OrderLineRow {
  id: number;
  order_id: number;
  product_slug: string;
  description: string;
  quantity: number;
  unit_price_vnd: number;
  amount_vnd: number;
  sort_order: number;
}

export interface OrderRow {
  id: number;
  reference_code: string;
  customer_id: number;
  contract_id: number | null;
  proposal_id: number | null;
  lifecycle_id: number | null;
  lead_id: number | null;
  status: OrderStatus;
  order_date: string;
  total_vnd: number;
  billing_type: string;
  notes: string;
  created_at: string;
  updated_at: string;
  lines?: OrderLineRow[];
}

export interface CreateOrderBody {
  customer_id: number;
  contract_id?: number | null;
  proposal_id?: number | null;
  lifecycle_id?: number | null;
  lead_id?: number | null;
  order_date?: string;
  billing_type?: string;
  notes?: string;
  lines?: Array<{
    product_slug?: string;
    description?: string;
    quantity?: number;
    unit_price_vnd?: number;
    amount_vnd?: number;
    sort_order?: number;
  }>;
}

export interface CreateOrderLineBody {
  product_slug?: string;
  description?: string;
  quantity?: number;
  unit_price_vnd?: number;
  amount_vnd?: number;
  sort_order?: number;
}

export interface PatchOrderBody {
  status?: OrderStatus;
  order_date?: string;
  billing_type?: string;
  notes?: string;
  contract_id?: number | null;
  lifecycle_id?: number | null;
}
