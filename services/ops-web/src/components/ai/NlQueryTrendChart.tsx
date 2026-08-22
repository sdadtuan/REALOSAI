'use client';

import type { NlQueryChart } from '@/lib/ai-api';

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 24, right: 24, bottom: 48, left: 56 };
const COLORS = ['#17692f', '#16a34a', '#ea580c', '#7c3aed'];

export function NlQueryTrendChart({ chart }: { chart: NlQueryChart }) {
  const values = chart.series.flatMap((series) => series.values).filter(Number.isFinite);
  const max = Math.max(...values, 1);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (chart.labels.length <= 1 ? plotWidth / 2 : (index / (chart.labels.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (Math.max(0, value) / max) * plotHeight;
  const groupWidth = plotWidth / Math.max(chart.labels.length, 1);
  const barWidth = Math.max(4, (groupWidth * 0.72) / Math.max(chart.series.length, 1));

  return (
    <div className="nl-query-chart" data-testid="nl-query-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Biểu đồ ${chart.type}`}>
        <line x1={PAD.left} y1={PAD.top + plotHeight} x2={WIDTH - PAD.right} y2={PAD.top + plotHeight} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotHeight} />
        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end">
          {max.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
        </text>
        <text x={PAD.left - 8} y={PAD.top + plotHeight + 4} textAnchor="end">
          0
        </text>

        {chart.type === 'bar'
          ? chart.series.flatMap((series, seriesIndex) =>
              series.values.map((value, index) => (
                <rect
                  key={`${series.key}-${index}`}
                  x={PAD.left + index * groupWidth + groupWidth * 0.14 + seriesIndex * barWidth}
                  y={y(value)}
                  width={barWidth}
                  height={PAD.top + plotHeight - y(value)}
                  fill={COLORS[seriesIndex % COLORS.length]}
                >
                  <title>{`${chart.labels[index]} · ${series.label}: ${value.toLocaleString('vi-VN')}`}</title>
                </rect>
              )),
            )
          : chart.series.map((series, seriesIndex) => {
              const points = series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
              return (
                <g key={series.key}>
                  <polyline points={points} fill="none" stroke={COLORS[seriesIndex % COLORS.length]} strokeWidth="3" />
                  {series.values.map((value, index) => (
                    <circle
                      key={`${series.key}-${index}`}
                      cx={x(index)}
                      cy={y(value)}
                      r="4"
                      fill={COLORS[seriesIndex % COLORS.length]}
                    >
                      <title>{`${chart.labels[index]} · ${series.label}: ${value.toLocaleString('vi-VN')}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })}

        {chart.labels.map((label, index) => (
          <text
            key={`${label}-${index}`}
            x={chart.type === 'bar' ? PAD.left + index * groupWidth + groupWidth / 2 : x(index)}
            y={HEIGHT - 20}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
      <div className="nl-query-chart__legend">
        {chart.series.map((series, index) => (
          <span key={series.key}>
            <i style={{ background: COLORS[index % COLORS.length] }} /> {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
