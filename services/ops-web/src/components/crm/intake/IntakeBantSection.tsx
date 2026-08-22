'use client';

import { IntakeBantScoreRow } from '@/components/crm/intake/IntakeBantScoreRow';
import { IntakeBantTotalBar } from '@/components/crm/intake/IntakeBantTotalBar';
import {
  BANT_KEYS,
  computeBantTotal,
  getDecisionMismatchMessage,
  type BantKey,
  type BantRowUi,
} from '@/lib/crm/intake-bant';

interface Props {
  bant: Record<string, number>;
  bantRows: BantRowUi[];
  decision: string;
  disabled?: boolean;
  onBantChange: (key: BantKey, value: number) => void;
}

export function IntakeBantSection({
  bant,
  bantRows,
  decision,
  disabled,
  onBantChange,
}: Props) {
  const rowsByKey = new Map(bantRows.map((row) => [row.key, row]));
  const liveTotal = computeBantTotal(bant);
  const mismatch = getDecisionMismatchMessage(decision, liveTotal);

  return (
    <div className="intake-bant-section__body stack-gap">
      <IntakeBantTotalBar total={liveTotal} />

      <div className="intake-bant-score-grid">
        {BANT_KEYS.map((key) => {
          const row = rowsByKey.get(key);
          return (
            <IntakeBantScoreRow
              key={key}
              bantKey={key}
              hint={row?.hint ?? ''}
              value={Number(bant[key] ?? 0)}
              disabled={disabled}
              onChange={(value) => onBantChange(key, value)}
            />
          );
        })}
      </div>

      {mismatch ? (
        <p className="intake-bant-decision-warn" role="status">
          ⚠ {mismatch}
        </p>
      ) : null}
    </div>
  );
}
