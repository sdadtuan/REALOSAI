'use client';

import { useMemo, useRef, useState } from 'react';
import type { LeadImportResult } from '@/lib/api';
import {
  downloadLeadsImportTemplate,
  downloadStaffRosterTemplateCsv,
  importCrmStaff,
  importLeadsXlsx,
} from '@/lib/api';
import { WinWizardSteps } from '@/components/win/WinWizardSteps';

type WizardMode = 'leads' | 'staff';

type Props = {
  open: boolean;
  mode: WizardMode;
  token: string;
  onClose: () => void;
  onComplete: () => void;
  onError: (message: string) => void;
};

type StepId = 'template' | 'upload' | 'preview' | 'import' | 'result';

const STEP_LABELS: Record<StepId, string> = {
  template: 'Tải template',
  upload: 'Upload',
  preview: 'Preview lỗi',
  import: 'Import',
  result: 'Kết quả',
};

export function WinExcelImportWizard({ open, mode, token, onClose, onComplete, onError }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<StepId>('template');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [leadResult, setLeadResult] = useState<LeadImportResult | null>(null);
  const [staffResult, setStaffResult] = useState<{ created?: number; updated?: number } | null>(null);

  const steps = useMemo(
    () =>
      (['template', 'upload', 'preview', 'import', 'result'] as StepId[]).map((id) => ({
        id,
        label: STEP_LABELS[id],
        status:
          id === step
            ? ('current' as const)
            : (['template', 'upload', 'preview', 'import', 'result'] as StepId[]).indexOf(id) <
                (['template', 'upload', 'preview', 'import', 'result'] as StepId[]).indexOf(step)
              ? ('done' as const)
              : ('pending' as const),
      })),
    [step],
  );

  if (!open) return null;

  async function downloadTemplate() {
    setBusy(true);
    onError('');
    try {
      if (mode === 'leads') await downloadLeadsImportTemplate(token);
      else await downloadStaffRosterTemplateCsv();
      setStep('upload');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải template thất bại');
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(next: File | undefined) {
    if (!next) return;
    if (mode === 'leads' && !next.name.toLowerCase().endsWith('.xlsx')) {
      onError('Lead import chỉ hỗ trợ .xlsx');
      return;
    }
    if (mode === 'staff' && !/\.(csv|xlsx)$/i.test(next.name)) {
      onError('Roster import hỗ trợ .csv hoặc .xlsx');
      return;
    }
    setFile(next);
    setStep('preview');
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setStep('import');
    onError('');
    try {
      if (mode === 'leads') {
        const result = await importLeadsXlsx(token, file);
        setLeadResult(result);
      } else {
        const text = await file.text();
        const rows = parseStaffCsv(text);
        const out = await importCrmStaff(token, rows);
        setStaffResult({
          created: Number((out as { created?: number }).created ?? rows.length),
        });
      }
      setStep('result');
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import thất bại');
      setStep('preview');
    } finally {
      setBusy(false);
    }
  }

  function resetAndClose() {
    setStep('template');
    setFile(null);
    setLeadResult(null);
    setStaffResult(null);
    onClose();
  }

  return (
    <div className="win-drawer-backdrop" role="presentation" onClick={resetAndClose}>
      <div
        className="win-drawer win-excel-wizard"
        role="dialog"
        aria-label={mode === 'leads' ? 'Import lead Excel' : 'Import roster Excel'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="win-drawer__head">
          <h2>{mode === 'leads' ? 'Import lead Excel' : 'Import roster nhân sự'}</h2>
          <button type="button" className="btn btn-sm btn-secondary" onClick={resetAndClose}>
            Đóng
          </button>
        </div>

        <WinWizardSteps steps={steps} />

        {step === 'template' ? (
          <div className="stack-gap">
            <p className="muted">
              Tải file mẫu tiếng Việt, điền dữ liệu rồi upload ở bước tiếp theo.
            </p>
            <button type="button" className="btn" disabled={busy} onClick={() => void downloadTemplate()}>
              {busy ? 'Đang tải…' : 'Tải template'}
            </button>
          </div>
        ) : null}

        {step === 'upload' ? (
          <div className="stack-gap">
            <p className="muted">Chọn file {mode === 'leads' ? '.xlsx' : '.csv/.xlsx'} đã điền.</p>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Chọn file
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={mode === 'leads' ? '.xlsx' : '.csv,.xlsx'}
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </div>
        ) : null}

        {step === 'preview' && file ? (
          <div className="stack-gap">
            <p>
              File: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
            </p>
            <p className="muted">Kiểm tra tên file và cột trước khi import.</p>
            <button type="button" className="btn" disabled={busy} onClick={() => void runImport()}>
              {busy ? 'Đang import…' : 'Import ngay'}
            </button>
          </div>
        ) : null}

        {step === 'import' ? <p className="muted">Đang xử lý import…</p> : null}

        {step === 'result' ? (
          <div className="stack-gap">
            {leadResult ? (
              <p role="status">
                Import lead: <strong>{leadResult.created}</strong> mới
                {leadResult.errors.length ? (
                  <>
                    {' '}
                    · <span className="error">{leadResult.errors.length} lỗi</span>
                  </>
                ) : null}
              </p>
            ) : null}
            {staffResult ? (
              <p role="status">
                Import roster: <strong>{staffResult.created ?? 0}</strong> bản ghi
              </p>
            ) : null}
            <button type="button" className="btn btn-secondary" onClick={resetAndClose}>
              Hoàn tất
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function parseStaffCsv(text: string): Array<Record<string, unknown>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      row[header] = cols[i]?.trim() ?? '';
    });
    return row;
  });
}
