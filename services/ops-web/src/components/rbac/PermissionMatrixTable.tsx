import type { StaffPermissionMatrixRow } from '@/lib/api';
import {
  PERMISSION_MATRIX_ACTIONS,
  permissionActionLabel,
} from '@/lib/rbac/grant-diff';

type Props = {
  groupedRows: Array<[string, StaffPermissionMatrixRow[]]>;
  grants: Record<string, string[]>;
  canConfigure: boolean;
  busy?: boolean;
  isAllowed: (sectionId: string, action: string) => boolean;
  onToggle: (sectionId: string, action: string, checked: boolean) => void;
  addonTag?: boolean;
};

export function PermissionMatrixTable({
  groupedRows,
  grants,
  canConfigure,
  busy = false,
  isAllowed,
  onToggle,
  addonTag = false,
}: Props) {
  void grants;
  return (
    <>
      {groupedRows.map(([group, rows]) => (
        <section key={group} className="stack-gap">
          <h3 className="section-title">
            {group}
            {addonTag ? <span className="win-layer-tag win-layer-tag--addon">Add-on</span> : null}
          </h3>
          <div className="table-scroll">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Section / Nút UI</th>
                  <th>Trang</th>
                  {PERMISSION_MATRIX_ACTIONS.map((action) => (
                    <th key={action}>{permissionActionLabel(action)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.section_id}-${row.row_kind}`}>
                    <td>
                      <div>
                        {row.row_kind === 'ui_button' ? '↳ ' : ''}
                        {row.section_label}
                      </div>
                      <div className="muted" style={{ fontSize: '0.85em' }}>
                        {row.section_id}
                      </div>
                    </td>
                    <td className="muted">{row.page}</td>
                    {PERMISSION_MATRIX_ACTIONS.map((action) => {
                      if (!row.actions.includes(action)) {
                        return (
                          <td key={action} className="muted">
                            —
                          </td>
                        );
                      }
                      const checked = isAllowed(row.section_id, action);
                      return (
                        <td key={action}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canConfigure || busy}
                            aria-label={`${row.section_id}.${action}`}
                            onChange={(e) => onToggle(row.section_id, action, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
