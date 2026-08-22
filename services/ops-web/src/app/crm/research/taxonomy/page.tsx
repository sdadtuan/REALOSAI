'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { TAXONOMY_BANNER, shouldShowTaxonomyNav } from '@/components/research/taxonomy-pane.util';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import {
  createResearchTaxonomy,
  fetchResearchTaxonomy,
  type ResearchTaxonomyTheme,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';

export default function CrmResearchTaxonomyPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [themes, setThemes] = useState<ResearchTaxonomyTheme[]>([]);
  const [themeCode, setThemeCode] = useState('');
  const [labelVi, setLabelVi] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_research', 'view')) {
        setError('Không có quyền xem nghiên cứu thị trường');
        return null;
      }
      if (!hasCap(me, 'crm_research', 'configure')) {
        setError('Không có quyền cấu hình taxonomy');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        setThemes((await fetchResearchTaxonomy(access)).themes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải taxonomy thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function onCreate(e: { preventDefault: () => void }) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const created = await createResearchTaxonomy(access, {
        theme_code: themeCode.trim(),
        label_vi: labelVi.trim(),
        synonyms: synonyms
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setThemes((prev) => [...prev.filter((row) => row.id !== created.id), created].sort((a, b) =>
        a.theme_code.localeCompare(b.theme_code),
      ));
      setThemeCode('');
      setLabelVi('');
      setSynonyms('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm theme thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (!isMarketResearchFeEnabled()) {
    const body = (
      <div className="page-card">
        <p>Module nghiên cứu thị trường chưa bật.</p>
      </div>
    );
    if (!user) return body;
    return (
      <StaffPageShell user={user} onLogout={logout}>
        {body}
      </StaffPageShell>
    );
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  if (!shouldShowTaxonomyNav(hasCap(user, 'crm_research', 'configure'))) {
    return (
      <StaffPageShell
        user={user}
        onLogout={logout}
        breadcrumb={[
          { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        ]}
      >
        <div className="page-card">
          <p>{error || 'Không có quyền cấu hình taxonomy'}</p>
          <Link href="/crm/research" className="btn btn-sm btn-secondary">
            Nghiên cứu thị trường
          </Link>
        </div>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: '/crm/research/taxonomy', label: 'Taxonomy' },
      ]}
    >
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Taxonomy</h1>
          <Link href="/crm/research" className="btn btn-sm btn-secondary">
            Nghiên cứu thị trường
          </Link>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {TAXONOMY_BANNER}
        </p>
        <form
          onSubmit={(e) => void onCreate(e)}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label>
            Code
            <input
              className="kpi-input"
              value={themeCode}
              onChange={(e) => setThemeCode(e.target.value)}
              required
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <label>
            Label
            <input
              className="kpi-input"
              value={labelVi}
              onChange={(e) => setLabelVi(e.target.value)}
              required
              style={{ display: 'block', marginTop: 4 }}
            />
          </label>
          <label style={{ flex: '1 1 12rem' }}>
            Synonyms
            <input
              className="kpi-input"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="pricing, giá bán"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <button type="submit" className="btn btn-sm" disabled={saving}>
            Thêm
          </button>
        </form>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {themes.length ? (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Label</th>
                <th>Synonyms</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => (
                <tr key={theme.id}>
                  <td>
                    <code>{theme.theme_code}</code>
                  </td>
                  <td>{theme.label_vi}</td>
                  <td className="muted">{theme.synonyms.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {themes.length === 0 && !loading ? <p className="muted">Chưa có theme</p> : null}
      </div>
    </StaffPageShell>
  );
}
