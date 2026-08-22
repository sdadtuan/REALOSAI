'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { StoredStaffUser } from '@/lib/auth';
import { canApproveContentOs, canAssignContentOs, canGenerateContentOs, canProductionContentOs, canPublishContentOs, canWriteContentOs } from '@/lib/auth';
import { ContentOsAssigneePicker } from '@/components/content-os/ContentOsAssigneePicker';
import { ContentOsAuditPanel } from '@/components/content-os/ContentOsAuditPanel';
import { ContentOsBoardCard } from '@/components/content-os/ContentOsBoardCard';
import { ContentOsCalendarView } from '@/components/content-os/ContentOsCalendarView';
import { ContentOsChannelPickerModal } from '@/components/content-os/ContentOsChannelPickerModal';
import { ContentOsCommentsPanel } from '@/components/content-os/ContentOsCommentsPanel';
import { ContentOsGeneratePanel } from '@/components/content-os/ContentOsGeneratePanel';
import { ContentOsIntelligenceView } from '@/components/content-os/ContentOsIntelligenceView';
import { ContentOsMediaStudio } from '@/components/content-os/ContentOsMediaStudio';
import { ContentOsOverview } from '@/components/content-os/ContentOsOverview';
import { ContentOsPillarsView } from '@/components/content-os/ContentOsPillarsView';
import { ContentOsProductionPanel } from '@/components/content-os/ContentOsProductionPanel';
import { ContentOsRepurposeWizard } from '@/components/content-os/ContentOsRepurposeWizard';
import { ContentOsReviewQueueView } from '@/components/content-os/ContentOsReviewQueueView';
import { ContentOsSnapshotBanner } from '@/components/content-os/ContentOsSnapshotBanner';
import { ContentOsVariantsPicker } from '@/components/content-os/ContentOsVariantsPicker';
import { ContentOsVersionDiff } from '@/components/content-os/ContentOsVersionDiff';
import { InsertInsightContentPanel } from '@/components/research/InsertInsightContentPanel';
import {
  CMKT_P0_PAIRS,
  channelFormatLabel,
  copyCaptionText,
  fetchContentOsContext,
  fetchContentOsIdeas,
  fetchContentOsItem,
  fetchContentOsItemVersions,
  fetchContentOsItems,
  fetchContentOsPillars,
  patchContentOsItem,
  postContentOsApproveItem,
  postContentOsClientApprove,
  postContentOsSubmitClient,
  postContentOsIdea,
  postContentOsIdeasBulkJob,
  postContentOsIdeaConvert,
  postContentOsPublishItem,
  postContentOsSubmitReview,
  parseCmktGateError,
  type ContentOsContext,
  type ContentOsIdea,
  type ContentOsItem,
  type ContentOsItemVersion,
  type ContentOsPillar,
} from '@/lib/content-os-api';
import { boardColumns, type ContentOsSubView } from '@/lib/content-os-status';
import { useContentOsViewParams } from '@/lib/use-content-os-view-params';

type DrawerTab = 'body' | 'variants' | 'versions' | 'comments' | 'production' | 'media';

interface Props {
  token: string;
  user: StoredStaffUser;
  lifecycleId: number;
}

const COLUMN_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'Đang duyệt',
  approved_internal: 'Đã duyệt',
  pending_client: 'Chờ KH',
  client_approved: 'KH OK',
  scheduled: 'Đã lên lịch',
  published: 'Published',
};

export function ContentOsPanel({ token, user, lifecycleId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plannerImportRequested = searchParams.get('import') === 'planner';
  const { view, itemId: drawerItemId, setView, openItem, closeDrawer } = useContentOsViewParams('overview');
  const [ctx, setCtx] = useState<ContentOsContext | null>(null);
  const [ideas, setIdeas] = useState<ContentOsIdea[]>([]);
  const [items, setItems] = useState<ContentOsItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [drawerItem, setDrawerItem] = useState<ContentOsItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('body');
  const [drawerVersions, setDrawerVersions] = useState<ContentOsItemVersion[]>([]);
  const [drawerMarkdown, setDrawerMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [convertPair, setConvertPair] = useState('facebook|social_post');
  const [boardMineOnly, setBoardMineOnly] = useState(false);
  const [pillars, setPillars] = useState<ContentOsPillar[]>([]);
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);
  const [importTrigger, setImportTrigger] = useState(0);

  const [publishUrl, setPublishUrl] = useState('');

  const canWrite = canWriteContentOs(user);
  const canGenerate = canGenerateContentOs(user);
  const canApprove = canApproveContentOs(user);
  const canPublish = canPublishContentOs(user);
  const canProduction = canProductionContentOs(user);
  const canAssign = canAssignContentOs(user);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [context, ideasRes, itemsRes, pillarsRes] = await Promise.all([
        fetchContentOsContext(token, lifecycleId),
        fetchContentOsIdeas(token, lifecycleId),
        fetchContentOsItems(token, lifecycleId, boardMineOnly ? { assignee: 'me' } : undefined),
        fetchContentOsPillars(token, lifecycleId),
      ]);
      setCtx(context);
      setIdeas(ideasRes.ideas);
      setItems(itemsRes.items);
      setPillars(pillarsRes.pillars);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải Content Board thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, boardMineOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (drawerItemId == null) {
      setDrawerItem(null);
      setDrawerVersions([]);
      return;
    }
    void (async () => {
      try {
        const [item, versionsRes] = await Promise.all([
          fetchContentOsItem(token, lifecycleId, drawerItemId),
          fetchContentOsItemVersions(token, lifecycleId, drawerItemId),
        ]);
        setDrawerItem(item);
        setDrawerMarkdown(String(item.body_json?.markdown ?? ''));
        setDrawerVersions(versionsRes.versions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải item thất bại');
      }
    })();
  }, [drawerItemId, token, lifecycleId]);

  async function refreshDrawerItem() {
    if (drawerItemId == null) return;
    const [item, versionsRes] = await Promise.all([
      fetchContentOsItem(token, lifecycleId, drawerItemId),
      fetchContentOsItemVersions(token, lifecycleId, drawerItemId),
    ]);
    setDrawerItem(item);
    setDrawerMarkdown(String(item.body_json?.markdown ?? ''));
    setDrawerVersions(versionsRes.versions);
    await reload();
  }

  async function onCreateIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !newIdeaTitle.trim()) return;
    setSaving(true);
    setError('');
    try {
      await postContentOsIdea(token, lifecycleId, { title: newIdeaTitle.trim() });
      setNewIdeaTitle('');
      setMessage('Đã tạo idea');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo idea thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onConvertIdea(ideaId: number) {
    if (!canWrite) return;
    const [channel, format] = convertPair.split('|');
    setSaving(true);
    setError('');
    try {
      const out = await postContentOsIdeaConvert(token, lifecycleId, ideaId, { channel, format });
      setMessage(`Đã convert → item #${out.item.id}`);
      await reload();
      openItem(out.item.id, 'board');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Convert thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveItemBody() {
    if (!canWrite || drawerItemId == null) return;
    setSaving(true);
    setError('');
    try {
      await patchContentOsItem(token, lifecycleId, drawerItemId, {
        body_json: { markdown: drawerMarkdown, html: '', variants: drawerItem?.body_json?.variants ?? [] },
      });
      setMessage('Đã lưu nội dung');
      await refreshDrawerItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitReview() {
    if (!canWrite || drawerItemId == null) return;
    setSaving(true);
    setError('');
    try {
      await postContentOsSubmitReview(token, lifecycleId, drawerItemId);
      setMessage('Đã submit review');
      await refreshDrawerItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit review thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onPublishItem() {
    if (!canPublish || drawerItemId == null) return;
    setSaving(true);
    setError('');
    try {
      await postContentOsPublishItem(token, lifecycleId, drawerItemId, {
        published_url: publishUrl.trim() || undefined,
      });
      setMessage('Đã mark published');
      await refreshDrawerItem();
    } catch (err) {
      setError(parseCmktGateError(err));
    } finally {
      setSaving(false);
    }
  }

  function onCopyCaption() {
    if (!drawerItem) return;
    const text = copyCaptionText(drawerItem);
    void navigator.clipboard.writeText(text).then(
      () => setMessage('Đã copy caption'),
      () => setError('Copy clipboard thất bại'),
    );
  }

  const reviewBadge = ctx?.counts.in_review ?? 0;
  const slaBreach = ctx?.counts.in_review_sla_breach ?? 0;
  const hasAppliedPlan = Boolean(ctx?.snapshot?.marketing_plan_id);

  const reviewTabLabel =
    reviewBadge > 0
      ? `Review (${reviewBadge})${slaBreach > 0 ? ' ⚠' : ''}`
      : 'Review';

  const clearPlannerImportParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('import');
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <ContentOsSnapshotBanner
        token={token}
        lifecycleId={lifecycleId}
        ctx={ctx}
        canWrite={canWrite}
        plannerImportRequested={plannerImportRequested}
        importRequestToken={importTrigger}
        onPlannerImportHandled={clearPlannerImportParam}
        onChanged={reload}
        onMessage={setMessage}
        onError={setError}
      />

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {(
          [
            ['overview', 'Tổng quan'],
            ['ideas', 'Ideas'],
            ['pillars', 'Pillars'],
            ['board', 'Board'],
            ['review', reviewTabLabel],
            ['calendar', 'Calendar'],
            ['repurpose', 'Repurpose'],
            ['audit', 'Audit'],
            ['intelligence', 'Intelligence'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={view === v ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
            onClick={() => setView(v as ContentOsSubView)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="muted">Đang tải Content Board…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}

      {view === 'overview' && ctx ? (
        <ContentOsOverview
          ctx={ctx}
          pillars={pillars}
          items={items}
          canWrite={canWrite}
          hasAppliedPlan={hasAppliedPlan}
          onOpenCreateItem={() => setChannelPickerOpen(true)}
          onImportPlanner={() => setImportTrigger((n) => n + 1)}
          onOpenReview={() => setView('review')}
        />
      ) : null}

      {view === 'ideas' ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {canGenerate ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setError('');
                  try {
                    const job = await postContentOsIdeasBulkJob(token, lifecycleId, { idea_count: 30 });
                    if (job.status === 'failed') {
                      setError(job.error_text ?? 'AI ideas job failed');
                    } else {
                      setMessage('Đã generate 30 ideas tháng');
                      await reload();
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'AI 30 ideas thất bại');
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              AI 30 ideas tháng
            </button>
          ) : null}
          {canWrite ? (
            <form onSubmit={(e) => void onCreateIdea(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={newIdeaTitle}
                onChange={(e) => setNewIdeaTitle(e.target.value)}
                placeholder="Tiêu đề idea mới"
                style={{
                  flex: 1,
                  minWidth: 200,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.45rem 0.65rem',
                  color: 'var(--text)',
                }}
              />
              <button type="submit" className="btn btn-sm" disabled={saving || !newIdeaTitle.trim()}>
                Thêm idea
              </button>
            </form>
          ) : (
            <p className="muted">Chỉ xem — cần quyền crm_content.write</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {ideas.map((idea) => (
              <li
                key={idea.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.65rem 0.75rem',
                }}
              >
                <strong>{idea.title}</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {idea.status} · {idea.hook || '—'}
                </div>
                {canWrite && idea.status !== 'converted' ? (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={convertPair}
                      onChange={(e) => setConvertPair(e.target.value)}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.35rem',
                        color: 'var(--text)',
                      }}
                    >
                      {CMKT_P0_PAIRS.map((p) => (
                        <option key={`${p.channel}|${p.format}`} value={`${p.channel}|${p.format}`}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={saving}
                      onClick={() => void onConvertIdea(idea.id)}
                    >
                      Convert → item
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {!ideas.length && !loading ? <p className="muted">Chưa có idea — thêm thủ công hoặc import Planner (M2).</p> : null}
        </div>
      ) : null}

      {view === 'board' ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={boardMineOnly}
                onChange={(e) => {
                  setBoardMineOnly(e.target.checked);
                }}
              />
              Chỉ của tôi (assignee SP)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {boardColumns(Boolean(ctx?.flags.client_gate)).map((col) => (
            <div key={col} style={{ minWidth: 200, flex: '0 0 200px' }}>
              <div className="muted" style={{ marginBottom: '0.35rem', fontWeight: 600 }}>
                {COLUMN_LABELS[col] ?? col} ({items.filter((i) => i.status === col).length})
              </div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {items
                  .filter((i) => i.status === col)
                  .map((item) => (
                    <ContentOsBoardCard
                      key={item.id}
                      item={item}
                      onClick={() => openItem(item.id, 'board')}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
        </div>
      ) : null}

      {view === 'review' ? (
        <ContentOsReviewQueueView
          token={token}
          lifecycleId={lifecycleId}
          canApprove={canApprove}
          onOpenItem={(id) => {
            openItem(id, 'review');
            setDrawerTab(canApprove ? 'versions' : 'body');
          }}
          onChanged={reload}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {view === 'calendar' ? (
        <ContentOsCalendarView
          token={token}
          lifecycleId={lifecycleId}
          canWrite={canWrite}
          onOpenItem={(id) => {
            openItem(id, 'calendar');
            setDrawerTab('body');
          }}
          onChanged={reload}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {view === 'repurpose' ? (
        <ContentOsRepurposeWizard
          token={token}
          lifecycleId={lifecycleId}
          canGenerate={canGenerate}
          onOpenItem={(id) => {
            openItem(id, 'repurpose');
            setDrawerTab('body');
          }}
          onDone={reload}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {view === 'audit' ? (
        <ContentOsAuditPanel token={token} lifecycleId={lifecycleId} />
      ) : null}

      {view === 'pillars' ? (
        <ContentOsPillarsView
          token={token}
          lifecycleId={lifecycleId}
          canWrite={canWrite}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {view === 'intelligence' ? (
        <ContentOsIntelligenceView
          token={token}
          lifecycleId={lifecycleId}
          canWrite={canWrite || canApprove}
          canGenerate={canGenerate}
          onMessage={setMessage}
          onError={setError}
        />
      ) : null}

      {drawerItemId != null ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => closeDrawer()}
        >
          <div
            style={{
              width: 'min(720px, 95vw)',
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              padding: '1rem',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{drawerItem?.title ?? `Item #${drawerItemId}`}</h3>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => closeDrawer()}>
                Đóng
              </button>
            </div>
            {drawerItem ? (
              <>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  {channelFormatLabel(drawerItem.channel, drawerItem.format)} · {drawerItem.status}
                </p>
                {drawerItem.status === 'pending_client' ? (
                  <p
                    style={{
                      margin: '0.35rem 0 0',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 8,
                      background: 'color-mix(in srgb, var(--warning, #e6a700) 15%, transparent)',
                      fontSize: '0.85rem',
                    }}
                  >
                    Chờ KH duyệt — client sẽ thấy trên Portal khi bật PTT_CMKT_PORTAL_SUMMARY.
                  </p>
                ) : null}
                <ContentOsAssigneePicker
                  token={token}
                  lifecycleId={lifecycleId}
                  item={drawerItem}
                  canAssign={canAssign}
                  onChanged={refreshDrawerItem}
                  onMessage={setMessage}
                  onError={setError}
                />
                {drawerItem.status !== 'published' && drawerItem.status !== 'archived' ? (
                  <InsertInsightContentPanel
                    itemId={drawerItem.id}
                    lifecycleClientId={ctx?.email_client_id ?? ''}
                    briefJson={drawerItem.brief_json}
                    user={user}
                    onInserted={() => {
                      void refreshDrawerItem();
                    }}
                  />
                ) : null}
              </>
            ) : null}

            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {(['body', 'variants', 'versions', 'comments', 'production', 'media'] as DrawerTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={drawerTab === tab ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  onClick={() => setDrawerTab(tab)}
                >
                  {tab === 'body'
                    ? 'Body'
                    : tab === 'variants'
                      ? 'Variants'
                      : tab === 'versions'
                        ? 'Versions'
                        : tab === 'comments'
                          ? 'Comments'
                          : tab === 'production'
                            ? 'Production'
                            : 'Media AI'}
                </button>
              ))}
            </div>

            {drawerTab === 'body' && drawerItemId != null ? (
              <>
                <div style={{ marginTop: '0.65rem' }}>
                  <ContentOsGeneratePanel
                    token={token}
                    lifecycleId={lifecycleId}
                    itemId={drawerItemId}
                    item={drawerItem}
                    aiEnabled={Boolean(ctx?.flags.ai_enabled)}
                    canGenerate={canGenerate}
                    canWrite={canWrite}
                    piiConsent={Boolean(ctx?.flags.pii_consent)}
                    onJobDone={refreshDrawerItem}
                    onMessage={setMessage}
                    onError={setError}
                  />
                </div>
                <label style={{ display: 'grid', gap: '0.35rem', marginTop: '0.75rem' }}>
                  <span className="muted">Nội dung (markdown)</span>
                  <textarea
                    value={drawerMarkdown}
                    onChange={(e) => setDrawerMarkdown(e.target.value)}
                    rows={14}
                    disabled={!canWrite || saving}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.55rem',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
                {canWrite ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ marginTop: '0.65rem' }}
                    disabled={saving}
                    onClick={() => void onSaveItemBody()}
                  >
                    Lưu nội dung
                  </button>
                ) : null}
              </>
            ) : null}

            {drawerTab === 'variants' && drawerItem && drawerItemId != null ? (
              <div style={{ marginTop: '0.75rem' }}>
                <ContentOsVariantsPicker
                  token={token}
                  lifecycleId={lifecycleId}
                  itemId={drawerItemId}
                  variants={drawerItem.body_json?.variants ?? []}
                  selectedIdx={drawerItem.selected_variant_idx}
                  canWrite={canWrite}
                  onApplied={refreshDrawerItem}
                  onMessage={setMessage}
                  onError={setError}
                />
              </div>
            ) : null}

            {drawerTab === 'versions' ? (
              <>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    marginTop: '0.75rem',
                    display: 'grid',
                    gap: '0.45rem',
                  }}
                >
                  {drawerVersions.map((v) => (
                    <li
                      key={v.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '0.55rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <strong>v{v.version_no}</strong> · {v.change_reason} · {v.changed_by}
                      <div className="muted" style={{ fontSize: '0.78rem' }}>
                        {new Date(v.created_at).toLocaleString('vi-VN')}
                        {v.ai_run_id ? ` · ai_run ${v.ai_run_id.slice(0, 8)}` : ''}
                      </div>
                    </li>
                  ))}
                  {!drawerVersions.length ? <li className="muted">Chưa có version history.</li> : null}
                </ul>
                {drawerItemId != null ? (
                  <ContentOsVersionDiff
                    token={token}
                    lifecycleId={lifecycleId}
                    itemId={drawerItemId}
                    versions={drawerVersions}
                    onError={setError}
                  />
                ) : null}
              </>
            ) : null}

            {drawerTab === 'comments' && drawerItemId != null ? (
              <ContentOsCommentsPanel
                token={token}
                lifecycleId={lifecycleId}
                itemId={drawerItemId}
                canWrite={canWrite}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {drawerTab === 'production' && drawerItem ? (
              <ContentOsProductionPanel
                token={token}
                lifecycleId={lifecycleId}
                item={drawerItem}
                canWrite={canWrite}
                canProduction={canProduction}
                emailClientId={ctx?.email_client_id}
                emailClientLinked={ctx?.email_client_linked}
                onChanged={refreshDrawerItem}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {drawerTab === 'media' && drawerItem ? (
              <ContentOsMediaStudio
                token={token}
                lifecycleId={lifecycleId}
                item={drawerItem}
                mediaEnabled={Boolean(ctx?.flags.media_enabled)}
                imageGenEnabled={Boolean(ctx?.flags.image_gen_enabled)}
                videoGenEnabled={Boolean(ctx?.flags.video_gen_enabled)}
                canGenerate={canGenerate}
                canWrite={canWrite}
                canApprove={canApprove}
                canProduction={canProduction}
                onChanged={refreshDrawerItem}
                onMessage={setMessage}
                onError={setError}
              />
            ) : null}

            {drawerItem ? (
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.75rem',
                  display: 'grid',
                  gap: '0.5rem',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>Workflow</strong>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {canWrite &&
                  (drawerItem.status === 'draft' || drawerItem.status === 'changes_requested') ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={saving}
                      onClick={() => void onSubmitReview()}
                    >
                      Submit review
                    </button>
                  ) : null}
                  {canApprove && drawerItem.status === 'in_review' ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={saving}
                      onClick={async () => {
                        if (drawerItemId == null) return;
                        setSaving(true);
                        try {
                          await postContentOsApproveItem(token, lifecycleId, drawerItemId);
                          setMessage('Đã duyệt');
                          await refreshDrawerItem();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Duyệt thất bại');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Duyệt
                    </button>
                  ) : null}
                  {canWrite &&
                  ctx?.flags.client_gate &&
                  drawerItem.status === 'approved_internal' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={saving}
                      onClick={async () => {
                        if (drawerItemId == null) return;
                        setSaving(true);
                        try {
                          await postContentOsSubmitClient(token, lifecycleId, drawerItemId);
                          setMessage('Đã gửi KH duyệt');
                          await refreshDrawerItem();
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Gửi KH thất bại');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Gửi KH duyệt
                    </button>
                  ) : null}
                  {canApprove &&
                  ctx?.flags.client_gate &&
                  drawerItem.status === 'pending_client' ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={saving}
                      onClick={async () => {
                        if (drawerItemId == null) return;
                        setSaving(true);
                        try {
                          await postContentOsClientApprove(token, lifecycleId, drawerItemId);
                          setMessage('Đã ghi nhận KH duyệt (staff simulate)');
                          await refreshDrawerItem();
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Client approve thất bại');
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Simulate KH duyệt
                    </button>
                  ) : null}
                  {['facebook', 'linkedin'].includes(drawerItem.channel) ? (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={onCopyCaption}>
                      Copy caption
                    </button>
                  ) : null}
                  {canPublish &&
                  (ctx?.flags.client_gate
                    ? drawerItem.status === 'scheduled'
                    : drawerItem.status === 'approved_internal' || drawerItem.status === 'scheduled') ? (
                    <>
                      <input
                        value={publishUrl}
                        onChange={(e) => setPublishUrl(e.target.value)}
                        placeholder="Published URL (optional)"
                        style={{
                          flex: 1,
                          minWidth: 180,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '0.35rem 0.5rem',
                          color: 'var(--text)',
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        disabled={saving}
                        onClick={() => void onPublishItem()}
                      >
                        Mark published
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ContentOsChannelPickerModal
        open={channelPickerOpen}
        token={token}
        lifecycleId={lifecycleId}
        pillars={pillars}
        onClose={() => setChannelPickerOpen(false)}
        onCreated={(itemId) => {
          setMessage(`Đã tạo item #${itemId}`);
          void reload();
          openItem(itemId, 'board');
        }}
        onError={setError}
      />
    </div>
  );
}
