'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchLeadSlaCareContext, trackLeadCallScriptCopy, type LeadSlaCareContext } from '@/lib/api';

interface Props {
  token: string;
  leadId: number;
  onError?: (msg: string) => void;
  /** Preloaded from unified copilot-context. */
  callScript?: LeadSlaCareContext['drafts']['call_script'] | null;
  scriptLoading?: boolean;
}

export function CallScriptDraftSection({
  token,
  leadId,
  onError,
  callScript: callScriptProp,
  scriptLoading = false,
}: Props) {
  const [script, setScript] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ctx = await fetchLeadSlaCareContext(token, leadId);
      const draft = ctx.drafts.call_script;
      if (!draft) {
        setScript(null);
        return;
      }
      const text = [
        draft.greeting,
        draft.intro,
        ...draft.questions.map((q, i) => `${i + 1}. ${q}`),
        draft.closing,
      ].join('\n\n');
      setScript(text);
      setDisclaimer(draft.disclaimer);
    } catch (err) {
      setScript(null);
      onError?.(err instanceof Error ? err.message : 'Không tải script gọi');
    } finally {
      setLoading(false);
    }
  }, [leadId, onError, token]);

  useEffect(() => {
    if (callScriptProp !== undefined) {
      setLoading(scriptLoading);
      if (!callScriptProp) {
        setScript(null);
        setDisclaimer('');
        return;
      }
      const text = [
        callScriptProp.greeting,
        callScriptProp.intro,
        ...callScriptProp.questions.map((q, i) => `${i + 1}. ${q}`),
        callScriptProp.closing,
      ].join('\n\n');
      setScript(text);
      setDisclaimer(callScriptProp.disclaimer);
      return;
    }
    void load();
  }, [callScriptProp, scriptLoading, load]);

  if (loading) {
    return <p className="muted">Đang tải script gọi…</p>;
  }

  if (!script) return null;

  return (
    <section className="ai-call-script-section" aria-label="Script gọi lần đầu">
      <h4 className="ai-section-title">Script gọi lần đầu</h4>
      <pre className="ai-call-script-section__body">{script}</pre>
      {disclaimer ? <p className="muted ai-call-script-section__disclaimer">{disclaimer}</p> : null}
      {message ? <p className="ai-followup-message">{message}</p> : null}
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={() =>
          void navigator.clipboard.writeText(script).then(async () => {
            setMessage('Đã copy script vào clipboard.');
            try {
              await trackLeadCallScriptCopy(token, leadId);
            } catch {
              /* non-blocking */
            }
          })
        }
      >
        Copy script
      </button>
    </section>
  );
}
