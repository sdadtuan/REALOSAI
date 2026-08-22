'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  fetchPortalSettings,
  patchPortalSettings,
  type PortalSettingsResponse,
} from '@/lib/api';
import { applyPortalBranding, normalizeAccentColor, PTT_DEFAULT_ACCENT } from '@/lib/portal/branding';
import { SettingsSection } from './SettingsSection';

type BrandingSettingsFormProps = {
  token: string;
  canEdit: boolean;
  onUpdated?: (settings: PortalSettingsResponse) => void;
};

export function BrandingSettingsForm({ token, canEdit, onUpdated }: BrandingSettingsFormProps) {
  const [settings, setSettings] = useState<PortalSettingsResponse | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [amName, setAmName] = useState('');
  const [amEmail, setAmEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchPortalSettings(token)
      .then((data) => {
        setSettings(data);
        setDisplayName(data.display_name ?? '');
        setLogoUrl(data.logo_url ?? '');
        setAccentColor(data.accent_color ?? '');
        setAmName(data.am_contact_name ?? '');
        setAmEmail(data.am_contact_email ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải settings'));
  }, [token]);

  const previewAccent = normalizeAccentColor(accentColor) ?? PTT_DEFAULT_ACCENT;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const out = await patchPortalSettings(token, {
        display_name: displayName.trim(),
        logo_url: logoUrl.trim(),
        accent_color: accentColor.trim() || null,
        am_contact_name: amName.trim(),
        am_contact_email: amEmail.trim(),
      });
      setSettings(out);
      setAccentColor(out.accent_color ?? '');
      applyPortalBranding(out);
      onUpdated?.(out);
      setMessage('Đã lưu cài đặt portal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Branding & liên hệ AM"
      description="Logo, tên hiển thị và màu accent áp dụng trên sidebar và nút CTA."
    >
      {!settings?.table_ready ? (
        <p className="portal-callout portal-callout--warn">
          Bảng <code>portal_client_settings</code> chưa apply — hiển thị tên client mặc định. Chạy DDL
          v3-portal-settings trên PG.
        </p>
      ) : null}
      {!canEdit ? <p className="muted">Chỉ role approver được chỉnh branding.</p> : null}

      <div className="settings-branding-preview" aria-hidden="true">
        <span
          className="settings-branding-preview__swatch"
          style={{ background: previewAccent }}
        />
        <div className="settings-branding-preview__meta">
          <strong>{displayName.trim() || settings?.client_name || 'Client Portal'}</strong>
          <span className="muted">Accent preview · {previewAccent}</span>
        </div>
        {logoUrl.trim() ? (
          <img src={logoUrl.trim()} alt="" className="settings-branding-preview__logo" />
        ) : (
          <span className="portal-sidebar-brand-mark">PTT</span>
        )}
      </div>

      <form className="settings-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="display_name">Tên hiển thị</label>
          <input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        <div className="field">
          <label htmlFor="logo_url">Logo URL</label>
          <input
            id="logo_url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={!canEdit || busy}
            placeholder="https://..."
          />
        </div>
        <div className="field settings-form__accent">
          <label htmlFor="accent_color">Màu accent (hex)</label>
          <div className="settings-form__accent-row">
            <input
              id="accent_color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              disabled={!canEdit || busy}
              placeholder={PTT_DEFAULT_ACCENT}
              spellCheck={false}
            />
            <input
              type="color"
              value={previewAccent}
              disabled={!canEdit || busy}
              onChange={(e) => setAccentColor(e.target.value)}
              aria-label="Chọn màu accent"
              className="settings-form__color-picker"
            />
          </div>
          <p className="muted settings-form__hint">
            Để trống để dùng PTT green mặc định ({PTT_DEFAULT_ACCENT}).
          </p>
        </div>
        <div className="field">
          <label htmlFor="am_name">Tên AM</label>
          <input
            id="am_name"
            value={amName}
            onChange={(e) => setAmName(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        <div className="field">
          <label htmlFor="am_email">Email AM</label>
          <input
            id="am_email"
            type="email"
            value={amEmail}
            onChange={(e) => setAmEmail(e.target.value)}
            disabled={!canEdit || busy}
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="settings-form__success">{message}</p> : null}
        {canEdit ? (
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        ) : null}
      </form>
      <p className="muted settings-form__footnote">
        PDF export performance hiện ở dạng stub — báo cáo đầy đủ sẽ có ở Phase 4.
      </p>
    </SettingsSection>
  );
}
