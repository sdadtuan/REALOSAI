import { defineConfig, devices } from '@playwright/test';

const OPS_URL = process.env.OPS_E2E_URL ?? 'http://127.0.0.1:3200';
const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['json', { outputFile: 'test-results/rnos39-report.json' }]]
    : 'list',
  use: {
    baseURL: OPS_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.OPS_E2E_SKIP_SERVER === '1'
    ? undefined
    : {
        command: process.env.OPS_E2E_USE_DEV === '0' ? 'npm run start' : 'npm run dev',
        url: OPS_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          OPS_PORT: new URL(OPS_URL).port || '3200',
          NEXT_PUBLIC_PTT_API_URL: API_URL,
          NEXT_PUBLIC_PTT_SEO_HUB_ENABLED: process.env.NEXT_PUBLIC_PTT_SEO_HUB_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_SEO_GATE_A_ENABLED: process.env.NEXT_PUBLIC_PTT_SEO_GATE_A_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_SEO_RESEARCH_ENABLED: process.env.NEXT_PUBLIC_PTT_SEO_RESEARCH_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_SEO_CONTENT_ENABLED: process.env.NEXT_PUBLIC_PTT_SEO_CONTENT_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_SEO_TECHNICAL_ENABLED: process.env.NEXT_PUBLIC_PTT_SEO_TECHNICAL_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_META_ALERTS_ENABLED: '0',
          NEXT_PUBLIC_PTT_META_TRACKING_ENABLED: process.env.NEXT_PUBLIC_PTT_META_TRACKING_ENABLED ?? '1',
          NEXT_PUBLIC_PTT_META_ANOMALY_ENABLED: process.env.NEXT_PUBLIC_PTT_META_ANOMALY_ENABLED ?? '0',
          NEXT_PUBLIC_PTT_META_ROAS_ENABLED: process.env.NEXT_PUBLIC_PTT_META_ROAS_ENABLED ?? '0',
          NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED: process.env.NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED ?? '1',
          NEXT_PUBLIC_PWA_ENABLED: process.env.NEXT_PUBLIC_PWA_ENABLED ?? '1',
          NEXT_PUBLIC_WIN_ORG_UI: process.env.NEXT_PUBLIC_WIN_ORG_UI ?? '1',
          NEXT_PUBLIC_WIN_KPI_SOLUTION: process.env.NEXT_PUBLIC_WIN_KPI_SOLUTION ?? '1',
        },
      },
});
