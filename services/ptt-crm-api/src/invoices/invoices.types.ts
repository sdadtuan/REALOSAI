export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';

export interface InvoiceLineRow {
  id: number;
  invoice_id: number;
  product_slug: string;
  description: string;
  quantity: number;
  unit_price_vnd: number;
  amount_vnd: number;
  sort_order: number;
}

export interface InvoiceRow {
  id: number;
  invoice_number: string;
  order_id: number | null;
  contract_id: number | null;
  lifecycle_id: number | null;
  customer_id: number;
  status: InvoiceStatus;
  issued_on: string;
  due_on: string;
  amount_vnd: number;
  paid_vnd: number;
  notes: string;
  created_at: string;
  updated_at: string;
  lines?: InvoiceLineRow[];
}

export interface CreateInvoiceBody {
  customer_id: number;
  order_id?: number | null;
  contract_id?: number | null;
  lifecycle_id?: number | null;
  issued_on?: string;
  due_on?: string;
  amount_vnd?: number;
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

export interface PatchInvoiceBody {
  status?: InvoiceStatus;
  issued_on?: string;
  due_on?: string;
  notes?: string;
  contract_id?: number | null;
  lifecycle_id?: number | null;
}

export interface IssueInvoiceBody {
  due_on?: string;
  issued_on?: string;
}
