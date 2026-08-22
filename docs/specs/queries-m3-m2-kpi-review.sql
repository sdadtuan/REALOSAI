-- RNOS-M3 Phase 0 — M2 KPI review queries (Product)
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/specs/queries-m3-m2-kpi-review.sql
-- Pilot window: adjust :days (default 30)

\set days 30

\echo '== M2 KPI window: last' :days 'days =='

-- 1) Web Push subscriptions by platform (proxy via user_agent)
\echo ''
\echo '-- 1. Push subscriptions: iOS vs Android vs other (user_agent heuristic) --'
SELECT
  CASE
    WHEN user_agent ILIKE '%iphone%' OR user_agent ILIKE '%ipad%' OR user_agent ILIKE '%ios%' THEN 'ios'
    WHEN user_agent ILIKE '%android%' THEN 'android'
    ELSE 'other'
  END AS platform_guess,
  count(*) AS subscription_rows,
  count(DISTINCT portal_user_id) AS distinct_users
FROM portal_push_subscriptions
WHERE created_at >= NOW() - (:days || ' days')::interval
GROUP BY 1
ORDER BY 2 DESC;

-- 2) Active push cohort (all time)
\echo ''
\echo '-- 2. Total active push subscriptions (all time) --'
SELECT
  count(*) AS total_subscriptions,
  count(DISTINCT portal_user_id) AS distinct_approvers_with_push
FROM portal_push_subscriptions;

-- 3) Creative approve median time (mobile proxy: pending → reviewed)
\echo ''
\echo '-- 3. Creative time-to-approve (hours) — all channels, last N days --'
SELECT
  count(*) AS approved_count,
  round(percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600.0
  )::numeric, 2) AS median_hours,
  round(avg(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600.0)::numeric, 2) AS avg_hours
FROM creative_submissions
WHERE status IN ('approved', 'rejected')
  AND reviewed_at IS NOT NULL
  AND submitted_at >= NOW() - (:days || ' days')::interval;

-- 4) Pending backlog (SLA pressure)
\echo ''
\echo '-- 4. Pending creative backlog --'
SELECT
  count(*) AS pending_count,
  round(avg(EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 3600.0)::numeric, 2) AS avg_pending_hours
FROM creative_submissions
WHERE status = 'pending_client';

-- 5) Portal notifications volume (proxy engagement)
\echo ''
\echo '-- 5. Portal notifications (if table exists) --'
SELECT
  to_regclass('public.portal_notifications') IS NOT NULL AS table_exists;

\echo ''
\echo '-- If portal_notifications exists, uncomment below in psql: --'
\echo '-- SELECT category, count(*) FROM portal_notifications WHERE created_at >= NOW() - interval ''' :days ' days'' GROUP BY 1;'

-- 6) PWA install rate — requires analytics table or manual pilot survey
\echo ''
\echo '-- 6. PWA install rate: NOT in PG by default — collect via:'
\echo '     (a) Pilot survey: approvers_installed_pwa / approvers_invited'
\echo '     (b) Analytics event pwa_install_accepted (portal-web) when instrumented'
\echo '     (c) Manual count from AM pilot roster'
