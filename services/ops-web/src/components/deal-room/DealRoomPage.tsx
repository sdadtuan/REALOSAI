'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { StaffPageShell } from '@/components/layout';
import { DealRoomConsultPanel } from '@/components/deal-room/DealRoomConsultPanel';
import { DealRoomGateStrip } from '@/components/deal-room/DealRoomGateStrip';
import { DealRoomL1Panel } from '@/components/deal-room/DealRoomL1Panel';
import { DealRoomQuotePanel } from '@/components/deal-room/DealRoomQuotePanel';
import { DealRoomSciPanel } from '@/components/deal-room/DealRoomSciPanel';
import { DealRoomTeaserPanel } from '@/components/deal-room/DealRoomTeaserPanel';
import { PresalesConsultSlaBanner } from '@/components/PresalesConsultSlaBanner';
import { fetchLeadDealRoom, staffMe, staffRefresh, type DealRoomSnapshot } from '@/lib/api';
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
import { sciBlocksQuoteForUser, blockingRedFlags } from '@/lib/lmp-red-flag-block.util';
import { presalesStageLabel } from '@/lib/crm/lead-consult-tab.util';
import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  leadId: number;
}

export function DealRoomPage({ leadId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gateBlockedBanner = searchParams.get('gate_blocked') === '1';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [snapshot, setSnapshot] = useState<DealRoomSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const snap = await fetchLeadDealRoom(access, leadId);
        setSnapshot(snap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Deal Room thất bại');
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    void (async () => {
      let access = getAccessToken();
      if (!access) {
        router.replace('/login');
        return;
      }
      const cached = getStoredUser();
      if (cached) setUser(cached);
      try {
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'crm_leads', 'view')) {
          setError('Không có quyền xem CRM leads');
          setLoading(false);
          return;
        }
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
      }
      await load(access);
    })();
  }, [leadId, load, router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  const presales = snapshot?.presales;
  const solutionName = presales?.handoff?.solution_owner_name?.trim() || '—';
  const serviceSlug = presales?.presales.service_slug ?? '—';
  const stageLabel = presales ? presalesStageLabel(presales.presales.stage) : '—';
  const isGdkd = hasCap(user, 'crm_leads', 'assign');
  const sciBlock = sciBlocksQuoteForUser(snapshot?.sci.red_flags, isGdkd);
  const hasSciBlockFlags = blockingRedFlags(snapshot?.sci.red_flags).length > 0;
  const quoteCanCreate = Boolean(snapshot?.quote.can_create) && !sciBlock.blocked;
  const quoteBlockReason =
    (!snapshot?.quote.can_create ? snapshot?.quote.block_reason : '') ||
    sciBlock.reason ||
    snapshot?.quote.sci_red_flag_block?.reason ||
    '';

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="full"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Leads', href: '/crm/leads' },
        { label: snapshot?.lead_name ?? `#${leadId}`, href: `/crm/leads/${leadId}` },
        { label: 'Deal Room' },
      ]}
    >
      <div className="deal-room-page">
        <header className="deal-room-header">
          <div>
            <p className="deal-room-header__eyebrow">Deal Room · Sprint 0</p>
            <h1 className="deal-room-header__title">{snapshot?.lead_name ?? `Lead #${leadId}`}</h1>
            <p className="deal-room-header__meta muted">
              {serviceSlug} · {stageLabel}
              {snapshot?.owner_name ? ` · AM: ${snapshot.owner_name}` : ''}
              {solutionName !== '—' ? ` · Solution: ${solutionName}` : ''}
            </p>
          </div>
          <Link href={`/crm/leads/${leadId}`} className="btn btn-sm btn-secondary">
            ← Lead detail
          </Link>
        </header>

        {loading ? <p className="muted">Đang tải Deal Room…</p> : null}
        {error ? (
          <div className="lead-alert lead-alert--error" role="alert">
            {error}
            {!snapshot ? (
              <p style={{ marginTop: '0.5rem' }}>
                <Link href={`/crm/leads/${leadId}`}>Quay lại lead</Link> — cần B2 xong và bắt đầu Pre-sales.
              </p>
            ) : null}
          </div>
        ) : null}
        {gateBlockedBanner ? (
          <div className="lead-alert lead-alert--warn" role="status">
            Không thể tạo báo giá trực tiếp — hoàn thành checklist G4 (L1 R5) trên Deal Room trước.
          </div>
        ) : null}
        {message ? (
          <div className="lead-alert lead-alert--success" role="status">
            {message}
          </div>
        ) : null}

        {snapshot && !loading ? (
          <>
            <DealRoomGateStrip
              gates={snapshot.gates}
              g4Messages={snapshot.proposal_gate.messages}
            />
            {presales?.consult_proposal_sla ? (
              <PresalesConsultSlaBanner sla={presales.consult_proposal_sla} />
            ) : null}
            <div className="deal-room-grid">
              <DealRoomConsultPanel
                done={snapshot.consult_progress.done}
                total={snapshot.consult_progress.total}
                leadId={leadId}
              />
              <DealRoomL1Panel
                token={getAccessToken() ?? ''}
                leadId={leadId}
                user={user}
                snapshot={snapshot}
                onUpdated={setSnapshot}
                onMessage={setMessage}
                onError={setError}
              />
            </div>
            <DealRoomSciPanel
              leadId={leadId}
              token={getAccessToken() ?? ''}
              sci={snapshot.sci}
              canCreateQuote={Boolean(snapshot.quote.can_create)}
              quoteBlockReason={quoteBlockReason}
              isGdkd={isGdkd}
              sciQuoteBlocked={hasSciBlockFlags}
              onMessage={setMessage}
              onError={setError}
              onQuoteApplied={() => load(getAccessToken() ?? '')}
            />
            <DealRoomQuotePanel
              leadId={leadId}
              token={getAccessToken() ?? ''}
              canCreate={quoteCanCreate || (Boolean(snapshot.quote.can_create) && isGdkd)}
              blockReason={quoteBlockReason}
              proposalsHref={snapshot.actions.proposals_href}
              canExportPack={snapshot.actions.can_export_pack}
              exportBlockReason={
                !snapshot.actions.can_export_pack && !snapshot.proposal_gate.ok
                  ? snapshot.proposal_gate.messages[0]
                  : undefined
              }
              proposalId={snapshot.quote.proposal_id}
              proposalStatus={snapshot.quote.status}
              proposalTotalVnd={snapshot.quote.total_vnd}
              customerId={snapshot.quote.customer_id}
              presalesId={snapshot.quote.presales_id}
              serviceSlug={snapshot.quote.service_slug}
              tiers={snapshot.quote.tiers}
              l1Checklist={snapshot.l1_checklist}
              onMessage={setMessage}
              onError={setError}
              onQuoteCreated={() => load(getAccessToken() ?? '')}
            />
            <DealRoomTeaserPanel
              leadId={leadId}
              token={getAccessToken() ?? ''}
              canShare={snapshot.actions.can_share_teaser}
              blockReason={
                !snapshot.actions.can_share_teaser && !snapshot.proposal_gate.ok
                  ? snapshot.proposal_gate.messages[0]
                  : undefined
              }
              teaserActive={snapshot.actions.teaser?.active ?? false}
              teaserExpiresAt={snapshot.actions.teaser?.expires_at}
              onMessage={setMessage}
              onError={setError}
              onUpdated={() => load(getAccessToken() ?? '')}
            />
          </>
        ) : null}
      </div>
    </StaffPageShell>
  );
}
