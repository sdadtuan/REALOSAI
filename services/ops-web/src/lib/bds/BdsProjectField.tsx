'use client';

import { useEffect, useState } from 'react';
import { fetchReProjects, type ReProjectRow } from '@/lib/api';
import { writeBdsProjectId } from './project-picker';

export function BdsProjectField(props: {
  token: string;
  value: number;
  onChange: (id: number) => void;
}) {
  const [rows, setRows] = useState<ReProjectRow[]>([]);
  useEffect(() => {
    void fetchReProjects(props.token).then(setRows).catch(() => setRows([]));
  }, [props.token]);
  return (
    <label>
      Dự án{' '}
      <select
        value={props.value || ''}
        onChange={(e) => {
          const id = Number(e.target.value);
          writeBdsProjectId(id);
          props.onChange(id);
        }}
      >
        <option value="">— chọn —</option>
        {rows.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
