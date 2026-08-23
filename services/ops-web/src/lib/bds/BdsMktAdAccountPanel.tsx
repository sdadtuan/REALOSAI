'use client';

import {
  isMetaAdAccountMapped,
  mktLeadFormHint,
  normalizeMetaAdAccountId,
} from './mkt-copy';

export type MktLeadFormRow = {
  form_id: string;
  form_name?: string;
  page_id?: string;
  active?: boolean;
};

export type MktLeadConfig = {
  webhook_url?: string;
  webhook_slug?: string;
  facebook_page_id?: string;
  meta_ad_account_id?: string;
  meta_ad_account_mapped?: boolean;
  webhook_enabled?: boolean;
  forms?: MktLeadFormRow[];
};

type Props = {
  config: MktLeadConfig;
  canEdit: boolean;
  saving: boolean;
  adAccountId: string;
  pageId: string;
  webhookEnabled: boolean;
  formId: string;
  formName: string;
  onAdAccountChange: (value: string) => void;
  onPageIdChange: (value: string) => void;
  onWebhookEnabledChange: (value: boolean) => void;
  onFormIdChange: (value: string) => void;
  onFormNameChange: (value: string) => void;
  onSave: () => void;
};

export function BdsMktAdAccountPanel({
  config,
  canEdit,
  saving,
  adAccountId,
  pageId,
  webhookEnabled,
  formId,
  formName,
  onAdAccountChange,
  onPageIdChange,
  onWebhookEnabledChange,
  onFormIdChange,
  onFormNameChange,
  onSave,
}: Props) {
  const mapped =
    isMetaAdAccountMapped(adAccountId) ||
    Boolean(config.meta_ad_account_mapped);
  const forms = config.forms ?? [];
  const normalizedPreview = normalizeMetaAdAccountId(adAccountId);

  return (
    <section className="bds-mkt-ad-panel" aria-label="Map Meta ad account dự án">
      <h3 className="bds-mkt-ad-panel__title">Meta ads · map ad account</h3>
      <p className="muted bds-mkt-ad-panel__hint">
        MK-02: gắn ad account trước CAPI / form lead. ROAS hub đọc spend khi đã map — không bịa số.
      </p>

      <dl className="bds-mkt-ad-panel__meta">
        <div>
          <dt>Webhook</dt>
          <dd>{config.webhook_url ?? '—'}</dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>{config.webhook_slug ?? '—'}</dd>
        </div>
        <div>
          <dt>Trạng thái map</dt>
          <dd>
            {mapped ? (
              <span className="badge badge-success">Đã gắn ad account</span>
            ) : (
              <span className="badge">Chưa gắn ad account</span>
            )}
          </dd>
        </div>
      </dl>

      {canEdit ? (
        <div className="bds-mkt-ad-panel__form">
          <label>
            Meta ad account (act_*)
            <input
              value={adAccountId}
              onChange={(e) => onAdAccountChange(e.target.value)}
              placeholder="act_1234567890"
              disabled={saving}
            />
            {normalizedPreview && normalizedPreview !== adAccountId.trim() ? (
              <span className="muted">Lưu dạng: {normalizedPreview}</span>
            ) : null}
          </label>
          <label>
            Facebook page ID
            <input
              value={pageId}
              onChange={(e) => onPageIdChange(e.target.value)}
              placeholder="Page ID"
              disabled={saving}
            />
          </label>
          <label className="bds-mkt-ad-panel__check">
            <input
              type="checkbox"
              checked={webhookEnabled}
              disabled={saving || !mapped}
              onChange={(e) => onWebhookEnabledChange(e.target.checked)}
            />
            Bật webhook / form lead
          </label>
          <p className="muted">{mktLeadFormHint(mapped)}</p>

          {mapped ? (
            <div className="bds-mkt-ad-panel__forms-add">
              <label>
                Form ID
                <input
                  value={formId}
                  onChange={(e) => onFormIdChange(e.target.value)}
                  placeholder="Leadgen form ID"
                  disabled={saving}
                />
              </label>
              <label>
                Tên form
                <input
                  value={formName}
                  onChange={(e) => onFormNameChange(e.target.value)}
                  placeholder="Tên hiển thị"
                  disabled={saving}
                />
              </label>
            </div>
          ) : null}

          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={onSave}>
            Lưu cấu hình MKT
          </button>
        </div>
      ) : null}

      {forms.length > 0 ? (
        <div className="bds-mkt-ad-panel__forms">
          <h4>Form đã map</h4>
          <ul>
            {forms.map((f) => (
              <li key={f.form_id}>
                <code>{f.form_id}</code>
                {f.form_name ? ` — ${f.form_name}` : ''}
                {f.active === false ? ' (tắt)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">Chưa có form Meta map cho dự án.</p>
      )}
    </section>
  );
}
