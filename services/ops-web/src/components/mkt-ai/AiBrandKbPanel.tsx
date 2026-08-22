'use client';

import { useCallback, useRef, useState } from 'react';
import {
  fetchMktAiDocuments,
  patchMktAiBrief,
  uploadMktAiDocument,
  type MktAiDocumentRow,
} from '@/lib/mkt-ai-planner-api';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';

interface Props {
  token: string;
  lifecycleId: number;
  canEdit: boolean;
  ragEnabled: boolean;
  useRag: boolean;
  documents: MktAiDocumentRow[];
  onDocumentsChange: (docs: MktAiDocumentRow[]) => void;
  onUseRagChange: (useRag: boolean) => void;
  onError?: (message: string) => void;
  onMessage?: (message: string) => void;
}

function statusLabel(status: MktAiDocumentRow['status']): string {
  switch (status) {
    case 'indexed':
      return '✓ indexed';
    case 'indexing':
      return '◐ indexing';
    case 'failed':
      return '✗ failed';
    case 'pending':
      return '… pending';
    default:
      return status;
  }
}

function documentTag(doc: MktAiDocumentRow): string | null {
  const tag = doc.metadata_json?.tag;
  return typeof tag === 'string' && tag.trim() ? tag.trim() : null;
}

export function AiBrandKbPanel({
  token,
  lifecycleId,
  canEdit,
  ragEnabled,
  useRag,
  documents,
  onDocumentsChange,
  onUseRagChange,
  onError,
  onMessage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploadTag, setUploadTag] = useState('');

  const refreshDocuments = useCallback(async () => {
    const res = await fetchMktAiDocuments(token, lifecycleId);
    onDocumentsChange(res.documents);
  }, [lifecycleId, onDocumentsChange, token]);

  async function handleUpload(file: File) {
    if (!canEdit || !ragEnabled) return;
    setUploading(true);
    onError?.('');
    try {
      const res = await uploadMktAiDocument(token, lifecycleId, file, uploadTag.trim() || undefined);
      await refreshDocuments();
      const tagNote = uploadTag.trim() ? ` · tag=${uploadTag.trim()}` : '';
      onMessage?.(
        res.document.status === 'indexed'
          ? `Đã index ${res.document.filename} (${res.document.chunk_count} chunks)${tagNote}`
          : `Upload ${res.document.filename}: ${res.document.status}${tagNote}`,
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleRag(next: boolean) {
    if (!canEdit) return;
    setToggling(true);
    try {
      await patchMktAiBrief(token, lifecycleId, { use_rag: next });
      onUseRagChange(next);
      onMessage?.(next ? 'Đã bật RAG khi sinh chiến lược' : 'Đã tắt RAG');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Cập nhật RAG thất bại');
    } finally {
      setToggling(false);
    }
  }

  if (!ragEnabled) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Brand KB RAG chưa bật trên môi trường này (`PTT_MKT_AI_RAG_ENABLED`).
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.85rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Thư viện thương hiệu</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Upload PDF, DOCX, PPTX hoặc TXT — gắn tag để RAG lọc khi sinh chiến lược (EC-MKT-AI-06).
        </p>
      </div>

      {canEdit ? (
        <>
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            Tag tài liệu (tuỳ chọn)
            <input
              value={uploadTag}
              onChange={(e) => setUploadTag(e.target.value)}
              placeholder="vd. brand-voice, catalog-2026"
              disabled={uploading}
              style={{ width: '100%', maxWidth: '20rem' }}
            />
          </label>

          <div
            className={`${styles.kbDropzone} ${dragOver ? styles.kbDropzoneActive : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleUpload(file);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = '';
              }}
            />
            <div style={{ fontSize: '0.9rem' }}>
              {uploading ? 'Đang upload & index…' : 'Kéo thả hoặc bấm để chọn PDF / DOCX / PPTX / TXT'}
            </div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              Tối đa 10 MB · chunk + FTS index tự động
            </div>
          </div>

          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={useRag}
              disabled={toggling || documents.every((d) => d.status !== 'indexed')}
              onChange={(e) => void handleToggleRag(e.target.checked)}
            />
            Dùng RAG khi sinh chiến lược / content
          </label>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chỉ xem — cần quyền generate và stage onboard/deliver để upload.
        </p>
      )}

      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {documents.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Chưa có tài liệu — upload brand guidelines hoặc catalog.
          </p>
        ) : (
          documents.map((doc) => {
            const tag = documentTag(doc);
            return (
              <div
                key={doc.id}
                className={styles.kbDocRow}
                title={doc.error_message ?? undefined}
              >
                <span>
                  📄 {doc.filename}
                  {tag ? ` · #${tag}` : ''}
                </span>
                <span className="muted" style={{ fontSize: '0.82rem' }}>
                  {doc.chunk_count > 0 ? `${doc.chunk_count} chunks` : '—'} · {statusLabel(doc.status)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
