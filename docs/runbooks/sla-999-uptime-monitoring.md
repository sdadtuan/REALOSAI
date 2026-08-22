# SLA 99.9% — uptime monitoring (PTTCRM public path)

> **Target:** 99.9% monthly availability for components listed on `/en/status`.

## Formula

```
availability = (total_minutes - downtime_minutes) / total_minutes
```

Monthly target: **≥ 0.999** (≤ ~43.8 minutes downtime / 30-day month).

## Components in scope

| Component ID | Check |
|--------------|--------|
| `marketing_site` | HTTPS GET `https://pttcrm.com/en` — 200, TTFB < 5s |
| `demo_api` | GET `/api/v1/public/gtm/status` + synthetic POST demo (staging) |
| `cms_read` | GET public CMS article list endpoint |

Internal mapping: `GtmPublicStatusService` probes DB for `demo_api` and `cms_read`.

## Tooling (PO chooses one)

- UptimeRobot / Pingdom — external synthetic
- Self-hosted — cron + alert to `hello@pttcrm.com`
- Monthly manual review — minimum until automated

## Incident comms

1. Confirm outage scope (one or all components)
2. Update `/en/status` via API degradation (automatic when DB down)
3. Email sales template: estimated restore time
4. Post-mortem within 5 business days for outage > 15 min

## Reporting

- IT exports monthly uptime % per component
- GDKD reviews against 99.9% target
- SOC2 evidence folder: `docs/compliance/soc2-type1/availability/`

## Public page

- Site: `https://pttcrm.com/en/status`
- API: `GET /api/v1/public/gtm/status` (poll 60s from status page)
