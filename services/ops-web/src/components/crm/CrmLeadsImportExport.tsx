'use client';

import { useRef, useState } from 'react';
import { WinExcelImportWizard } from '@/components/win';
import type { LeadImportResult } from '@/lib/api';
import {
  downloadLeadsImportTemplate,
  exportLeadsXlsx,
  importLeadsXlsx,
} from '@/lib/api';

interface Props {
  token: string;
  query: string;
  selectedIds: number[];
  canImport: boolean;
  onImported: () => void;
  onError: (message: string) => void;
}

export function CrmLeadsImportExport({
  token,
  query,
  selectedIds,
  canImport,
  onImported,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busy, setBusy] = useState<'template' | 'export-all' | 'export-selected' | 'import' | null>(
    null,
  );
  const [importSummary, setImportSummary] = useState<LeadImportResult | null>(null);

  async function onDownloadTemplate() {
    setBusy('template');
    setImportSummary(null);
    onError('');
    try {
      await downloadLeadsImportTemplate(token);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải mẫu thất bại');
    } finally {
      setBusy(null);
    }
  }

  async function onExport(allMatching: boolean) {
    setBusy(allMatching ? 'export-all' : 'export-selected');
    onError('');
    try {
      await exportLeadsXlsx(token, {
        q: query || undefined,
        ids: allMatching ? undefined : selectedIds,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setBusy(null);
    }
  }

  async function onPickImport() {
    fileRef.current?.click();
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setBusy('import');
    setImportSummary(null);
    onError('');
    try {
      const result = await importLeadsXlsx(token, file);
      setImportSummary(result);
      if (result.created > 0) onImported();
      if (result.errors.length > 0) {
        onError(`Import xong: ${result.created} thành công, ${result.errors.length} lỗi`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="crm-leads-io">
      <div className="crm-leads-io__actions">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy != null}
          onClick={() => void onDownloadTemplate()}
        >
          {busy === 'template' ? 'Đang tải…' : 'Mẫu Excel'}
        </button>
        {canImport ? (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy != null}
              onClick={() => setWizardOpen(true)}
            >
              Import wizard
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy != null}
              onClick={() => void onPickImport()}
            >
              {busy === 'import' ? 'Đang import…' : 'Import nhanh'}
            </button>
            <input
              ref={fileRef}
              id="crm-leads-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => void onImportFile(e.target.files?.[0])}
            />
          </>
        ) : null}
        <button
          type="button"
          className="btn btn-sm"
          disabled={busy != null}
          onClick={() => void onExport(true)}
          title="SĐT/Email có thể bị ẩn trong file nếu thiếu quyền crm_leads.view_pii"
        >
          {busy === 'export-all' ? 'Đang xuất…' : 'Export Excel (filter)'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy != null || selectedIds.length === 0}
          onClick={() => void onExport(false)}
          title="Export tuân thủ field ABAC — PII strip khi thiếu cap"
        >
          {busy === 'export-selected'
            ? 'Đang xuất…'
            : `Export đã chọn (${selectedIds.length})`}
        </button>
      </div>

      {importSummary ? (
        <div className="crm-leads-io__summary" role="status">
          <p>
            Import: <strong>{importSummary.created}</strong> lead mới
            {importSummary.errors.length ? (
              <>
                {' '}
                · <span className="error">{importSummary.errors.length} lỗi</span>
              </>
            ) : null}
          </p>
          {importSummary.errors.length ? (
            <ul className="crm-leads-io__errors">
              {importSummary.errors.slice(0, 8).map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Dòng {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {canImport ? (
        <WinExcelImportWizard
          open={wizardOpen}
          mode="leads"
          token={token}
          onClose={() => setWizardOpen(false)}
          onComplete={onImported}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
