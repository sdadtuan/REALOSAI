'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { ProductTypeCard } from '@/components/research/ProductTypeCard';
import { RqListEditor, type RqDraft } from '@/components/research/RqListEditor';
import { fetchAgencyClients, staffMe, staffRefresh } from '@/lib/api';
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
  createResearchProject,
  fetchResearchPrefill,
  PRODUCT_TYPE_CARDS,
  type ProductType,
  type ResearchPrefill,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';

const STEPS = ['Khách hàng', 'Loại nghiên cứu', 'Quyết định', 'Phạm vi', 'Câu hỏi'] as const;
const GEO_CHIPS = ['VN', 'HCM', 'HN', 'SEA', 'Global'];

export default function CrmResearchNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState<'CB' | 'TC' | 'CS'>('CB');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [decision, setDecision] = useState('');
  const [geo, setGeo] = useState<string[]>(['VN']);
  const [langEn, setLangEn] = useState(false);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [questions, setQuestions] = useState<RqDraft[]>([{ question_vi: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [prefill, setPrefill] = useState<ResearchPrefill | null>(null);
  const [useIndustry, setUseIndustry] = useState<boolean | null>(null);
  const [competitorChoice, setCompetitorChoice] = useState<Record<string, boolean | null>>({});

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
      if (!hasCap(me, 'crm_research', 'create')) {
        setError('Không có quyền tạo dự án nghiên cứu');
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
    const prefillClient = searchParams.get('client_id')?.trim() ?? '';
    const prefillTitle = searchParams.get('title')?.trim() ?? '';
    if (prefillClient) setClientId(prefillClient);
    if (prefillTitle) setTitle(prefillTitle);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      try {
        const agency = await fetchAgencyClients(access);
        setClients(agency.clients.map((c) => ({ id: c.id, name: c.name })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng');
      }
    })();
  }, [ensureAuth]);

  useEffect(() => {
    if (!clientId.trim() || !isMarketResearchFeEnabled()) {
      setPrefill(null);
      setUseIndustry(null);
      setCompetitorChoice({});
      return;
    }
    const access = getAccessToken();
    if (!access) return;
    let cancelled = false;
    void (async () => {
      try {
        const out = await fetchResearchPrefill(access, clientId);
        if (cancelled) return;
        setPrefill(out);
        setUseIndustry(null);
        const next: Record<string, boolean | null> = {};
        for (const name of out.competitor_names) next[name] = null;
        setCompetitorChoice(next);
      } catch {
        if (!cancelled) {
          setPrefill({ industry: null, competitor_names: [], suggested_rqs: [] });
          setUseIndustry(null);
          setCompetitorChoice({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function toggleGeo(tag: string) {
    setGeo((prev) => (prev.includes(tag) ? prev.filter((g) => g !== tag) : [...prev, tag]));
  }

  function stepError(): string {
    if (step === 0) {
      if (!clientId.trim()) return 'Chọn khách hàng';
      if (title.trim().length < 8) return 'Tiêu đề cần tối thiểu 8 ký tự';
    }
    if (step === 1 && !productType) return 'Chọn một loại nghiên cứu';
    if (step === 2 && decision.trim().length < 20) return 'Quyết định cần tối thiểu 20 ký tự';
    if (step === 4 && !questions.some((q) => q.question_vi.trim())) {
      return 'Cần ít nhất 1 câu hỏi nghiên cứu';
    }
    return '';
  }

  async function onSubmit() {
    const access = getAccessToken();
    if (!access || !productType) return;
    const msg = stepError();
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError('');
    const lifecycleRaw = searchParams.get('lifecycle_id');
    const lifecycleId = lifecycleRaw != null && lifecycleRaw !== '' ? Number(lifecycleRaw) : NaN;
    try {
      const out = await createResearchProject(access, {
        client_id: clientId,
        title: title.trim(),
        product_type: productType,
        dv12_tier: tier,
        decision_statement: decision.trim(),
        geo: geo.length ? geo : ['VN'],
        languages: langEn ? ['vi', 'en'] : ['vi'],
        risk_class: risk,
        lifecycle_id: Number.isFinite(lifecycleId) ? lifecycleId : undefined,
        prefill_competitors: Object.entries(competitorChoice)
          .filter(([, chosen]) => chosen === true)
          .map(([name]) => name),
        questions: questions
          .filter((q) => q.question_vi.trim())
          .map((q, i) => ({
            question_vi: q.question_vi.trim(),
            question_en: q.question_en?.trim() || undefined,
            sort_order: i + 1,
          })),
      });
      router.push(`/crm/research/${out.project.id}?tab=brief`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo dự án thất bại');
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

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: '/crm/research/new', label: 'Tạo project' },
      ]}
    >
      <div className="page-card stack-gap">
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Tạo dự án nghiên cứu</h1>
        <ol style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: 0, listStyle: 'none' }}>
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? '' : 'muted'} style={{ fontWeight: i === step ? 700 : 400 }}>
              ({i + 1}) {label}
              {i < STEPS.length - 1 ? ' →' : ''}
            </li>
          ))}
        </ol>
        {error ? <p className="error">{error}</p> : null}

        {step === 0 ? (
          <div className="stack-gap">
            <label>
              Khách hàng
              <select
                className="kpi-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">Chọn client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tiêu đề
              <input
                className="kpi-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Category review sữa uống 2026 VN"
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend>Gói DV12</legend>
              {(['CB', 'TC', 'CS'] as const).map((t) => (
                <label key={t} style={{ marginRight: 12 }}>
                  <input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)} /> {t}
                </label>
              ))}
              <p className="muted" style={{ marginTop: 6 }}>
                CB = desk 1 shot; TC = + consumer; CS = STP + sizing.
              </p>
            </fieldset>
            {prefill?.industry ? (
              <div>
                <p style={{ margin: '0 0 0.4rem' }}>Gợi ý ngành từ consult: {prefill.industry}</p>
                <button
                  type="button"
                  className={`btn btn-sm ${useIndustry === true ? '' : 'btn-secondary'}`}
                  onClick={() => {
                    setUseIndustry(true);
                    setTitle((prev) => (prev.trim() ? prev : prefill.industry ?? prev));
                  }}
                  style={{ marginRight: 6 }}
                >
                  Dùng gợi ý
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${useIndustry === false ? '' : 'btn-secondary'}`}
                  onClick={() => setUseIndustry(false)}
                >
                  Bỏ
                </button>
              </div>
            ) : null}
            {prefill?.competitor_names.length ? (
              <div className="stack-gap">
                <p style={{ margin: 0 }}>Gợi ý đối thủ từ consult — xác nhận từng dòng</p>
                {prefill.competitor_names.map((name) => (
                  <div key={name}>
                    <span style={{ marginRight: 8 }}>{name}</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${competitorChoice[name] === true ? '' : 'btn-secondary'}`}
                      onClick={() => setCompetitorChoice((prev) => ({ ...prev, [name]: true }))}
                      style={{ marginRight: 6 }}
                    >
                      Dùng gợi ý
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${competitorChoice[name] === false ? '' : 'btn-secondary'}`}
                      onClick={() => setCompetitorChoice((prev) => ({ ...prev, [name]: false }))}
                    >
                      Bỏ
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {PRODUCT_TYPE_CARDS.map((card) => (
              <ProductTypeCard
                key={card.type}
                type={card.type}
                label={card.label}
                subcopy={card.subcopy}
                selected={productType === card.type}
                onSelect={setProductType}
              />
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <label>
            Quyết định kinh doanh
            <textarea
              className="kpi-input"
              rows={5}
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="Quyết định có mở SKU premium Q4 tại MT HCM hay không."
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
            <span className="muted">
              {decision.trim().length}/20 — không viết “làm báo cáo ngành”; viết quyết định kinh doanh.
            </span>
          </label>
        ) : null}

        {step === 3 ? (
          <div className="stack-gap">
            <div>
              <p style={{ margin: '0 0 0.4rem' }}>Địa bàn</p>
              {GEO_CHIPS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`btn btn-sm ${geo.includes(tag) ? '' : 'btn-secondary'}`}
                  onClick={() => toggleGeo(tag)}
                  style={{ marginRight: 6, marginBottom: 6 }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <label>
              <input type="checkbox" checked disabled /> vi (bắt buộc)
            </label>
            <label>
              <input type="checkbox" checked={langEn} onChange={(e) => setLangEn(e.target.checked)} /> en (tuỳ chọn)
            </label>
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend>Rủi ro</legend>
              {(['low', 'medium', 'high'] as const).map((r) => (
                <label key={r} style={{ marginRight: 12 }}>
                  <input type="radio" name="risk" checked={risk === r} onChange={() => setRisk(r)} />{' '}
                  {r === 'low' ? 'Low' : r === 'medium' ? 'Medium' : 'High'}
                </label>
              ))}
            </fieldset>
          </div>
        ) : null}

        {step === 4 ? <RqListEditor items={questions} onChange={setQuestions} disabled={saving} /> : null}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/crm/research" className="btn btn-sm btn-secondary">
            Hủy
          </Link>
          {step > 0 ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Quay lại
            </button>
          ) : null}
          {step < 4 ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const msg = stepError();
                if (msg) {
                  setError(msg);
                  return;
                }
                setError('');
                setStep((s) => s + 1);
              }}
            >
              Tiếp
            </button>
          ) : (
            <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void onSubmit()}>
              {saving ? 'Đang tạo…' : 'Tạo dự án'}
            </button>
          )}
        </div>
      </div>
    </StaffPageShell>
  );
}
