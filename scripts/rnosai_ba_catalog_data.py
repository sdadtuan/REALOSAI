"""RNOSAI BA catalog data — màn hình, UC, BR, traceability cho Excel template PTTCOM."""
from __future__ import annotations

from datetime import date

VERSION = "2.3"
TODAY = date.today().isoformat()

# ── Modules ──────────────────────────────────────────────────────────────────
MODULES: list[tuple[str, str, str]] = [
    ("MOD-CRM", "CRM Core", "Lead, Customer, CSKH, Sales, KPI, Forecast"),
    ("MOD-AGENCY", "Agency Service Delivery", "Client onboard, workflow, ingest, jobs"),
    ("MOD-META", "Meta Enterprise Ops", "Facebook Ads, tracking, intelligence, ads-ops"),
    ("MOD-ZALO", "Zalo Ads OS", "Zalo Ads hub, lead ingest, CPL"),
    ("MOD-SEO", "SEO/AEO Enterprise", "Research, content, technical, governance"),
    ("MOD-EM", "Email Marketing", "Campaigns, contacts, journeys, deliverability"),
    ("MOD-PORTAL", "Client Portal", "Dashboard, approvals, exports cho khách hàng"),
    ("MOD-PLAT", "Platform", "Auth, webhook, job queue, RBAC"),
    ("MOD-AI", "AI Revenue OS", "Copilot, score, forecast, automation, playbooks"),
    ("MOD-ADMIN", "Admin Console", "AI runs/agents/tools, CRM config"),
    ("MOD-AUTH", "Authentication", "Staff login JWT refresh"),
    ("MOD-MOB", "Mobile Experience", "PWA staff + portal mobile + push + native shell cross-cutting"),
]

# ── Screens [scr_id, name_vn, module, route, roles, status, linked_ucs, version, owner, priority, trace_ref, updated, notes] ──
SCREENS: list[list] = [
    # Auth
    ["SCR-AUTH-001", "Đăng nhập Staff (ops-web)", "Auth", "/login", "All staff", "Done", "PLAT-UC-001", "1.0", "Platform", "High", "—", TODAY, "JWT + refresh + redirect theo cap"],
    # CRM Core
    ["SCR-CRM-001", "Quản lý Lead (danh sách)", "CRM", "/crm/leads", "Sales, AM, Admin", "Done", "CRM-UC-001, CRM-UC-002, CRM-UC-015", "1.0", "Product", "High", "P0-2", TODAY, "Import/export Excel ✅ · AI Score column ✅"],
    ["SCR-CRM-002", "Chi tiết Lead", "CRM", "/crm/leads/[id]", "Sales, AM, Admin", "Done", "CRM-UC-002, AI-UC-001, AI-UC-002, AI-UC-003, AI-UC-004", "1.0", "Product", "High", "UI-R1-08", TODAY, "Copilot + attribution chips + override score ✅"],
    ["SCR-CRM-003", "Phải tra soát (Review Queue)", "CRM", "/crm/leads/review-queue", "GDKD, Admin", "Done", "CRM-UC-003", "1.0", "Agency", "High", "—", TODAY, "Agency tenant only"],
    ["SCR-CRM-004", "Bảng CSKH SLA", "CRM", "/crm/cskh-board", "CSKH, Admin", "Done", "CRM-UC-008", "1.0", "CSKH", "High", "P1-3", TODAY, "Kanban SLA breach highlight ✅"],
    ["SCR-CRM-005", "Dashboard kinh doanh chủ DN", "CRM", "/crm/business-dashboard", "GDKD, Admin", "Done", "CRM-UC-014", "1.0", "Finance", "High", "RNOS-46", TODAY, "Tiles revenue + drill-down ✅"],
    ["SCR-CRM-006", "Dự báo doanh thu (Forecast)", "CRM", "/crm/forecast", "GDKD, Finance", "Done", "AI-UC-013", "1.0", "AI", "High", "RNOS-17", TODAY, "Commit forecast snapshot ✅"],
    ["SCR-CRM-007", "Sức khỏe khách hàng (Health)", "CRM", "/crm/health", "AM, CSKH, GDKD", "Done", "AI-UC-017", "1.0", "AI", "Medium", "RNOS-19", TODAY, "Churn health score ✅"],
    ["SCR-CRM-008", "Khách hàng (post-convert)", "CRM", "/crm/customers", "Sales, AM", "Done", "CRM-UC-007", "1.0", "Sales", "High", "—", TODAY, "Customer list post-convert"],
    ["SCR-CRM-009", "Chi tiết Khách hàng", "CRM", "/crm/customers/[id]", "Sales, AM", "Done", "CRM-UC-007, AI-UC-008", "1.0", "Sales", "High", "RNOS-16", TODAY, "Timeline enrich ✅"],
    ["SCR-CRM-010", "Hub CRM / Review", "CRM", "/crm/hub", "GDKD, AM", "Done", "CRM-UC-003, CRM-UC-011", "1.0", "Product", "High", "—", TODAY, "Contract lifecycle hub"],
    ["SCR-CRM-011", "KPI Dashboard nhân sự", "CRM", "/crm/kpi", "GDKD, Admin", "Done", "CRM-UC-013", "1.0", "Finance", "High", "RNOS-42", TODAY, "Export staff KPI Excel ✅"],
    ["SCR-CRM-012", "Intake / Onboarding lead", "CRM", "/crm/intake", "AM, Sales", "Done", "CRM-UC-005, SYS-UC-001", "1.0", "Sales", "Medium", "—", TODAY, "Pre-sales intake form"],
    ["SCR-CRM-013", "Pipeline Sales", "CRM", "/crm/sales", "Sales, GDKD", "In progress", "CRM-UC-009", "0.8", "Sales", "Medium", "RNOS-23", TODAY, "Pipeline risk + deal score R2"],
    ["SCR-CRM-014", "Đề xuất / Proposal", "CRM", "/crm/proposals", "Sales, AM", "Done", "CRM-UC-006", "1.0", "Sales", "High", "—", TODAY, "Lead → Proposal workflow"],
    ["SCR-CRM-015", "Dự án BĐS (RE Projects)", "CRM", "/crm/re-projects", "RE PM, Admin", "Done", "CRM-UC-010, META-UC-004", "1.0", "RE", "High", "—", TODAY, "Webhook Facebook leadgen ✅"],
    ["SCR-CRM-016", "Quản lý nhân sự CRM", "CRM", "/crm/staff", "Admin, HR", "Done", "CRM-UC-013", "1.0", "HR", "Medium", "—", TODAY, "Staff roster + caps"],
    ["SCR-CRM-017", "Tickets / Case CSKH", "CRM", "/crm/tickets", "CSKH, Admin", "Done", "CRM-UC-008", "1.0", "CSKH", "High", "RNOS-24", TODAY, "Ticket queue ✅"],
    ["SCR-CRM-018", "Đơn hàng", "CRM", "/crm/orders", "Finance, AM", "Done", "SVC-UC-004", "1.0", "Finance", "High", "RNOS-25", TODAY, "Order lifecycle ✅"],
    ["SCR-CRM-019", "Hóa đơn", "CRM", "/crm/invoices", "Finance, Admin", "Done", "SVC-UC-004", "1.0", "Finance", "High", "RNOS-25", TODAY, "Invoice + finance gate ✅"],
    ["SCR-CRM-020", "Tài chính / AR aging", "CRM", "/crm/financials", "Finance, AM", "Done", "SVC-UC-004, CRM-UC-011", "1.0", "Finance", "High", "Prod-S5", TODAY, "Finance gate handover SVC-UC-004 ✅"],
    ["SCR-CRM-021", "Marketing Plan", "CRM", "/crm/marketing-plan", "AM, Strategist", "In progress", "SVC-UC-011", "1.0", "Agency", "Medium", "—", TODAY, "SOP marketing plan lifecycle Optimize"],
    ["SCR-CRM-022", "SOP Library", "CRM", "/crm/sop", "AM, PM", "In progress", "SVC-UC-011", "1.0", "Agency", "Medium", "—", TODAY, "Standard operating procedures per client"],
    ["SCR-CRM-023", "Catalog dịch vụ / ngành", "CRM", "/crm/catalog", "Admin, Sales", "Done", "CRM-UC-012", "1.0", "Product", "Medium", "—", TODAY, "Service line + industry catalog"],
    ["SCR-CRM-024", "Staff KPI Dashboard", "CRM", "/crm/staff-kpi", "GDKD, Admin", "Done", "CRM-UC-013", "1.0", "Finance", "Medium", "RNOS-42", TODAY, "Per-staff KPI tiles"],
    ["SCR-CRM-025", "Owner Weekly Report", "CRM", "/crm/owner-weekly", "GDKD, AM", "Done", "CRM-UC-014", "1.0", "Finance", "Medium", "—", TODAY, "Executive weekly snapshot"],
    ["SCR-CRM-026", "Payroll / chấm công", "CRM", "/crm/payroll", "HR, Finance", "Done", "CRM-UC-013", "1.0", "HR", "Medium", "—", TODAY, "Payroll integration view"],
    ["SCR-CRM-027", "Chi tiết nhân sự", "CRM", "/crm/staff/[id]", "Admin, HR", "Done", "CRM-UC-013", "1.0", "HR", "Medium", "—", TODAY, "Staff profile + caps detail"],
    ["SCR-CRM-030", "Chi tiết Marketing Plan", "CRM", "/crm/marketing-plan/[id]", "AM, Strategist", "In progress", "SVC-UC-011", "1.0", "Agency", "Medium", "—", TODAY, "Plan fields + milestones — Publish TMMT"],
    ["SCR-CRM-028", "Chi tiết dự án BĐS", "CRM", "/crm/re-projects/[id]", "RE PM", "Done", "CRM-UC-010", "1.0", "RE", "High", "—", TODAY, "RE project detail + leadgen map"],
    ["SCR-CRM-029", "Chi tiết Service Delivery", "CRM", "/crm/service-delivery/[id]", "AM, PM", "Done", "SVC-UC-001, SVC-UC-003", "1.0", "Agency", "High", "—", TODAY, "Lifecycle detail per client"],
    # CRM AI / Automation
    ["SCR-AI-001", "AI Insights / Copilot analytics", "AI", "/crm/ai/insights", "GDKD, Admin", "Done", "AI-UC-005, AI-UC-009", "1.0", "AI", "High", "RNOS-29", TODAY, "Dismiss reason analytics G6 ✅"],
    ["SCR-AI-002", "NL Analytics Query", "AI", "/crm/ai/query", "GDKD, Admin", "Done", "AI-UC-016", "1.0", "AI", "Medium", "RNOS-22", TODAY, "Curated NL query ✅"],
    ["SCR-AI-003", "Manager Coach Digest", "AI", "/crm/ai/coach", "GDKD", "Done", "AI-UC-018", "1.0", "AI", "Medium", "RNOS-21", TODAY, "Weekly coach digest ✅"],
    ["SCR-AI-004", "Automation Workflows", "AI", "/crm/automation", "Admin, AM", "Done", "AI-UC-020", "1.0", "AI", "High", "RNOS-13", TODAY, "Workflow AI node ✅"],
    ["SCR-AI-005", "Playbook RAG", "AI", "/crm/playbooks", "Sales, AM", "Done", "AI-UC-020", "1.0", "AI", "Medium", "RNOS-12", TODAY, "PG vector chunks ✅"],
    # CRM Service Delivery
    ["SCR-SVC-001", "Launch QA Checklist", "Agency", "/crm/launch-qa", "AM, Media Buyer", "Done", "SVC-UC-005", "1.0", "Agency", "High", "—", TODAY, "Pre-launch QA gate"],
    ["SCR-SVC-002", "Campaign Write Queue", "Agency", "/crm/campaign-writes", "Creative Lead, AM", "Done", "SVC-UC-007", "1.0", "Agency", "High", "—", TODAY, "Approval queue ✅"],
    ["SCR-SVC-003", "Creative Hub", "Agency", "/crm/creatives", "Creative Lead", "Done", "SVC-UC-006", "1.0", "Agency", "High", "—", TODAY, "Upload & review creative"],
    ["SCR-SVC-004", "Service Delivery Workflow", "Agency", "/crm/service-delivery", "AM, PM", "Done", "SVC-UC-001, SVC-UC-003", "1.0", "Agency", "High", "—", TODAY, "7-stage lifecycle"],
    # Agency
    ["SCR-AGENCY-001", "Chi tiết Client Agency", "Agency", "/agency/clients/[id]", "AM, Admin", "Done", "SVC-UC-002, SYS-UC-001", "1.0", "Agency", "High", "—", TODAY, "Onboard checklist + settings"],
    ["SCR-AGENCY-002", "Tạo Client mới", "Agency", "/agency/clients/new", "AM, Admin", "Done", "SYS-UC-001, SVC-UC-002", "1.0", "Agency", "High", "—", TODAY, "Client creation wizard"],
    ["SCR-AGENCY-003", "Agency Hub", "Agency", "/agency", "AM, Admin", "Done", "SVC-UC-010", "1.0", "Agency", "Medium", "—", TODAY, "Client list overview"],
    ["SCR-AGENCY-004", "Ingest Monitor", "Agency", "/agency/ingest", "Admin, Tracking", "Done", "SVC-UC-009", "1.0", "Agency", "Medium", "—", TODAY, "Webhook/job ingest health"],
    ["SCR-AGENCY-005", "Agency Jobs Queue", "Agency", "/agency/jobs", "Admin, DevOps", "Done", "PLAT-UC-007", "1.0", "Platform", "Medium", "—", TODAY, "Background job monitor"],
    ["SCR-AGENCY-006", "KPI Definitions", "Agency", "/agency/kpi-definitions", "Admin, AM", "Done", "SVC-UC-010", "1.0", "Agency", "Medium", "—", TODAY, "Agency-wide KPI formula config"],
    ["SCR-AGENCY-007", "Agency Notifications", "Agency", "/agency/notifications", "AM, Admin", "Done", "ZALO-UC-020", "1.0", "Agency", "Medium", "Prod-S1", TODAY, "Staff notification inbox"],
    # Meta
    ["SCR-META-001", "Facebook Ads Hub", "Meta", "/meta/facebook-ads", "Media Buyer, AM", "Done", "META-UC-001, META-UC-002, META-UC-003", "1.0", "Media", "High", "—", TODAY, "CPL/ROAS hub ✅"],
    ["SCR-META-002", "Meta Intelligence", "Meta", "/meta/intelligence", "Media Buyer, GDKD", "Done", "META-UC-010, META-UC-011", "1.0", "Media", "Medium", "—", TODAY, "Forecast + breakdown"],
    ["SCR-META-003", "Tracking Health & Pixel", "Meta", "/meta/tracking", "Tracking/Tech", "Done", "META-UC-006, META-UC-005", "1.0", "Media", "High", "—", TODAY, "CAPI + pixel test ✅"],
    ["SCR-META-004", "Ads Ops (Launch/Edit)", "Meta", "/meta/ads-ops", "Media Buyer", "Done", "META-UC-007, META-UC-008", "1.0", "Media", "High", "—", TODAY, "Launch wizard + governance"],
    ["SCR-META-005", "Ads Combined (cross-channel)", "Meta", "/meta/ads-combined", "Media Buyer, GDKD", "Done", "SYS-UC-002, ZALO-UC-018", "1.0", "Media", "High", "Z3-7", TODAY, "Meta + Zalo + Google compare ✅"],
    ["SCR-META-006", "Meta API Migration", "Meta", "/meta/migration", "DevOps, Media Buyer", "Draft", "META-UC-014", "0.9", "Media", "Medium", "—", TODAY, "Graph API version migration signoff"],
    # Zalo
    ["SCR-ZALO-001", "Zalo Ads Hub", "Zalo", "/zalo/zalo-ads", "Media Buyer, AM", "Done", "ZALO-UC-001, ZALO-UC-002, ZALO-UC-004", "1.0", "Media", "High", "—", TODAY, "CPL staff view ✅"],
    ["SCR-ZALO-002", "Zalo Leads Inbox", "Zalo", "/zalo/leads", "CSKH, Media Buyer", "Done", "ZALO-UC-011, ZALO-UC-012, ZALO-UC-013", "1.0", "Media", "High", "—", TODAY, "Webhook + poll form ✅"],
    # Email
    ["SCR-EM-001", "Email Hub", "EM", "/email/hub", "Email Strategist, AM", "Done", "EM-UC-001, EM-UC-013", "1.0", "Email", "High", "—", TODAY, "Workspace overview ✅"],
    ["SCR-EM-002", "Email Campaigns", "EM", "/email/campaigns", "Email Strategist", "Done", "EM-UC-006, EM-UC-007", "1.0", "Email", "High", "—", TODAY, "Broadcast F1 + approval ✅"],
    ["SCR-EM-003", "Email Contacts", "EM", "/email/contacts", "Email Strategist", "Done", "EM-UC-002, EM-UC-003, EM-UC-004", "1.0", "Email", "High", "—", TODAY, "Consent + segment ✅"],
    ["SCR-EM-004", "Email Templates", "EM", "/email/templates", "Email Strategist", "Done", "EM-UC-005", "1.0", "Email", "High", "—", TODAY, "Template studio + preflight"],
    ["SCR-EM-005", "Email Journeys", "EM", "/email/journeys", "Email Strategist", "Done", "EM-UC-011", "1.0", "Email", "Medium", "—", TODAY, "Automation activate ✅"],
    ["SCR-EM-006", "Email Governance", "EM", "/email/governance", "Compliance, Admin", "Done", "EM-UC-012", "1.0", "Email", "Medium", "—", TODAY, "Rule CRUD ✅"],
    ["SCR-EM-007", "Email Deliverability", "EM", "/email/deliverability", "Email Strategist, Compliance", "Done", "EM-UC-010", "1.0", "Email", "High", "—", TODAY, "Incident F3 ✅"],
    ["SCR-EM-008", "Email Reports", "EM", "/email/reports", "Email Strategist, AM", "Done", "EM-UC-013", "1.0", "Email", "Medium", "—", TODAY, "Grafana BI export"],
    ["SCR-EM-009", "Email Segments", "EM", "/email/segments", "Email Strategist", "Done", "EM-UC-004", "1.0", "Email", "High", "—", TODAY, "Segment builder RFM/behavior ✅"],
    ["SCR-EM-010", "Suppression List", "EM", "/email/suppression", "Email Strategist, Compliance", "Done", "EM-UC-009", "1.0", "Email", "High", "—", TODAY, "Global suppression per workspace"],
    ["SCR-EM-011", "Consent Log", "EM", "/email/consent", "Compliance", "Done", "EM-UC-002", "1.0", "Email", "High", "—", TODAY, "GDPR consent audit trail"],
    ["SCR-EM-012", "Email Client Workspace", "EM", "/email/clients", "Email Strategist, AM", "Done", "EM-UC-001", "1.0", "Email", "High", "—", TODAY, "Per-client email workspace admin"],
    ["SCR-EM-021", "Chi tiết Email Client Workspace", "EM", "/email/clients/[id]", "Email Strategist, AM", "Done", "EM-UC-001", "1.0", "Email", "High", "—", TODAY, "Overview KPIs + Settings tab (ESP, cap)"],
    ["SCR-EM-013", "Email Gate A (prod cutover)", "EM", "/email/gate-a", "DevOps, Admin", "Done", "SYS-UC-009", "1.0", "Email", "High", "—", TODAY, "PTT_EMAIL_ENABLED soak checklist"],
    ["SCR-EM-014", "Public Confirm (double opt-in)", "EM", "/email/public/confirm/[token]", "End Subscriber", "Done", "EM-UC-002", "1.0", "Email", "High", "—", TODAY, "Tokenized confirm page"],
    ["SCR-EM-015", "Public Preference Center", "EM", "/email/public/preferences/[token]", "End Subscriber", "Done", "EM-UC-014", "1.0", "Email", "High", "—", TODAY, "Preference center public URL"],
    ["SCR-EM-016", "Public Unsubscribe", "EM", "/email/public/unsubscribe/[token]", "End Subscriber", "Done", "EM-UC-009", "1.0", "Email", "High", "—", TODAY, "One-click unsub page"],
    ["SCR-EM-017", "Chi tiết Campaign", "EM", "/email/campaigns/[id]", "Email Strategist", "Done", "EM-UC-006, EM-UC-007", "1.0", "Email", "High", "—", TODAY, "Campaign stats + approval status"],
    ["SCR-EM-018", "Campaign Review", "EM", "/email/campaigns/[id]/review", "Compliance, Client Approver", "Done", "EM-UC-007", "1.0", "Email", "High", "—", TODAY, "Staff/client review preview"],
    ["SCR-EM-019", "Chi tiết Journey", "EM", "/email/journeys/[id]", "Email Strategist", "Done", "EM-UC-011", "1.0", "Email", "Medium", "—", TODAY, "Journey graph editor detail"],
    ["SCR-EM-020", "Chi tiết Template", "EM", "/email/templates/[id]", "Email Strategist", "Done", "EM-UC-005", "1.0", "Email", "High", "—", TODAY, "Template studio detail + preflight"],
    # SEO
    ["SCR-SEO-001", "SEO Hub", "SEO", "/seo/hub", "SEO Strategist, AM", "Done", "SEO-UC-001, SEO-UC-012", "1.0", "SEO", "High", "—", TODAY, "Executive drill-down ✅"],
    ["SCR-SEO-002", "SEO Content Pipeline", "SEO", "/seo/content", "SEO Strategist", "Done", "SEO-UC-005, SEO-UC-006", "1.0", "SEO", "High", "—", TODAY, "Stage advance + governance"],
    ["SCR-SEO-016", "Chi tiết SEO Content (staff)", "SEO", "/seo/content/[id]", "SEO Strategist, Writer", "Done", "SEO-UC-005, SEO-UC-006, PORTAL-UC-007", "1.0", "SEO", "High", "—", TODAY, "Brief/body/versions + approval timeline"],
    ["SCR-SEO-003", "SEO Research", "SEO", "/seo/research", "SEO Strategist", "Done", "SEO-UC-004", "1.0", "SEO", "High", "—", TODAY, "Keyword import ✅"],
    ["SCR-SEO-004", "SEO Technical Audit", "SEO", "/seo/technical", "Tracking/Tech", "Done", "SEO-UC-007", "1.0", "SEO", "High", "—", TODAY, "Issue fix workflow"],
    ["SCR-SEO-005", "SEO Reports", "SEO", "/seo/reports", "SEO Strategist, AM", "Done", "SEO-UC-013", "1.0", "SEO", "High", "—", TODAY, "Client PDF export ✅"],
    ["SCR-SEO-006", "SEO Governance", "SEO", "/seo/governance", "Compliance, Admin", "Done", "SEO-UC-006", "1.0", "SEO", "Medium", "—", TODAY, "Block publish rules"],
    ["SCR-SEO-007", "SEO AEO Scan", "SEO", "/seo/aeo", "SEO Strategist", "Done", "SEO-UC-008", "1.0", "SEO", "Medium", "—", TODAY, "AEO coverage scan ✅"],
    ["SCR-SEO-008", "Rank Tracker", "SEO", "/seo/ranks", "SEO Strategist", "Done", "SEO-UC-011", "1.0", "SEO", "Medium", "—", TODAY, "Daily rank capture + alerts"],
    ["SCR-SEO-009", "Freshness Queue", "SEO", "/seo/freshness", "SEO Strategist", "Done", "SEO-UC-010", "1.0", "SEO", "Medium", "—", TODAY, "Stale content refresh queue"],
    ["SCR-SEO-010", "SEO BI / ClickHouse", "SEO", "/seo/bi", "Admin, BI", "In progress", "SEO-UC-014", "1.0", "SEO", "Medium", "—", TODAY, "ClickHouse export status"],
    ["SCR-SEO-011", "CMS Publish Webhook", "SEO", "/seo/cms", "SEO Strategist, System", "Done", "SEO-UC-009", "1.0", "SEO", "Medium", "—", TODAY, "CMS webhook config + retry"],
    ["SCR-SEO-012", "SEO Client Workspaces", "SEO", "/seo/clients", "SEO Strategist, AM", "Done", "SEO-UC-001", "1.0", "SEO", "High", "—", TODAY, "Per-client SEO workspace list"],
    ["SCR-SEO-017", "Chi tiết SEO Client Workspace", "SEO", "/seo/clients/[id]", "SEO Strategist, AM", "Done", "SEO-UC-001, SEO-UC-002, SEO-UC-003", "1.0", "SEO", "High", "—", TODAY, "GSC/GA4 OAuth + health tiles + tasks"],
    ["SCR-SEO-013", "SEO Strategy", "SEO", "/seo/strategy", "SEO Strategist", "Done", "SEO-UC-004", "1.0", "SEO", "Medium", "—", TODAY, "Strategy brief + keyword themes"],
    ["SCR-SEO-014", "SEO Gate A (prod cutover)", "SEO", "/seo/gate-a", "DevOps, Admin", "Done", "SYS-UC-009", "1.0", "SEO", "High", "—", TODAY, "SEO module soak gate"],
    ["SCR-SEO-015", "SEO Authority / E-E-A-T", "SEO", "/seo/authority", "SEO Strategist", "Done", "SEO-UC-007", "1.0", "SEO", "Medium", "—", TODAY, "Authority signals backlog"],
    ["SCR-SEO-018", "SEO Automations & Alerts", "SEO", "/seo/automations", "SEO Strategist, Admin", "Done", "SEO-UC-011, PLAT-UC-007", "1.0", "SEO", "Medium", "—", TODAY, "Sync runs · open alerts · run checks"],
    ["SCR-SEO-019", "SEO Experiments", "SEO", "/seo/experiments", "SEO Strategist", "Done", "SEO-UC-004", "1.0", "SEO", "Medium", "—", TODAY, "PTT_SEO_EXPERIMENTS_ENABLED flag"],
    # Admin AI
    ["SCR-ADMIN-001", "Admin AI Runs", "Admin", "/admin/ai/runs", "Super Admin", "Done", "AI-UC-009", "1.0", "AI", "High", "RNOS-09", TODAY, "Agent run trace ✅"],
    ["SCR-ADMIN-002", "Admin AI Agents", "Admin", "/admin/ai/agents", "Super Admin", "Done", "AI-UC-010", "1.0", "AI", "Medium", "RNOS-31", TODAY, "Orchestrator config ✅"],
    ["SCR-ADMIN-003", "Admin AI Tools", "Admin", "/admin/ai/tools", "Super Admin", "Done", "AI-UC-020", "1.0", "AI", "Medium", "RNOS-33", TODAY, "Tool registry ✅"],
    ["SCR-ADMIN-004", "CRM Pipeline Config", "Admin", "/admin/crm/pipeline", "Super Admin", "Done", "CRM-UC-009", "1.0", "Product", "Medium", "—", TODAY, "Pipeline stage taxonomy admin"],
    ["SCR-ADMIN-005", "CRM Custom Fields", "Admin", "/admin/crm/custom-fields", "Super Admin", "Done", "CRM-UC-012", "1.0", "Product", "Medium", "—", TODAY, "Custom field definitions CRUD"],
    # Google
    ["SCR-GOOGLE-001", "Google Ads Hub", "Meta", "/google/google-ads", "Media Buyer, AM", "Done", "SVC-UC-008, PLAT-UC-005", "1.0", "Media", "Medium", "—", TODAY, "Channel account map"],
    # Portal (portal-web)
    ["SCR-PORTAL-001", "Portal Dashboard KPI", "Portal", "/dashboard", "Client Viewer", "Done", "PORTAL-UC-001, PORTAL-UC-002", "1.0", "Portal", "High", "—", TODAY, "Multi-module KPI ✅"],
    ["SCR-PORTAL-002", "Portal Login", "Portal", "/login", "Client Viewer", "Done", "PORTAL-UC-001, PORTAL-UC-011, PLAT-UC-003", "1.0", "Portal", "High", "—", TODAY, "Scoped client JWT + forgot password link"],
    ["SCR-PORTAL-003", "Portal Meta Performance", "Portal", "/meta", "Client Viewer", "Done", "PORTAL-UC-003", "1.0", "Portal", "High", "—", TODAY, "CSV export ✅"],
    ["SCR-PORTAL-004", "Portal Creatives Approval", "Portal", "/creatives", "Client Approver", "Done", "PORTAL-UC-006, PORTAL-UC-009, PORTAL-UC-014", "1.0", "Portal", "High", "—", TODAY, "Meta + Zalo creative approval"],
    ["SCR-PORTAL-005", "Portal Email Stats", "Portal", "/email", "Client Viewer", "Done", "PORTAL-UC-005, PORTAL-UC-008", "1.0", "Portal", "Medium", "—", TODAY, "Campaign stats + approvals inbox"],
    ["SCR-PORTAL-006", "Portal SEO Summary", "Portal", "/seo", "Client Viewer", "Done", "PORTAL-UC-004, PORTAL-UC-007", "1.0", "Portal", "Medium", "—", TODAY, "SEO summary hub"],
    ["SCR-PORTAL-007", "Portal Zalo Performance", "Portal", "/zalo", "Client Viewer", "Done", "PORTAL-UC-013, ZALO-UC-005", "1.0", "Portal", "Medium", "Z3-6", TODAY, "Zalo KPI + CSV/PDF export ✅"],
    ["SCR-PORTAL-008", "Portal Google Performance", "Portal", "/google", "Client Viewer", "In progress", "PORTAL-UC-015", "0.9", "Portal", "Medium", "—", TODAY, "Google ads summary read-only"],
    ["SCR-PORTAL-009", "Portal Notifications", "Portal", "/notifications", "Client Viewer", "Done", "PORTAL-UC-010, ZALO-UC-020", "1.0", "Portal", "Medium", "Prod-S1", TODAY, "In-app + milestone notifications"],
    ["SCR-PORTAL-010", "Portal Settings", "Portal", "/settings", "Client Approver", "Done", "PORTAL-UC-010, PORTAL-UC-012", "1.0", "Portal", "Low", "—", TODAY, "Profile + change password + exports"],
    ["SCR-PORTAL-011", "Portal Forgot Password", "Portal", "/forgot-password", "Client Viewer", "Done", "PORTAL-UC-011", "1.0", "Portal", "High", "GAP-P0-02", TODAY, "Self-serve reset request ✅"],
    ["SCR-PORTAL-012", "Portal Reset Password", "Portal", "/reset-password", "Client Viewer", "Done", "PORTAL-UC-011", "1.0", "Portal", "High", "GAP-P0-02", TODAY, "Tokenized password reset ✅"],
    ["SCR-PORTAL-013", "Portal Archived Client", "Portal", "/archived", "Client Viewer", "Done", "PORTAL-UC-001", "1.0", "Portal", "Medium", "—", TODAY, "Archived client login redirect"],
    ["SCR-PORTAL-014", "Portal Email Approvals", "Portal", "/email/approvals", "Client Approver", "Done", "PORTAL-UC-008", "1.0", "Portal", "High", "—", TODAY, "Email campaign approval inbox"],
    ["SCR-PORTAL-015", "Portal Email Campaign Detail", "Portal", "/email/campaigns/[id]", "Client Viewer", "Done", "PORTAL-UC-005", "1.0", "Portal", "Medium", "—", TODAY, "Campaign metrics drill-down"],
    ["SCR-PORTAL-016", "Portal SEO Reports", "Portal", "/seo/reports", "Client Viewer", "Done", "PORTAL-UC-004, PORTAL-UC-010", "1.0", "Portal", "Medium", "—", TODAY, "SEO PDF/report download"],
    ["SCR-PORTAL-017", "Portal SEO Content List", "Portal", "/seo/content", "Client Approver", "Done", "PORTAL-UC-007", "1.0", "Portal", "Medium", "—", TODAY, "Pending SEO content approvals"],
    ["SCR-PORTAL-018", "Portal SEO Content Detail", "Portal", "/seo/content/[id]", "Client Approver", "Done", "PORTAL-UC-007", "1.0", "Portal", "Medium", "—", TODAY, "SEO content preview + approve/reject"],
    # Mobile Experience (cross-cutting PWA)
    ["SCR-MOB-001", "PWA Install Shell (Staff)", "Mobile", "ops-web global", "CSKH, Sales", "Done", "MOB-UC-001", "1.0", "Mobile", "High", "RNOS-41", TODAY, "PwaShell + sw.js ptt-ops-pwa-v1 ✅"],
    ["SCR-MOB-002", "Lead List Mobile", "Mobile", "/crm/leads @ ≤768px", "CSKH, Sales", "Done", "MOB-UC-002, MOB-UC-004", "1.0", "Mobile", "High", "RNOS-41", TODAY, "crm-leads-cards ✅"],
    ["SCR-MOB-003", "Lead Detail Mobile", "Mobile", "/crm/leads/[id] @ mobile", "CSKH", "Done", "MOB-UC-003, MOB-UC-004", "1.0", "Mobile", "High", "RNOS-41", TODAY, "3-tab @<1024 + tel Gọi + offline copilot banner + gate E2E ✅"],
    ["SCR-MOB-004", "CSKH Board Mobile", "Mobile", "/crm/cskh-board @ mobile", "CSKH", "Done", "CRM-UC-008", "1.0", "Mobile", "Medium", "P1-3", TODAY, "cskh-board-cards @768px + gate 11/11 ✅"],
    ["SCR-MOB-005", "Portal Install Shell", "Mobile", "portal-web global", "Client Approver", "Done", "MOB-UC-005", "1.0", "Mobile", "High", "RNOS-M2", TODAY, "PortalPwaShell + ptt-portal-pwa-v1 ✅"],
    ["SCR-MOB-006", "Portal Dashboard Mobile", "Mobile", "/dashboard @ ≤768px", "Client Viewer", "Done", "MOB-UC-008", "1.0", "Mobile", "Medium", "RNOS-M2", TODAY, "Bottom nav + KPI 2-col ✅"],
    ["SCR-MOB-007", "Creative Inbox Mobile", "Mobile", "/creatives @ mobile", "Client Approver", "Done", "MOB-UC-006, MOB-UC-007", "1.0", "Mobile", "High", "RNOS-M2", TODAY, "Approval cards + push deep link"],
    ["SCR-MOB-008", "Email Approvals Mobile", "Mobile", "/email/approvals @ mobile", "Client Approver", "Done", "MOB-UC-007", "1.0", "Mobile", "High", "RNOS-M2", TODAY, "MobileCampaignCards pattern ✅"],
    ["SCR-MOB-009", "Notification Center Mobile", "Mobile", "/notifications @ mobile", "Client Viewer", "Done", "MOB-UC-006", "1.0", "Mobile", "Medium", "RNOS-M2", TODAY, "In-app + push click target"],
    ["SCR-MOB-010", "Push Settings", "Mobile", "/settings (push section)", "Client Approver", "Done", "MOB-UC-009", "1.0", "Mobile", "Medium", "RNOS-M2", TODAY, "usePortalPush + test push ✅"],
]


def _uc(
    uc_id: str,
    name: str,
    screens: str,
    actor: str,
    priority: str,
    status: str,
    pre: str = "",
    post: str = "",
    rules: str = "",
    owner: str = "Product",
    wave: str = "Wave R1",
    trace: str = "—",
) -> list:
    pri_map = {"P0": "High", "P1": "Medium", "P2": "Low"}
    return [uc_id, name, screens, actor, pri_map.get(priority, priority), status, pre, post, rules, owner, wave, trace]


# ── Use Cases [uc_id, name_vn, primary_screens, actor, priority, status, pre, post, rules, owner, wave, trace] ──
USE_CASES: list[list] = [
    # 3.1 System (SYS) — 12 UC
    _uc("SYS-UC-001", "Onboard client mới end-to-end", "SCR-AGENCY-002, SCR-AGENCY-001", "AM / Admin", "P0", "Done", "Contract signed", "Client active all modules", "BR-SYS-001", "Agency", "Wave R1", "SYS-001"),
    _uc("SYS-UC-002", "Closed-loop Spend → Lead → Revenue", "SCR-META-001, SCR-META-005, SCR-CRM-001, SCR-CRM-005", "GDKD / System", "P0", "Done", "Channels connected", "Attribution visible end-to-end", "BR-SYS-002", "Product", "Wave R1", "SYS-002"),
    _uc("SYS-UC-003", "Launch campaign đa kênh có governance", "SCR-SVC-001, SCR-META-004, SCR-SVC-002", "AM / Media Buyer", "P0", "Done", "Launch QA passed", "Campaign live cross-channel", "BR-SYS-003", "Agency", "Wave R1", "SYS-003"),
    _uc("SYS-UC-004", "Client approval cross-module", "SCR-PORTAL-004, SCR-PORTAL-006, SCR-PORTAL-005", "Client Approver", "P0", "Done", "Pending approval item", "Approved/rejected with audit", "BR-SYS-004", "Portal", "Wave R1", "SYS-004"),
    _uc("SYS-UC-005", "Báo cáo định kỳ cho khách hàng", "SCR-PORTAL-001, SCR-PORTAL-003", "AM / System", "P0", "Done", "Reporting period closed", "PDF/CSV delivered to portal", "BR-SYS-005", "Portal", "Wave R1", "SYS-005"),
    _uc("SYS-UC-006", "Offboard client & thu hồi quyền", "SCR-AGENCY-001", "Admin", "P1", "In progress", "Offboard request approved", "Access revoked all modules", "BR-SYS-006", "Agency", "Wave R2", "SYS-006"),
    _uc("SYS-UC-007", "Drill-down executive ≤3 clicks", "SCR-CRM-005, SCR-META-001", "GDKD", "P1", "Done", "KPI tile visible", "Detail reached ≤3 clicks", "BR-SYS-007", "Product", "Wave R2", "RNOS-46"),
    _uc("SYS-UC-008", "Incident P1 — webhook down", "SCR-AGENCY-004", "DevOps / Admin", "P0", "Done", "Webhook SLA breach", "Incident logged + alert sent", "BR-SYS-008", "Platform", "Wave R1", "SYS-008"),
    _uc("SYS-UC-009", "Staged prod cutover module flag", "SCR-ADMIN-002, SCR-EM-013, SCR-SEO-014", "Super Admin", "P1", "Done", "Feature flag configured", "Module enabled per tenant", "BR-SYS-009", "Platform", "Wave R2", "SYS-009"),
    _uc("SYS-UC-010", "Audit trail tra cứu cross-module", "SCR-ADMIN-001", "Compliance / Admin", "P1", "Done", "Audit index populated", "Cross-module query returns hits", "BR-SYS-010", "Platform", "Wave R2", "AI-UC-009"),
    _uc("SYS-UC-011", "Multi-client isolation verify", "SCR-AGENCY-001", "Admin / QA", "P0", "Done", "Multi-tenant data seeded", "No cross-tenant leak", "BR-SYS-011", "Platform", "Wave R1", "SYS-011"),
    _uc("SYS-UC-012", "Hypercare post go-live", "SCR-CRM-004, SCR-AGENCY-001", "AM / CSKH", "P1", "In progress", "Go-live date set", "SLA hypercare tracked 30 days", "BR-SYS-012", "Agency", "Wave R2", "SYS-012"),
    # 3.2 CRM Core (CRM) — 15 UC
    _uc("CRM-UC-001", "Đăng nhập & phân công lead tự động", "SCR-CRM-001, SCR-AUTH-001", "CSKH / System", "P0", "Done", "Assignment rules configured", "Lead có owner primary", "BR-CRM-001", "Product", "Wave R1", "P0-2"),
    _uc("CRM-UC-002", "Chăm sóc lead B2 (Liên hệ OK)", "SCR-CRM-002", "CSKH", "P0", "Done", "Lead status Mới/B1", "Status B2 + activity logged", "BR-CRM-002", "Product", "Wave R1", "—"),
    _uc("CRM-UC-003", "Review queue GDKD", "SCR-CRM-003, SCR-CRM-010", "GDKD", "P0", "Done", "Lead in review queue", "Owner assigned or rejected", "BR-CRM-003", "Agency", "Wave R1", "—"),
    _uc("CRM-UC-004", "Add-on ngành trên lead", "SCR-CRM-002", "CSKH / AM", "P1", "In progress", "Lead có nhu cầu đa ngành", "Add-on lines tracked", "BR-CRM-004", "Product", "Wave R2", "—"),
    _uc("CRM-UC-005", "Pre-sales & KH MKT sơ bộ", "SCR-CRM-012, SCR-CRM-002", "Pre-sales / AM", "P0", "Done", "Lead B2 qualify", "Pre-sales record created", "BR-CRM-005", "Sales", "Wave R1", "—"),
    _uc("CRM-UC-006", "Chuyển lead → Proposal/HĐ", "SCR-CRM-014, SCR-CRM-002", "Sales / AM", "P0", "Done", "Lead qualified", "Proposal linked", "BR-CRM-006", "Sales", "Wave R1", "—"),
    _uc("CRM-UC-007", "Convert → Customer + Case", "SCR-CRM-008, SCR-CRM-009", "Sales / AM", "P0", "Done", "Contract signed", "Customer + case created", "BR-CRM-007", "Sales", "Wave R1", "—"),
    _uc("CRM-UC-008", "Quản lý bảng CSKH", "SCR-CRM-004, SCR-CRM-017", "CSKH", "P0", "Done", "Case CSKH exists", "Kanban SLA accurate", "BR-CRM-008", "CSKH", "Wave R1", "P1-3"),
    _uc("CRM-UC-009", "Pipeline sales & đề xuất", "SCR-CRM-013, SCR-ADMIN-004", "Sales / GDKD", "P1", "In progress", "Deals in pipeline", "Stage advance tracked", "BR-CRM-009", "Sales", "Wave R2", "RNOS-23"),
    _uc("CRM-UC-010", "Dự án BĐS (RE Projects)", "SCR-CRM-015, SCR-CRM-028", "RE PM", "P1", "Done", "RE project configured", "Leads mapped to project", "BR-CRM-010", "RE", "Wave R1", "TC-PROJ-08"),
    _uc("CRM-UC-011", "Hub hợp đồng & lifecycle", "SCR-CRM-010, SCR-CRM-020", "AM / GDKD", "P0", "Done", "Contract exists", "Lifecycle stage visible", "BR-CRM-011", "Product", "Wave R1", "—"),
    _uc("CRM-UC-012", "Catalog dịch vụ/ngành", "SCR-CRM-023, SCR-ADMIN-005", "Admin / AM", "P1", "Done", "Catalog seeded", "Service lines selectable", "BR-CRM-012", "Product", "Wave R2", "—"),
    _uc("CRM-UC-013", "KPI nhân sự & chấm công", "SCR-CRM-011, SCR-CRM-016, SCR-CRM-024, SCR-CRM-026, SCR-CRM-027", "GDKD / HR", "P1", "Done", "Staff roster active", "KPI tiles + export", "BR-CRM-013", "Finance", "Wave R1", "RNOS-42"),
    _uc("CRM-UC-014", "Dashboard kinh doanh chủ DN", "SCR-CRM-005, SCR-CRM-025", "GDKD", "P1", "Done", "Finance data synced", "Executive tiles rendered", "BR-CRM-014", "Finance", "Wave R1", "RNOS-46"),
    _uc("CRM-UC-015", "Import/export lead", "SCR-CRM-001", "Sales / AM", "P1", "Done", "Quyền crm_leads.edit", "File import/export OK", "BR-CRM-015", "Product", "Wave R1", "P0-2"),
    # 3.3 Service Delivery & Agency (SVC) — 12 UC
    _uc("SVC-UC-001", "Workflow lifecycle 7 stage", "SCR-SVC-004, SCR-CRM-029", "AM / PM", "P0", "Done", "Client onboarded", "Stage tracked 7-step", "BR-SVC-001", "Agency", "Wave R1", "—"),
    _uc("SVC-UC-002", "Onboard checklist client", "SCR-AGENCY-001, SCR-AGENCY-002", "AM", "P0", "Done", "New client record", "Checklist items complete", "BR-SVC-002", "Agency", "Wave R1", "SYS-001"),
    _uc("SVC-UC-003", "Deliver stage — TMMT chính thức", "SCR-SVC-004", "AM / PM", "P0", "Done", "Prior stages done", "Deliver milestone signed", "BR-SVC-003", "Agency", "Wave R1", "—"),
    _uc("SVC-UC-004", "Handover → Retain + finance gate", "SCR-CRM-018, SCR-CRM-019, SCR-CRM-020", "AM / Finance", "P0", "Done", "Delivery complete", "Order/invoice + retain", "BR-SVC-004", "Finance", "Wave R1", "RNOS-25"),
    _uc("SVC-UC-005", "Launch QA checklist", "SCR-SVC-001", "AM / Media Buyer", "P0", "Done", "Campaign ready", "QA gate passed", "BR-SVC-005", "Agency", "Wave R1", "SYS-003"),
    _uc("SVC-UC-006", "Creative Hub upload & review", "SCR-SVC-003", "Creative Lead", "P0", "Done", "Brief approved", "Creative version tracked", "BR-SVC-006", "Agency", "Wave R1", "—"),
    _uc("SVC-UC-007", "Campaign Write queue approval", "SCR-SVC-002", "Creative Lead / AM", "P0", "Done", "Write submitted", "Approved copy in queue", "BR-SVC-007", "Agency", "Wave R1", "—"),
    _uc("SVC-UC-008", "Map channel account (Meta/Google)", "SCR-META-001, SCR-GOOGLE-001", "Tracking/Tech", "P0", "Done", "OAuth credentials", "Account mapped to client", "BR-SVC-008", "Media", "Wave R1", "—"),
    _uc("SVC-UC-009", "Agency ingest monitor", "SCR-AGENCY-004", "Admin", "P1", "Done", "Webhooks configured", "Ingest health visible", "BR-SVC-009", "Agency", "Wave R2", "—"),
    _uc("SVC-UC-010", "KPI definitions agency-wide", "SCR-AGENCY-003, SCR-AGENCY-006", "Admin / GDKD", "P1", "Done", "KPI catalog seeded", "Definitions applied reports", "BR-SVC-010", "Agency", "Wave R2", "—"),
    _uc("SVC-UC-011", "SOP & marketing plan", "SCR-SVC-004, SCR-CRM-021, SCR-CRM-022, SCR-CRM-030", "AM", "P1", "In progress", "Client active", "SOP linked to delivery", "BR-SVC-011", "Agency", "Wave R2", "—"),
    _uc("SVC-UC-012", "Offboarding SOP", "SCR-AGENCY-001", "AM / Admin", "P1", "Draft", "Offboard triggered", "SOP checklist complete", "BR-SVC-012", "Agency", "Wave R2", "SYS-006"),
    # 3.4 Meta Enterprise (META) — 14 UC
    _uc("META-UC-001", "Kết nối ad account & sync insights", "SCR-META-001", "Media Buyer / System", "P0", "Done", "OAuth Meta connected", "Insights synced daily", "BR-META-001", "Media", "Wave R1", "—"),
    _uc("META-UC-002", "Hub map campaign ↔ CRM", "SCR-META-001", "Media Buyer", "P0", "Done", "Campaigns synced", "CRM attribution mapped", "BR-META-002", "Media", "Wave R1", "—"),
    _uc("META-UC-003", "Xem CPL/ROAS trên hub", "SCR-META-001", "Media Buyer / AM", "P0", "Done", "Performance data synced", "CPL/ROAS tiles visible", "BR-META-003", "Media", "Wave R1", "SYS-002"),
    _uc("META-UC-004", "Webhook lead Meta → CRM", "SCR-CRM-001, SCR-CRM-015", "System", "P0", "Done", "Webhook endpoint live", "Lead created in CRM", "BR-META-004", "Media", "Wave R1", "PLAT-004"),
    _uc("META-UC-005", "CAPI event gửi & dedup", "SCR-META-003", "Tracking/Tech", "P0", "Done", "Pixel + CAPI configured", "Events deduped", "BR-META-005", "Media", "Wave R1", "—"),
    _uc("META-UC-006", "Tracking health & pixel test", "SCR-META-003", "Tracking/Tech", "P0", "Done", "Pixel installed", "Health score visible", "BR-META-006", "Media", "Wave R1", "—"),
    _uc("META-UC-007", "Launch Ads wizard", "SCR-META-004", "Media Buyer", "P0", "Done", "Creative approved", "Campaign draft created", "BR-META-007", "Media", "Wave R1", "SYS-003"),
    _uc("META-UC-008", "Edit campaign có governance", "SCR-META-004", "Media Buyer", "P0", "Done", "Campaign exists", "Edit logged + approved", "BR-META-008", "Media", "Wave R1", "—"),
    _uc("META-UC-009", "Anomaly detection & alert", "SCR-META-002", "Media Buyer / System", "P1", "Done", "Baseline metrics exist", "Alert sent on anomaly", "BR-META-009", "Media", "Wave R2", "AI-UC-019"),
    _uc("META-UC-010", "Intelligence forecast", "SCR-META-002", "Media Buyer / GDKD", "P1", "Done", "Historical data ≥30d", "Forecast chart rendered", "BR-META-010", "Media", "Wave R2", "—"),
    _uc("META-UC-011", "Breakdown insights (platform/placement)", "SCR-META-002", "Media Buyer", "P1", "Done", "Insights synced", "Breakdown table visible", "BR-META-011", "Media", "Wave R2", "—"),
    _uc("META-UC-012", "Pause domain/client spend emergency", "SCR-META-004", "Admin / GDKD", "P0", "Done", "Emergency trigger", "Spend paused all campaigns", "BR-META-012", "Media", "Wave R1", "—"),
    _uc("META-UC-013", "Weekly client PDF report", "SCR-PORTAL-003", "AM / System", "P1", "Done", "Week closed", "PDF on portal", "BR-META-013", "Portal", "Wave R2", "SYS-005"),
    _uc("META-UC-014", "Horizon migration signoff", "SCR-META-006", "Admin", "P1", "Draft", "Migration plan approved", "Signoff recorded", "BR-META-014", "Media", "Wave R3", "—"),
    # 3.5 SEO/AEO (SEO) — 14 UC
    _uc("SEO-UC-001", "Onboard client SEO workspace", "SCR-SEO-001, SCR-SEO-012, SCR-SEO-017", "SEO Strategist / AM", "P0", "Done", "Client active", "SEO workspace created", "BR-SEO-001", "SEO", "Wave R1", "SYS-001"),
    _uc("SEO-UC-002", "OAuth GSC & sync", "SCR-SEO-001, SCR-SEO-017", "SEO Strategist", "P0", "Done", "GSC property access", "Search data synced", "BR-SEO-002", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-003", "OAuth GA4 & sync", "SCR-SEO-001, SCR-SEO-017", "SEO Strategist", "P0", "Done", "GA4 property access", "Analytics data synced", "BR-SEO-003", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-004", "Research → import keywords", "SCR-SEO-003, SCR-SEO-013, SCR-SEO-019", "SEO Strategist", "P0", "Done", "Research brief ready", "Keywords in pipeline", "BR-SEO-004", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-005", "Content pipeline stage advance", "SCR-SEO-002, SCR-SEO-016", "SEO Strategist", "P0", "Done", "Content item exists", "Stage advanced + audit", "BR-SEO-005", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-006", "Governance block publish", "SCR-SEO-006, SCR-SEO-002, SCR-SEO-016", "Compliance", "P0", "Done", "Governance rule active", "Publish blocked if fail", "BR-SEO-006", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-007", "Technical audit & issue fix", "SCR-SEO-004, SCR-SEO-015", "Tracking/Tech", "P0", "Done", "Site crawled", "Issues tracked to fix", "BR-SEO-007", "SEO", "Wave R1", "—"),
    _uc("SEO-UC-008", "AEO scan & coverage", "SCR-SEO-007", "SEO Strategist", "P1", "Done", "AEO targets defined", "Coverage score visible", "BR-SEO-008", "SEO", "Wave R2", "—"),
    _uc("SEO-UC-009", "CMS publish webhook", "SCR-SEO-002, SCR-SEO-011", "System", "P1", "Done", "CMS webhook configured", "Content status synced", "BR-SEO-009", "SEO", "Wave R2", "—"),
    _uc("SEO-UC-010", "Freshness queue refresh", "SCR-SEO-002, SCR-SEO-009", "SEO Strategist", "P1", "Done", "Stale content flagged", "Refresh queue populated", "BR-SEO-010", "SEO", "Wave R2", "—"),
    _uc("SEO-UC-011", "Rank tracker capture", "SCR-SEO-001, SCR-SEO-008, SCR-SEO-018", "SEO Strategist / System", "P1", "Done", "Keywords tracked", "Rank history stored", "BR-SEO-011", "SEO", "Wave R2", "—"),
    _uc("SEO-UC-012", "Executive hub drill-down", "SCR-SEO-001", "GDKD / AM", "P0", "Done", "Hub data synced", "Drill-down ≤3 clicks", "BR-SEO-012", "SEO", "Wave R1", "SYS-007"),
    _uc("SEO-UC-013", "Client PDF report export", "SCR-SEO-005, SCR-PORTAL-006, SCR-PORTAL-016", "AM / SEO Strategist", "P0", "Done", "Reporting period closed", "PDF export OK", "BR-SEO-013", "SEO", "Wave R1", "SYS-005"),
    _uc("SEO-UC-014", "ClickHouse BI export", "SCR-SEO-005, SCR-SEO-010", "Admin / BI", "P1", "In progress", "ClickHouse connected", "BI export scheduled", "BR-SEO-014", "SEO", "Wave R3", "—"),
    # 3.6 Email Marketing (EM) — 14 UC
    _uc("EM-UC-001", "Onboard email workspace & domain", "SCR-EM-001, SCR-EM-012, SCR-EM-021", "Email Strategist / AM", "P0", "Done", "Domain verified", "Workspace active", "BR-EM-001", "Email", "Wave R1", "SYS-001"),
    _uc("EM-UC-002", "Capture form → consent", "SCR-EM-003, SCR-EM-011, SCR-EM-014", "System / End Subscriber", "P0", "Done", "Form embedded", "Contact + consent logged", "BR-EM-002", "Email", "Wave R1", "—"),
    _uc("EM-UC-003", "Import contacts CSV", "SCR-EM-003", "Email Strategist", "P0", "Done", "CSV template valid", "Contacts imported", "BR-EM-003", "Email", "Wave R1", "—"),
    _uc("EM-UC-004", "Segment compute (RFM/behavior)", "SCR-EM-003, SCR-EM-009", "Email Strategist / System", "P0", "Done", "Contact data populated", "Segments computed", "BR-EM-004", "Email", "Wave R1", "—"),
    _uc("EM-UC-005", "Template studio + preflight", "SCR-EM-004, SCR-EM-020", "Email Strategist", "P0", "Done", "Brand assets ready", "Template passes preflight", "BR-EM-005", "Email", "Wave R1", "—"),
    _uc("EM-UC-006", "Campaign broadcast F1", "SCR-EM-002, SCR-EM-017", "Email Strategist", "P0", "Done", "Template + segment ready", "Campaign scheduled/sent", "BR-EM-006", "Email", "Wave R1", "—"),
    _uc("EM-UC-007", "Staff + client approval", "SCR-EM-002, SCR-EM-017, SCR-EM-018, SCR-PORTAL-014, SCR-PORTAL-015", "Email Strategist / Client Approver", "P0", "Done", "Campaign draft ready", "Dual approval recorded", "BR-EM-007", "Email", "Wave R1", "SYS-004"),
    _uc("EM-UC-008", "ESP send & webhook engagement", "SCR-EM-002", "System", "P0", "Done", "Campaign approved", "Engagement events logged", "BR-EM-008", "Email", "Wave R1", "PLAT-006"),
    _uc("EM-UC-009", "Suppression & one-click unsub", "SCR-EM-003, SCR-EM-010, SCR-EM-016", "System / End Subscriber", "P0", "Done", "Suppression list active", "Unsub honored globally", "BR-EM-009", "Email", "Wave R1", "—"),
    _uc("EM-UC-010", "Deliverability incident F3", "SCR-EM-007", "Email Strategist / Compliance", "P0", "Done", "Bounce/spam spike detected", "Incident workflow triggered", "BR-EM-010", "Email", "Wave R1", "—"),
    _uc("EM-UC-011", "Journey automation activate", "SCR-EM-005, SCR-EM-019", "Email Strategist", "P1", "Done", "Journey designed", "Automation live", "BR-EM-011", "Email", "Wave R2", "—"),
    _uc("EM-UC-012", "Governance rule CRUD", "SCR-EM-006", "Compliance / Admin", "P1", "Done", "Admin access", "Rules saved + enforced", "BR-EM-012", "Email", "Wave R2", "—"),
    _uc("EM-UC-013", "Reports & Grafana BI", "SCR-EM-008", "Email Strategist / AM", "P1", "Done", "Campaign data exists", "Reports exported", "BR-EM-013", "Email", "Wave R2", "—"),
    _uc("EM-UC-014", "Public preference center", "SCR-EM-003, SCR-EM-015", "End Subscriber", "P0", "Done", "Token valid", "Preferences updated", "BR-EM-014", "Email", "Wave R1", "—"),
    # 3.7 Client Portal (PORTAL) — 15 UC
    _uc("PORTAL-UC-001", "Login portal scoped client", "SCR-PORTAL-002, SCR-PORTAL-013", "Client Viewer", "P0", "Done", "Portal account active", "JWT scoped to client", "BR-PORTAL-001", "Portal", "Wave R1", "PLAT-003"),
    _uc("PORTAL-UC-002", "Dashboard KPI multi-module", "SCR-PORTAL-001", "Client Viewer", "P0", "Done", "Modules enabled", "KPI tiles rendered", "BR-PORTAL-002", "Portal", "Wave R1", "—"),
    _uc("PORTAL-UC-003", "Meta performance view + CSV", "SCR-PORTAL-003", "Client Viewer", "P0", "Done", "Meta data synced", "Chart + CSV export", "BR-PORTAL-003", "Portal", "Wave R1", "—"),
    _uc("PORTAL-UC-004", "SEO summary view", "SCR-PORTAL-006, SCR-PORTAL-016", "Client Viewer", "P1", "Done", "SEO data synced", "Summary visible", "BR-PORTAL-004", "Portal", "Wave R2", "—"),
    _uc("PORTAL-UC-005", "Email campaign stats", "SCR-PORTAL-005, SCR-PORTAL-015", "Client Viewer", "P1", "Done", "Campaign sent", "Stats visible", "BR-PORTAL-005", "Portal", "Wave R2", "—"),
    _uc("PORTAL-UC-006", "Approval inbox Meta creative", "SCR-PORTAL-004", "Client Approver", "P0", "Done", "Creative pending", "Approved/rejected", "BR-PORTAL-006", "Portal", "Wave R1", "SYS-004"),
    _uc("PORTAL-UC-007", "Approval SEO content", "SCR-PORTAL-017, SCR-PORTAL-018", "Client Approver", "P1", "Done", "Content pending", "Approval recorded", "BR-PORTAL-007", "Portal", "Wave R2", "—"),
    _uc("PORTAL-UC-008", "Approval email campaign", "SCR-PORTAL-014", "Client Approver", "P1", "Done", "Campaign pending", "Approval recorded", "BR-PORTAL-008", "Portal", "Wave R2", "SYS-004"),
    _uc("PORTAL-UC-009", "Reject with comment", "SCR-PORTAL-004", "Client Approver", "P0", "Done", "Item pending", "Reject + comment saved", "BR-PORTAL-009", "Portal", "Wave R1", "—"),
    _uc("PORTAL-UC-010", "Export & download artifact", "SCR-PORTAL-010, SCR-PORTAL-016", "Client Viewer", "P0", "Done", "Artifact available", "File downloaded", "BR-PORTAL-010", "Portal", "Wave R1", "—"),
    _uc("PORTAL-UC-011", "Quên mật khẩu / reset", "SCR-PORTAL-002, SCR-PORTAL-011, SCR-PORTAL-012", "Client Viewer", "P0", "Done", "Portal account active", "Password reset completed", "BR-PORTAL-011", "Portal", "Wave R1", "GAP-P0-02"),
    _uc("PORTAL-UC-012", "Đổi mật khẩu khi đã login", "SCR-PORTAL-010", "Client Viewer", "P1", "Done", "Logged in portal session", "Password hash updated", "BR-PORTAL-012", "Portal", "Wave R2", "—"),
    _uc("PORTAL-UC-013", "Zalo performance view + export", "SCR-PORTAL-007", "Client Viewer", "P0", "Done", "zalo_enabled flag", "KPI + CSV/PDF export scoped", "BR-PORTAL-013", "Portal", "Wave R1", "ZALO-005"),
    _uc("PORTAL-UC-014", "Zalo creative approval", "SCR-PORTAL-004", "Client Approver", "P1", "Done", "Creative pending channel=zalo", "Approved/rejected with audit", "BR-PORTAL-014", "Portal", "Wave R2", "ZALO-019"),
    _uc("PORTAL-UC-015", "Google performance view", "SCR-PORTAL-008", "Client Viewer", "P1", "In progress", "google_enabled flag", "Read-only Google KPI visible", "BR-PORTAL-015", "Portal", "Wave R2", "—"),
    # 3.8 Platform (PLAT) — 10 UC
    _uc("PLAT-UC-001", "Staff JWT login & refresh", "SCR-AUTH-001", "Staff", "P0", "Done", "Account active", "JWT + refresh token issued", "BR-PLAT-001", "Platform", "Wave R1", "TC-AUTH-01"),
    _uc("PLAT-UC-002", "RBAC cap enforcement", "SCR-AUTH-001", "All staff", "P0", "Done", "Caps assigned", "403 on unauthorized route", "BR-PLAT-002", "Platform", "Wave R1", "—"),
    _uc("PLAT-UC-003", "Portal JWT login", "SCR-PORTAL-002", "Client Viewer", "P0", "Done", "Portal account active", "Scoped JWT issued", "BR-PLAT-003", "Portal", "Wave R1", "PORTAL-001"),
    _uc("PLAT-UC-004", "Webhook Meta ingest", "SCR-AGENCY-004", "System", "P0", "Done", "Webhook secret configured", "Lead/event persisted", "BR-PLAT-004", "Platform", "Wave R1", "META-004"),
    _uc("PLAT-UC-005", "Webhook Zalo/Google ingest", "SCR-AGENCY-004", "System", "P0", "Done", "Endpoint configured", "Payload normalized", "BR-PLAT-005", "Platform", "Wave R1", "ZALO-011"),
    _uc("PLAT-UC-006", "Webhook Email ESP ingest", "SCR-AGENCY-004", "System", "P0", "Done", "ESP webhook configured", "Engagement events stored", "BR-PLAT-006", "Platform", "Wave R1", "EM-008"),
    _uc("PLAT-UC-007", "Job queue worker process", "SCR-AGENCY-005", "System", "P0", "Done", "Queue configured", "Jobs processed + retry", "BR-PLAT-007", "Platform", "Wave R1", "—"),
    _uc("PLAT-UC-008", "Temporal approval workflow", "SCR-SVC-002", "System", "P1", "In progress", "Temporal connected", "Workflow completes", "BR-PLAT-008", "Platform", "Wave R2", "—"),
    _uc("PLAT-UC-009", "Seed staff permissions", "SCR-AUTH-001", "Super Admin", "P0", "Done", "Seed script run", "Caps applied all roles", "BR-PLAT-009", "Platform", "Wave R1", "—"),
    _uc("PLAT-UC-010", "Health check & soak evidence", "SCR-AGENCY-004", "DevOps", "P1", "Done", "Staging/prod deployed", "Health endpoints pass", "BR-PLAT-010", "Platform", "Wave R2", "—"),
    # 3.9 Zalo Ads (ZALO) — 21 UC
    _uc("ZALO-UC-001", "Kết nối Zalo Ads / OA", "SCR-ZALO-001", "Media Buyer", "P0", "Done", "Zalo OAuth OK", "Account connected", "BR-ZALO-001", "Media", "Wave R1", "—"),
    _uc("ZALO-UC-002", "Hub map campaign", "SCR-ZALO-001", "Media Buyer", "P0", "Done", "Campaigns synced", "CRM map visible", "BR-ZALO-002", "Media", "Wave R1", "—"),
    _uc("ZALO-UC-003", "Sync insights → daily_performance", "SCR-ZALO-001", "System", "P0", "Done", "API credentials valid", "Daily metrics stored", "BR-ZALO-003", "Media", "Wave R1", "—"),
    _uc("ZALO-UC-004", "Hub CPL staff", "SCR-ZALO-001", "Media Buyer / AM", "P0", "Done", "Performance synced", "CPL tiles visible", "BR-ZALO-004", "Media", "Wave R1", "—"),
    _uc("ZALO-UC-005", "Portal performance", "SCR-PORTAL-007", "Client Viewer", "P0", "Done", "Portal enabled", "Zalo KPI on portal", "BR-ZALO-005", "Portal", "Wave R1", "PORTAL-013"),
    _uc("ZALO-UC-006", "Brief chiến dịch", "SCR-ZALO-001", "AM / Media Buyer", "P1", "Done", "Client brief ready", "Brief saved", "BR-ZALO-006", "Media", "Wave R2", "—"),
    _uc("ZALO-UC-007", "Tạo campaign draft", "SCR-ZALO-001", "Media Buyer", "P1", "In progress", "Brief approved", "Draft campaign created", "BR-ZALO-007", "Media", "Wave R2", "—"),
    _uc("ZALO-UC-008", "Duyệt nội dung", "SCR-ZALO-001", "Creative Lead", "P1", "Done", "Content submitted", "Approval recorded", "BR-ZALO-008", "Media", "Wave R2", "—"),
    _uc("ZALO-UC-009", "Triển khai lên Zalo (API)", "SCR-ZALO-001", "Media Buyer", "P2", "Draft", "Draft approved", "Campaign live on Zalo", "BR-ZALO-009", "Media", "Wave R3", "—"),
    _uc("ZALO-UC-010", "Pause/update/stop campaign", "SCR-ZALO-001", "Media Buyer", "P2", "Draft", "Campaign live", "Status updated via API", "BR-ZALO-010", "Media", "Wave R3", "—"),
    _uc("ZALO-UC-011", "Webhook lead → CRM", "SCR-ZALO-002, SCR-CRM-001", "System", "P0", "Done", "Webhook configured", "Lead in CRM", "BR-ZALO-011", "Media", "Wave R1", "PLAT-005"),
    _uc("ZALO-UC-012", "Poll form lead API", "SCR-ZALO-002", "System", "P0", "Done", "Form API credentials", "Leads polled on SLA", "BR-ZALO-012", "Media", "Wave R1", "—"),
    _uc("ZALO-UC-013", "Dedup & chuẩn hóa lead", "SCR-ZALO-002", "System", "P0", "Done", "Lead ingest active", "Dedup by phone/email", "BR-ZALO-013", "Media", "Wave R1", "CRM-001"),
    _uc("ZALO-UC-014", "CRM pipeline", "SCR-CRM-001, SCR-ZALO-002", "CSKH", "P0", "Done", "Lead assigned", "Pipeline stage tracked", "BR-ZALO-014", "Product", "Wave R1", "—"),
    _uc("ZALO-UC-015", "CRM status sync hub", "SCR-ZALO-001", "System", "P1", "Done", "CRM status changed", "Hub reflects status", "BR-ZALO-015", "Media", "Wave R2", "—"),
    _uc("ZALO-UC-016", "Xuất báo cáo KH", "SCR-PORTAL-007", "AM", "P1", "Done", "Period closed", "Report on portal", "BR-ZALO-016", "Portal", "Wave R2", "SYS-005"),
    _uc("ZALO-UC-017", "Cảnh báo bất thường", "SCR-ZALO-001", "Media Buyer / System", "P1", "Done", "Baseline exists", "Alert on CPL spike", "BR-ZALO-017", "Media", "Wave R2", "AI-UC-019"),
    _uc("ZALO-UC-018", "Phân tích đa chiều", "SCR-ZALO-001", "Media Buyer", "P2", "Draft", "Data ≥30d", "Multi-dim chart", "BR-ZALO-018", "Media", "Wave R3", "—"),
    _uc("ZALO-UC-019", "Client duyệt budget", "SCR-PORTAL-004, SCR-PORTAL-007", "Client Approver", "P1", "In progress", "Budget proposal ready", "Approval recorded", "BR-ZALO-019", "Portal", "Wave R2", "PORTAL-014"),
    _uc("ZALO-UC-020", "Thông báo tiến độ", "SCR-PORTAL-009, SCR-AGENCY-007", "Client Viewer", "P1", "Done", "Event occurred", "Notification delivered", "BR-ZALO-020", "Portal", "Wave R2", "—"),
    _uc("ZALO-UC-021", "Onboard orchestrator Zalo", "SCR-AGENCY-001, SCR-ZALO-001", "AM", "P1", "Done", "Client onboarded", "Zalo module enabled", "BR-ZALO-021", "Agency", "Wave R2", "SYS-001"),
    # 3.10 AI Revenue OS (AI) — 20 UC
    _uc("AI-UC-001", "Lead score async sau ingest", "SCR-CRM-001, SCR-CRM-002", "System", "P0", "Done", "Lead created + flag on", "Score persisted ≤30s", "BR-AI-001", "AI", "Wave R1", "RNOS-04"),
    _uc("AI-UC-002", "Copilot — Lead brief", "SCR-CRM-002", "CSKH / Sales", "P0", "Done", "Copilot enabled + owner", "Brief 5 bullets displayed", "BR-AI-002", "AI", "Wave R1", "RNOS-06"),
    _uc("AI-UC-003", "Copilot — Summarize activity", "SCR-CRM-002", "CSKH", "P0", "Done", "Activity text ≥50 chars", "Summary + extracted fields", "BR-AI-003", "AI", "Wave R1", "RNOS-03"),
    _uc("AI-UC-004", "Follow-up draft + approve", "SCR-CRM-002", "CSKH", "P0", "Done", "Lead context available", "Draft saved, not auto-sent", "BR-AI-004", "AI", "Wave R1", "RNOS-06"),
    _uc("AI-UC-005", "Xem score + explainability", "SCR-CRM-002, SCR-AI-001", "CSKH / GDKD", "P0", "Done", "Score exists", "Factors +/- visible", "BR-AI-005", "AI", "Wave R1", "—"),
    _uc("AI-UC-006", "Manager override score", "SCR-CRM-002", "GDKD", "P1", "Done", "Cap assign + score exists", "Override audited", "BR-AI-006", "AI", "Wave R1", "UI-R1-08"),
    _uc("AI-UC-007", "Dismiss recommendation + reason", "SCR-CRM-002, SCR-AI-001", "CSKH", "P1", "Done", "Recommendation exists", "Dismiss reason saved", "BR-AI-007", "AI", "Wave R2", "RNOS-29"),
    _uc("AI-UC-008", "Timeline enrich cho AI context", "SCR-CRM-009", "System", "P0", "Done", "Customer events exist", "Timeline indexed for AI", "BR-AI-008", "AI", "Wave R1", "RNOS-16"),
    _uc("AI-UC-009", "AI audit / agent run trace", "SCR-ADMIN-001", "Admin / Compliance", "P0", "Done", "AI calls logged", "Run trace searchable", "BR-AI-009", "AI", "Wave R1", "RNOS-09"),
    _uc("AI-UC-010", "Pilot gate / feature flag", "SCR-ADMIN-002", "Super Admin", "P0", "Done", "Flag configured", "Pilot tenant isolated", "BR-AI-010", "AI", "Wave R1", "RNOS-39"),
    _uc("AI-UC-011", "NBA trên deal stalled", "SCR-CRM-013", "CSKH / System", "P0", "Done", "Deal stalled detected", "NBA recommendation shown", "BR-AI-011", "AI", "Wave R2", "RNOS-09"),
    _uc("AI-UC-012", "Deal score", "SCR-CRM-013", "Sales / GDKD", "P1", "Done", "Deal in pipeline", "Deal score computed", "BR-AI-012", "AI", "Wave R2", "RNOS-09"),
    _uc("AI-UC-013", "Forecast commit", "SCR-CRM-006", "GDKD / Finance", "P1", "Done", "Pipeline data synced", "Forecast snapshot committed", "BR-AI-013", "AI", "Wave R3", "RNOS-17"),
    _uc("AI-UC-014", "Renewal agent workflow", "SCR-CRM-009", "AM / System", "P1", "Done", "Contract near expiry", "Renewal task created", "BR-AI-014", "AI", "Wave R3", "RNOS-20"),
    _uc("AI-UC-015", "Pipeline risk & smart reminder", "SCR-CRM-013", "Sales / System", "P1", "Done", "Risk signals detected", "Reminder sent", "BR-AI-015", "AI", "Wave R2", "RNOS-23"),
    _uc("AI-UC-016", "NL analytics curated", "SCR-AI-002", "GDKD", "P2", "Done", "Curated schema ready", "NL answer returned", "BR-AI-016", "AI", "Wave R3", "RNOS-22"),
    _uc("AI-UC-017", "Churn & CS health score", "SCR-CRM-007", "AM / CSKH", "P1", "Done", "Customer data synced", "Health score visible", "BR-AI-017", "AI", "Wave R3", "RNOS-19"),
    _uc("AI-UC-018", "Manager coach weekly digest", "SCR-AI-003", "GDKD", "P2", "Done", "Team activity exists", "Digest email/in-app sent", "BR-AI-018", "AI", "Wave R3", "RNOS-21"),
    _uc("AI-UC-019", "Channel CPL/ROAS anomaly digest", "SCR-AI-001, SCR-META-001", "GDKD / System", "P2", "Done", "Channel metrics ≥7d", "Anomaly digest delivered", "BR-AI-019", "AI", "Wave R4", "RNOS-28"),
    _uc("AI-UC-020", "Workflow AI node simulate + publish", "SCR-AI-004, SCR-AI-005", "Admin / AM", "P1", "Done", "Workflow designed", "AI node published", "BR-AI-020", "AI", "Wave R2", "RNOS-13"),
    # 3.11 Mobile Experience (MOB) — 10 UC
    _uc("MOB-UC-001", "Cài PWA staff", "SCR-MOB-001", "CSKH / Sales", "P0", "Done", "Staff login OK", "PWA installed start /crm/leads", "BR-MOB-01", "Mobile", "RNOS-M1", "RNOS-41"),
    _uc("MOB-UC-002", "Xem danh sách lead mobile", "SCR-MOB-002", "CSKH", "P0", "Done", "cap crm_leads.view", "Card list rendered", "BR-MOB-02", "Mobile", "RNOS-M1", "RNOS-41"),
    _uc("MOB-UC-003", "Xem chi tiết + AI brief lead", "SCR-MOB-003", "CSKH", "P0", "Done", "Lead exists", "Brief displayed copy-only", "BR-MOB-04", "Mobile", "RNOS-M1", "AI-UC-002"),
    _uc("MOB-UC-004", "Offline đọc lead đã cache", "SCR-MOB-002, SCR-MOB-003", "CSKH", "P1", "Done", "SW precache visited", "Read-only offline shell", "BR-MOB-02", "Mobile", "RNOS-M1", "RNOS-41"),
    _uc("MOB-UC-005", "Cài PWA portal", "SCR-MOB-005", "Client Approver", "P0", "Done", "Portal JWT", "Portal PWA standalone", "BR-MOB-01", "Mobile", "RNOS-M2", "RNOS-M2"),
    _uc("MOB-UC-006", "Nhận push duyệt creative", "SCR-MOB-007, SCR-MOB-009", "Client Approver", "P0", "Done", "Push subscribed", "Notification + inbox", "BR-MOB-03", "Mobile", "RNOS-M2", "PORTAL-UC-006"),
    _uc("MOB-UC-007", "Duyệt email campaign mobile", "SCR-MOB-008", "Client Approver", "P0", "Done", "Pending email campaign", "Approval recorded", "BR-PORTAL-008", "Mobile", "RNOS-M2", "PORTAL-UC-008"),
    _uc("MOB-UC-008", "Xem KPI dashboard mobile", "SCR-MOB-006", "Client Viewer", "P1", "Done", "Modules enabled", "KPI cards mobile", "BR-PORTAL-002", "Mobile", "RNOS-M2", "PORTAL-UC-002"),
    _uc("MOB-UC-009", "Quản lý subscription push", "SCR-MOB-010", "Client Approver", "P1", "Done", "VAPID configured", "Subscription in PG", "BR-MOB-03", "Mobile", "RNOS-M2", "RNOS-M2"),
    _uc("MOB-UC-010", "Deep link từ email/SMS", "SCR-MOB-007, SCR-MOB-008", "Client Approver", "P2", "Backlog", "Valid link token", "Approval screen loaded", "BR-MOB-01", "Mobile", "RNOS-M3", "Capacitor"),
]

# ── Screen detail blocks (P0) ──
SCREEN_DETAILS: dict[str, dict] = {
    "SCR-CRM-001": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-001"),
            ("Tên màn hình", "Quản lý Lead (danh sách)"),
            ("Route", "/crm/leads"),
            ("Module", "MOD-CRM — CRM Core"),
            ("Mục đích", "Xem, tìm kiếm, import/export và chọn lead để xử lý tiếp"),
            ("Vai trò", "Sales, AM, Admin (cap crm_leads.view/edit/assign)"),
            ("Điều kiện trước", "Đã đăng nhập ops-web + quyền crm_leads.view"),
            ("Điều kiện sau", "Danh sách lead phản ánh đúng filter/search/pagination"),
            ("Use case liên quan", "CRM-UC-001, CRM-UC-002, CRM-UC-015"),
            ("API liên quan", "GET /api/v1/leads · POST import · GET export · GET /api/v1/ai/scores/batch"),
            ("Parity ID", "P0-2 (Import/export Excel)"),
            ("Trạng thái triển khai", "Done — filter chips ○ · bulk assign ○"),
            ("Ghi chú", "Page size 50 · cột AI Score pilot cohort ✅"),
        ],
        "ui": [
            [1, "OpsNav sidebar", "Navigation", "Có", "Menu CRM + badge review queue"],
            [2, "Ô search", "Input", "Không", "Tìm theo tên, SĐT, email"],
            [3, "CrmLeadsImportExport", "Toolbar", "Không", "Import/Export Excel — P0-2 ✅"],
            [4, "CrmLeadsList table", "Table", "Có", "Checkbox select · pagination · score badge"],
            [5, "Cột AI Score", "Badge", "Không", "hot/warm/cold — RNOS-04 ✅"],
            [6, "Link chi tiết lead", "Link", "Có", "Navigate /crm/leads/[id]"],
        ],
        "rules": ["BR-CRM-001", "BR-CRM-002", "BR-CRM-015"],
    },
    "SCR-CRM-002": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-002"),
            ("Tên màn hình", "Chi tiết Lead"),
            ("Route", "/crm/leads/[id]"),
            ("Module", "MOD-CRM + MOD-AI"),
            ("Mục đích", "Quản lý vòng đời lead: activity, funnel, contract, AI copilot"),
            ("Vai trò", "Sales, AM, GDKD (override score)"),
            ("Điều kiện trước", "Lead ID hợp lệ + quyền view"),
            ("Điều kiện sau", "Thay đổi được lưu · copilot phản hồi đúng guard"),
            ("Use case liên quan", "CRM-UC-002, AI-UC-001, AI-UC-002, AI-UC-003, AI-UC-004"),
            ("API liên quan", "GET/PATCH /api/v1/leads/:id · POST /api/v1/ai/score/lead/override · PATCH /api/v1/ai/recommendations/:id"),
            ("Parity ID", "UI-R1-08 · RNOS-06"),
            ("Trạng thái triển khai", "Done — upload file ○"),
            ("Ghi chú", "LeadAttributionChips → Meta hub deep link ✅"),
        ],
        "ui": [
            [1, "LeadAttributionChips", "Chips", "Không", "Campaign / CPL attribution"],
            [2, "LeadFunnelPanel", "Panel", "Có", "Presales workflow steps"],
            [3, "LeadContractPanel", "Panel", "Không", "Hợp đồng / proposal link"],
            [4, "LeadCopilotPanel", "AI Panel", "Không", "Score · brief · follow-up draft"],
            [5, "ScoreOverrideModal", "Modal", "Không", "GDKD 0–100 + reason ≥10"],
            [6, "DismissReasonModal", "Modal", "Không", "Preset dismiss reason RNOS-29"],
            [7, "Activity timeline", "Timeline", "Có", "Ghi chú · status change"],
        ],
        "rules": ["BR-CRM-001", "BR-CRM-002", "BR-AI-001", "BR-AI-004", "BR-AI-006"],
    },
    "SCR-CRM-003": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-003"),
            ("Tên màn hình", "Phải tra soát (Review Queue)"),
            ("Route", "/crm/leads/review-queue"),
            ("Module", "MOD-CRM"),
            ("Mục đích", "GDKD duyệt/reassign lead high-value hoặc không match rule"),
            ("Vai trò", "GDKD, Head Sales, Admin"),
            ("Use case liên quan", "CRM-UC-003"),
            ("Trạng thái triển khai", "Done — agency tenant only"),
        ],
        "ui": [
            [1, "Review queue table", "Table", "Có", "Lead summary · source · value"],
            [2, "Approve assign", "Button", "Có", "Chọn owner + priority"],
            [3, "Reject modal", "Modal", "Không", "Comment bắt buộc khi reject"],
            [4, "Filter reason", "Select", "Không", "High value / no owner / policy"],
        ],
        "rules": ["BR-CRM-003"],
    },
    "SCR-CRM-004": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-004"),
            ("Tên màn hình", "Bảng CSKH SLA"),
            ("Route", "/crm/cskh-board"),
            ("Module", "MOD-CRM"),
            ("Mục đích", "Theo dõi case CSKH theo Kanban SLA breach"),
            ("Vai trò", "CSKH, Admin"),
            ("Điều kiện trước", "Case CSKH tồn tại · quyền cskh.view"),
            ("Điều kiện sau", "Cột Kanban phản ánh SLA realtime"),
            ("Use case liên quan", "CRM-UC-008"),
            ("API liên quan", "GET /api/v1/cskh/board · PATCH /api/v1/cskh/cases/:id"),
            ("Trạng thái triển khai", "Done"),
            ("Ghi chú", "SLA breach highlight đỏ/vàng ✅"),
        ],
        "ui": [
            [1, "KanbanBoard", "Board", "Có", "Cột theo trạng thái SLA"],
            [2, "CaseCard", "Card", "Có", "Lead ref · owner · due time"],
            [3, "SLA badge", "Badge", "Có", "Xanh/vàng/đỏ theo breach"],
            [4, "Filter owner", "Select", "Không", "Lọc theo CSKH assigned"],
            [5, "Quick assign", "Action", "Không", "Reassign case"],
        ],
        "rules": ["BR-CRM-008"],
    },
    "SCR-CRM-005": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-005"),
            ("Tên màn hình", "Dashboard kinh doanh chủ DN"),
            ("Route", "/crm/business-dashboard"),
            ("Module", "MOD-CRM"),
            ("Mục đích", "Tổng quan doanh thu, pipeline, KPI executive"),
            ("Vai trò", "GDKD, Admin"),
            ("Use case liên quan", "CRM-UC-014, SYS-UC-007"),
            ("API liên quan", "GET /api/v1/crm/business-dashboard"),
            ("Trạng thái triển khai", "Done — RNOS-46 gate ✅"),
            ("Ghi chú", "Drill-down ≤3 clicks"),
        ],
        "ui": [
            [1, "Revenue tiles", "KPI Tile", "Có", "Doanh thu · margin · forecast"],
            [2, "Pipeline funnel", "Chart", "Có", "Stage conversion"],
            [3, "Channel mix", "Chart", "Không", "Meta/Zalo/Google split"],
            [4, "Drill-down link", "Link", "Có", "→ chi tiết module"],
        ],
        "rules": ["BR-CRM-014", "BR-SYS-007"],
    },
    "SCR-CRM-006": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-006"),
            ("Tên màn hình", "Dự báo doanh thu (Forecast)"),
            ("Route", "/crm/forecast"),
            ("Module", "MOD-AI"),
            ("Mục đích", "Commit forecast snapshot theo pipeline"),
            ("Vai trò", "GDKD, Finance"),
            ("Use case liên quan", "AI-UC-013"),
            ("API liên quan", "GET/POST /api/v1/ai/forecast"),
            ("Trạng thái triển khai", "Done — RNOS-17 ✅"),
        ],
        "ui": [
            [1, "Forecast chart", "Chart", "Có", "Commit vs target"],
            [2, "Commit button", "Button", "Có", "Snapshot forecast period"],
            [3, "Scenario selector", "Select", "Không", "Best/base/worst"],
            [4, "Deal list", "Table", "Có", "Deals trong forecast"],
        ],
        "rules": ["BR-AI-013"],
    },
    "SCR-CRM-007": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-007"),
            ("Tên màn hình", "Sức khỏe khách hàng (Health)"),
            ("Route", "/crm/health"),
            ("Module", "MOD-AI"),
            ("Mục đích", "Churn risk và CS health score"),
            ("Vai trò", "AM, CSKH, GDKD"),
            ("Use case liên quan", "AI-UC-017"),
            ("API liên quan", "GET /api/v1/ai/customer-health"),
            ("Trạng thái triển khai", "Done — RNOS-19 ✅"),
        ],
        "ui": [
            [1, "Health score table", "Table", "Có", "Customer · score · trend"],
            [2, "Risk badge", "Badge", "Có", "High/medium/low churn"],
            [3, "Filter segment", "Select", "Không", "Lọc theo AM/account"],
            [4, "Detail link", "Link", "Có", "→ /crm/customers/[id]"],
        ],
        "rules": ["BR-AI-017"],
    },
    "SCR-AI-001": {
        "meta": [
            ("Mã màn hình", "SCR-AI-001"),
            ("Tên màn hình", "AI Insights / Copilot analytics"),
            ("Route", "/crm/ai/insights"),
            ("Module", "MOD-AI"),
            ("Mục đích", "Analytics adoption copilot + dismiss reasons + anomaly digest"),
            ("Vai trò", "GDKD, Admin"),
            ("Use case liên quan", "AI-UC-005, AI-UC-007, AI-UC-019"),
            ("Trạng thái triển khai", "Done — RNOS-29 ✅"),
        ],
        "ui": [
            [1, "DAU tile", "KPI", "Có", "Copilot daily active users"],
            [2, "Acceptance rate", "Chart", "Có", "Draft accepted vs dismissed"],
            [3, "Top dismiss reasons", "Table", "Có", "Preset reason breakdown"],
            [4, "Anomaly digest", "Panel", "Không", "Channel CPL/ROAS alerts"],
        ],
        "rules": ["BR-AI-007", "BR-AI-009", "BR-AI-019"],
    },
    "SCR-META-001": {
        "meta": [
            ("Mã màn hình", "SCR-META-001"),
            ("Tên màn hình", "Facebook Ads Hub"),
            ("Route", "/meta/facebook-ads"),
            ("Module", "MOD-META"),
            ("Mục đích", "Hub CPL/ROAS, map campaign ↔ CRM"),
            ("Vai trò", "Media Buyer, AM"),
            ("Use case liên quan", "META-UC-001, META-UC-002, META-UC-003"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "Account selector", "Select", "Có", "Chọn ad account"],
            [2, "CPL/ROAS tiles", "KPI", "Có", "Spend · leads · CPL · ROAS"],
            [3, "Campaign table", "Table", "Có", "Map CRM attribution"],
            [4, "Sync status", "Badge", "Có", "Last sync timestamp"],
            [5, "Deep link CRM", "Link", "Không", "→ lead list filtered"],
        ],
        "rules": ["BR-META-001", "BR-META-002", "BR-META-003"],
    },
    "SCR-PORTAL-001": {
        "meta": [
            ("Mã màn hình", "SCR-PORTAL-001"),
            ("Tên màn hình", "Portal Dashboard KPI"),
            ("Route", "/dashboard"),
            ("Module", "MOD-PORTAL"),
            ("Mục đích", "KPI đa module cho khách hàng"),
            ("Vai trò", "Client Viewer"),
            ("Use case liên quan", "PORTAL-UC-001, PORTAL-UC-002"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "Module KPI tiles", "KPI", "Có", "Meta · SEO · Email · Zalo"],
            [2, "Approval pending", "Badge", "Không", "Số item chờ duyệt"],
            [3, "Quick nav", "Nav", "Có", "→ module detail pages"],
            [4, "Date range", "Select", "Không", "7d/30d/90d"],
        ],
        "rules": ["BR-PORTAL-001", "BR-PORTAL-002"],
    },
    "SCR-AGENCY-001": {
        "meta": [
            ("Mã màn hình", "SCR-AGENCY-001"),
            ("Tên màn hình", "Chi tiết Client Agency"),
            ("Route", "/agency/clients/[id]"),
            ("Module", "MOD-AGENCY"),
            ("Mục đích", "Onboard checklist, settings, module flags per client"),
            ("Vai trò", "AM, Admin"),
            ("Use case liên quan", "SVC-UC-002, SYS-UC-001"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "Client header", "Header", "Có", "Tên · industry · AM owner"],
            [2, "Onboard checklist", "Checklist", "Có", "7-stage progress"],
            [3, "Module toggles", "Switch", "Có", "Meta/SEO/EM/Zalo enable"],
            [4, "Channel accounts", "Table", "Không", "Mapped ad accounts"],
            [5, "Audit log", "Timeline", "Không", "Recent changes"],
        ],
        "rules": ["BR-SVC-002", "BR-SYS-001", "BR-SYS-011"],
    },
    "SCR-AUTH-001": {
        "meta": [
            ("Mã màn hình", "SCR-AUTH-001"),
            ("Tên màn hình", "Đăng nhập Staff (ops-web)"),
            ("Route", "/login"),
            ("Module", "MOD-AUTH"),
            ("Mục đích", "Xác thực staff JWT + redirect theo cap"),
            ("Vai trò", "All staff"),
            ("Use case liên quan", "PLAT-UC-001, PLAT-UC-002"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "Email input", "Input", "Có", "Staff email"],
            [2, "Password input", "Input", "Có", "Masked password"],
            [3, "Login button", "Button", "Có", "Submit credentials"],
            [4, "Error toast", "Alert", "Không", "Invalid credentials message"],
        ],
        "rules": ["BR-PLAT-001", "BR-PLAT-002"],
    },
    "SCR-ZALO-001": {
        "meta": [
            ("Mã màn hình", "SCR-ZALO-001"),
            ("Tên màn hình", "Zalo Ads Hub"),
            ("Route", "/zalo/zalo-ads"),
            ("Module", "MOD-ZALO"),
            ("Mục đích", "Hub CPL, map campaign, sync insights Zalo"),
            ("Vai trò", "Media Buyer, AM"),
            ("Use case liên quan", "ZALO-UC-001, ZALO-UC-002, ZALO-UC-004"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "OA/Ads account", "Select", "Có", "Chọn tài khoản Zalo"],
            [2, "CPL tiles", "KPI", "Có", "Spend · leads · CPL"],
            [3, "Campaign table", "Table", "Có", "Status · budget · CRM map"],
            [4, "Sync indicator", "Badge", "Có", "Last poll/sync time"],
        ],
        "rules": ["BR-ZALO-001", "BR-ZALO-002", "BR-ZALO-004"],
    },
    "SCR-EM-001": {
        "meta": [
            ("Mã màn hình", "SCR-EM-001"),
            ("Tên màn hình", "Email Hub"),
            ("Route", "/email/hub"),
            ("Module", "MOD-EM"),
            ("Mục đích", "Tổng quan workspace email: domain, campaigns, deliverability"),
            ("Vai trò", "Email Strategist, AM"),
            ("Use case liên quan", "EM-UC-001, EM-UC-013"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "Domain status", "Badge", "Có", "Verified/pending"],
            [2, "Campaign summary", "KPI", "Có", "Sent · open · click"],
            [3, "Deliverability score", "Gauge", "Không", "Inbox placement health"],
            [4, "Quick links", "Nav", "Có", "→ campaigns/contacts/templates"],
        ],
        "rules": ["BR-EM-001"],
    },
    "SCR-SEO-001": {
        "meta": [
            ("Mã màn hình", "SCR-SEO-001"),
            ("Tên màn hình", "SEO Hub"),
            ("Route", "/seo/hub"),
            ("Module", "MOD-SEO"),
            ("Mục đích", "Executive drill-down SEO/AEO KPI"),
            ("Vai trò", "SEO Strategist, AM, GDKD"),
            ("Use case liên quan", "SEO-UC-001, SEO-UC-012"),
            ("Trạng thái triển khai", "Done"),
        ],
        "ui": [
            [1, "GSC/GA4 connect", "Status", "Có", "OAuth connection state"],
            [2, "Traffic tiles", "KPI", "Có", "Organic sessions · clicks"],
            [3, "Content pipeline", "Chart", "Có", "Stage distribution"],
            [4, "Drill-down links", "Link", "Có", "→ research/content/technical"],
        ],
        "rules": ["BR-SEO-001", "BR-SEO-012"],
    },
}

# ── Use case detail blocks (P0) ──
USE_CASE_DETAILS: dict[str, dict] = {
    "CRM-UC-001": {
        "meta": [
            ("Mã use case", "CRM-UC-001"),
            ("Tên use case", "Đăng nhập & phân công lead tự động"),
            ("Màn hình", "SCR-CRM-001, SCR-AUTH-001"),
            ("Actor chính", "CSKH / Sales"),
            ("Actor phụ", "System (webhook ingest, assignment engine)"),
            ("Mục tiêu", "Lead mới được gán owner tự động sau ingest"),
            ("Trigger", "Lead mới từ Meta/Zalo/form hoặc import"),
            ("Pre-condition", "Staff đăng nhập ops-web; assignment rules configured"),
            ("Post-condition", "Lead có owner primary; audit source + timestamp"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "Webhook hoặc form submit tạo lead record (PLAT-UC-004/005)"],
            [2, "Engine dedup theo phone/email"],
            [3, "Gán owner theo rule: round-robin / territory / product line"],
            [4, "Lead xuất hiện trên /crm/leads với status Mới"],
            [5, "CSKH nhận notification in-app"],
        ],
        "alt_flow": [
            ["E1", "Duplicate → merge hoặc link existing lead"],
            ["E2", "Không match rule → fallback queue GDKD review (CRM-UC-003)"],
        ],
        "io": [
            ["Input", "Lead payload: phone, name, source, campaign_id"],
            ["Output", "Lead record + owner_id + assignment audit"],
        ],
        "rules": ["BR-CRM-001", "BR-PLAT-004"],
    },
    "CRM-UC-002": {
        "meta": [
            ("Mã use case", "CRM-UC-002"),
            ("Tên use case", "Chăm sóc lead B2 (Liên hệ OK)"),
            ("Màn hình", "SCR-CRM-002"),
            ("Actor chính", "CSKH"),
            ("Mục tiêu", "Ghi nhận liên hệ thành công và chuyển status B2"),
            ("Trigger", "CSKH liên hệ thành công lead Mới"),
            ("Pre-condition", "Lead status Mới/B1; staff là owner"),
            ("Post-condition", "SLA contact time tracked; KPI CSKH cập nhật"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "CSKH mở lead detail → log call/note"],
            [2, "Cập nhật status → B2 — Liên hệ OK"],
            [3, "Hệ thống ghi activity timeline"],
            [4, "Nếu qualify → chuyển Pre-sales (CRM-UC-005)"],
        ],
        "alt_flow": [
            ["E1", "Không liên lạc được → B1 retry hoặc Lost với reason"],
        ],
        "io": [
            ["Input", "Activity note, call outcome, next action"],
            ["Output", "Updated lead status + activity record"],
        ],
        "rules": ["BR-CRM-002"],
    },
    "CRM-UC-008": {
        "meta": [
            ("Mã use case", "CRM-UC-008"),
            ("Tên use case", "Quản lý bảng CSKH"),
            ("Màn hình", "SCR-CRM-004, SCR-CRM-017"),
            ("Actor chính", "CSKH"),
            ("Mục tiêu", "Theo dõi case CSKH trên Kanban SLA"),
            ("Trigger", "Case CSKH mới hoặc SLA breach"),
            ("Pre-condition", "Case CSKH tồn tại"),
            ("Post-condition", "Kanban phản ánh SLA chính xác"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "CSKH mở /crm/cskh-board"],
            [2, "Xem case theo cột trạng thái SLA"],
            [3, "Kéo thả hoặc cập nhật case status"],
            [4, "SLA badge cập nhật realtime"],
            [5, "Breach case highlight đỏ/vàng"],
        ],
        "alt_flow": [
            ["E1", "Reassign case → owner mới nhận notification"],
        ],
        "io": [
            ["Input", "Case ID, new status, assignee"],
            ["Output", "Updated Kanban state + SLA metrics"],
        ],
        "rules": ["BR-CRM-008"],
    },
    "AI-UC-001": {
        "meta": [
            ("Mã use case", "AI-UC-001"),
            ("Tên use case", "Lead score async sau ingest"),
            ("Màn hình", "SCR-CRM-001, SCR-CRM-002"),
            ("Actor chính", "System (worker, scoring engine)"),
            ("Actor phụ", "CSKH (consumer UI)"),
            ("Mục tiêu", "Tính score 0–100 + explainability sau lead ingest"),
            ("Trigger", "Lead mới created hoặc tenant.lead.created"),
            ("Pre-condition", "DDL applied; feature flag bật pilot"),
            ("Post-condition", "ai_scores có bản ghi; audit run id traceable"),
            ("Ưu tiên", "P0 · RNOS-04"),
        ],
        "main_flow": [
            [1, "Lead ingest hoàn tất (CRM-UC-001)"],
            [2, "Outbox emit tenant.lead.created"],
            [3, "Worker consume → POST /api/v1/ai/score/lead"],
            [4, "Rules engine tính score + explainability[]"],
            [5, "Persist ai_scores + ai_agent_runs"],
            [6, "Copilot panel refresh score ≤30s"],
        ],
        "alt_flow": [
            ["E1", "Duplicate score 5 phút → idempotency skip"],
            ["E2", "Thiếu attribution → score vẫn chạy, flag explainability"],
            ["E3", "Job fail → retry 3x; UI 'Score đang cập nhật'"],
        ],
        "io": [
            ["Input", "lead_id, tenant_id, source metadata"],
            ["Output", "score 0–100, explainability[], run_id"],
        ],
        "rules": ["BR-AI-001", "BR-AI-009"],
    },
    "AI-UC-002": {
        "meta": [
            ("Mã use case", "AI-UC-002"),
            ("Tên use case", "Copilot — Lead brief"),
            ("Màn hình", "SCR-CRM-002"),
            ("Actor chính", "CSKH / Sales"),
            ("Mục tiêu", "Tóm tắt nhanh lead 5 bullet tiếng Việt"),
            ("Trigger", "Mở lead detail hoặc bấm Tóm tắt nhanh"),
            ("Pre-condition", "Copilot flag on; user owner hoặc GDKD"),
            ("Post-condition", "Brief hiển thị; không auto thay CRM fields"),
            ("Ưu tiên", "P0 · RNOS-06"),
        ],
        "main_flow": [
            [1, "CSKH mở /crm/leads/[id]"],
            [2, "Sidebar AI Copilot load score card"],
            [3, "Bấm Tóm tắt nhanh → gather context"],
            [4, "LLM trả 5 bullet: who, need, source, risk, next step"],
            [5, "User Copy hoặc Dismiss; ghi ai_agent_runs"],
        ],
        "alt_flow": [
            ["E1", "Lead mới không activity → brief từ form fields"],
            ["E2", "Rate limit 429 → toast thử lại sau 1 phút"],
        ],
        "io": [
            ["Input", "lead_id, activities[], timeline, meta_json"],
            ["Output", "brief bullets[], run_id"],
        ],
        "rules": ["BR-AI-001", "BR-AI-004"],
    },
    "AI-UC-003": {
        "meta": [
            ("Mã use case", "AI-UC-003"),
            ("Tên use case", "Copilot — Summarize activity"),
            ("Màn hình", "SCR-CRM-002"),
            ("Actor chính", "CSKH"),
            ("Mục tiêu", "Tóm tắt activity dài thành summary có cấu trúc"),
            ("Trigger", "Chọn activity timeline hoặc paste note"),
            ("Pre-condition", "Activity text ≥50 ký tự"),
            ("Post-condition", "Summary hiển thị; activity gốc không overwrite"),
            ("Ưu tiên", "P0 · RNOS-03"),
        ],
        "main_flow": [
            [1, "CSKH chọn activity hoặc paste vào copilot"],
            [2, "Bấm Tóm tắt → POST /api/v1/ai/summarize"],
            [3, "Response: summary + extracted intent/objections/next_action"],
            [4, "User chấp nhận → copy vào note mới (optional)"],
            [5, "Audit ai_agent_runs; P95 ≤5s staging"],
        ],
        "alt_flow": [
            ["E1", "Summary sai → user edit thủ công"],
            ["E2", "Empty text → validation 400"],
        ],
        "io": [
            ["Input", "entity_type=lead, entity_id, text"],
            ["Output", "summary, extracted fields, run_id"],
        ],
        "rules": ["BR-AI-001", "BR-AI-003"],
    },
    "AI-UC-004": {
        "meta": [
            ("Mã use case", "AI-UC-004"),
            ("Tên use case", "Follow-up draft + approve"),
            ("Màn hình", "SCR-CRM-002"),
            ("Actor chính", "CSKH"),
            ("Mục tiêu", "Sinh draft follow-up; user duyệt trước khi dùng"),
            ("Trigger", "Bấm Soạn follow-up trên copilot panel"),
            ("Pre-condition", "Lead context + copilot enabled"),
            ("Post-condition", "Draft lưu; KHÔNG auto-send Zalo/email"),
            ("Ưu tiên", "P0 · RNOS-06"),
        ],
        "main_flow": [
            [1, "CSKH bấm Soạn follow-up trên copilot"],
            [2, "LLM generate draft message tiếng Việt"],
            [3, "Hiển thị draft trong panel với confidence banner"],
            [4, "User Duyệt → copy vào activity hoặc clipboard"],
            [5, "Ghi ai_recommendations + ai_agent_runs"],
        ],
        "alt_flow": [
            ["E1", "Dismiss → chọn preset reason (AI-UC-007)"],
            ["E2", "confidence < 0.6 → banner cảnh báo"],
        ],
        "io": [
            ["Input", "lead_id, channel hint, tone preference"],
            ["Output", "draft_text, confidence, recommendation_id"],
        ],
        "rules": ["BR-AI-001", "BR-AI-004", "BR-AI-007"],
    },
    "AI-UC-019": {
        "meta": [
            ("Mã use case", "AI-UC-019"),
            ("Tên use case", "Channel CPL/ROAS anomaly digest"),
            ("Màn hình", "SCR-AI-001, SCR-META-001"),
            ("Actor chính", "GDKD / System"),
            ("Mục tiêu", "Phát hiện bất thường CPL/ROAS và gửi digest"),
            ("Trigger", "Cron daily scan channel metrics"),
            ("Pre-condition", "Channel metrics ≥7 ngày baseline"),
            ("Post-condition", "Digest delivered in-app/email"),
            ("Ưu tiên", "P2 · RNOS-28"),
        ],
        "main_flow": [
            [1, "Cron job scan Meta/Zalo/Google daily_performance"],
            [2, "So sánh CPL/ROAS vs baseline ± threshold"],
            [3, "Anomaly detected → tạo digest entry"],
            [4, "Hiển thị trên SCR-AI-001 anomaly panel"],
            [5, "Optional email digest cho GDKD"],
        ],
        "alt_flow": [
            ["E1", "Không đủ data → skip channel với note"],
            ["E2", "False positive → user dismiss anomaly"],
        ],
        "io": [
            ["Input", "channel metrics[], baseline window"],
            ["Output", "anomaly[]: channel, metric, delta%, severity"],
        ],
        "rules": ["BR-AI-019", "BR-META-009"],
    },
    "META-UC-004": {
        "meta": [
            ("Mã use case", "META-UC-004"),
            ("Tên use case", "Webhook lead Meta → CRM"),
            ("Màn hình", "SCR-CRM-001, SCR-CRM-015"),
            ("Actor chính", "System"),
            ("Mục tiêu", "Leadgen webhook Meta tạo lead CRM tự động"),
            ("Trigger", "POST webhook Meta leadgen"),
            ("Pre-condition", "Webhook secret + form field map configured"),
            ("Post-condition", "Lead trong CRM với source Meta"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "Meta POST leadgen payload tới PLAT-UC-004 endpoint"],
            [2, "Verify signature + parse field VN (phone, full_name)"],
            [3, "Dedup theo phone → skip nếu trùng"],
            [4, "Tạo lead record + map campaign/adset"],
            [5, "Trigger assignment engine (CRM-UC-001)"],
            [6, "Trigger AI score async (AI-UC-001)"],
        ],
        "alt_flow": [
            ["E1", "Invalid signature → 401 + log incident"],
            ["E2", "Missing phone → queue review CRM-UC-003"],
        ],
        "io": [
            ["Input", "Meta leadgen webhook JSON"],
            ["Output", "Lead ID + ingest audit log"],
        ],
        "rules": ["BR-META-004", "BR-PLAT-004", "BR-CRM-001"],
    },
    "PORTAL-UC-001": {
        "meta": [
            ("Mã use case", "PORTAL-UC-001"),
            ("Tên use case", "Login portal scoped client"),
            ("Màn hình", "SCR-PORTAL-002"),
            ("Actor chính", "Client Viewer"),
            ("Mục tiêu", "Đăng nhập portal JWT scoped đúng client"),
            ("Trigger", "Client submit login form"),
            ("Pre-condition", "Portal account active + client linked"),
            ("Post-condition", "JWT scoped; redirect /dashboard"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "Client mở portal /login"],
            [2, "Nhập email + password"],
            [3, "POST /api/v1/portal/auth/login"],
            [4, "Verify credentials + client scope"],
            [5, "Issue JWT + refresh token"],
            [6, "Redirect /dashboard với module caps"],
        ],
        "alt_flow": [
            ["E1", "Invalid credentials → error message"],
            ["E2", "Account disabled → contact AM message"],
        ],
        "io": [
            ["Input", "email, password"],
            ["Output", "JWT access + refresh, client_id scope"],
        ],
        "rules": ["BR-PORTAL-001", "BR-PLAT-003", "BR-SYS-011"],
    },
    "PLAT-UC-004": {
        "meta": [
            ("Mã use case", "PLAT-UC-004"),
            ("Tên use case", "Webhook Meta ingest"),
            ("Màn hình", "SCR-AGENCY-004"),
            ("Actor chính", "System"),
            ("Mục tiêu", "Nhận và xử lý webhook Meta an toàn"),
            ("Trigger", "Inbound POST Meta webhook"),
            ("Pre-condition", "Webhook secret + tenant routing configured"),
            ("Post-condition", "Event persisted + downstream job queued"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "Meta POST event tới /webhooks/meta/:tenant"],
            [2, "Verify X-Hub-Signature-256"],
            [3, "Parse event type (leadgen, page, etc.)"],
            [4, "Persist raw payload + normalized event"],
            [5, "Queue job cho CRM ingest (META-UC-004)"],
            [6, "Return 200 within SLA <5s"],
        ],
        "alt_flow": [
            ["E1", "Signature fail → 401 + alert SYS-UC-008"],
            ["E2", "Unknown tenant → 404 + log"],
        ],
        "io": [
            ["Input", "Meta webhook payload + headers"],
            ["Output", "event_id, job_id, status"],
        ],
        "rules": ["BR-PLAT-004", "BR-SYS-008"],
    },
    "SYS-UC-002": {
        "meta": [
            ("Mã use case", "SYS-UC-002"),
            ("Tên use case", "Closed-loop Spend → Lead → Revenue"),
            ("Màn hình", "SCR-META-001, SCR-CRM-001, SCR-CRM-005"),
            ("Actor chính", "GDKD / System"),
            ("Mục tiêu", "Attribution end-to-end từ ad spend đến revenue"),
            ("Trigger", "Daily sync + lead convert events"),
            ("Pre-condition", "Channels connected; CRM-Meta map active"),
            ("Post-condition", "CPL/ROAS/revenue visible cross-module"),
            ("Ưu tiên", "P0"),
        ],
        "main_flow": [
            [1, "Meta/Zalo sync daily spend + impressions"],
            [2, "Webhook/poll ingest leads với campaign_id"],
            [3, "CRM map lead → campaign → client"],
            [4, "Lead convert → customer + order/revenue"],
            [5, "Business dashboard aggregate CPL/ROAS/revenue"],
            [6, "GDKD drill-down ≤3 clicks (SYS-UC-007)"],
        ],
        "alt_flow": [
            ["E1", "Unmapped campaign → flag trong hub + manual map"],
            ["E2", "Multi-touch → last-click attribution default"],
        ],
        "io": [
            ["Input", "spend data, leads[], conversions[], orders[]"],
            ["Output", "Attribution report: CPL, ROAS, revenue by channel"],
        ],
        "rules": ["BR-SYS-002", "BR-META-003", "BR-CRM-014"],
    },
}

# Merge manual module specs — override inline/auto blocks
from rnosai_ba_uc_details_ai import AI_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_crm import CRM_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_meta import META_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_em import EM_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_plat import PLAT_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_portal import PORTAL_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_seo import SEO_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_svc import SVC_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_sys import SYS_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_zalo import ZALO_USE_CASE_DETAILS  # noqa: E402
from rnosai_ba_uc_details_mob import MOB_USE_CASE_DETAILS  # noqa: E402

USE_CASE_DETAILS.update(CRM_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(META_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(SVC_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(SEO_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(PORTAL_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(SYS_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(EM_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(PLAT_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(AI_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(ZALO_USE_CASE_DETAILS)
USE_CASE_DETAILS.update(MOB_USE_CASE_DETAILS)

# ── Business Rules [br_id, description, module, priority, status] ──
BUSINESS_RULES: list[list] = [
    # CRM
    ["BR-CRM-001", "Một lead active chỉ một owner primary; dedup phone/email", "CRM", "High", "Done"],
    ["BR-CRM-002", "Chuyển status B2 bắt buộc ghi activity timeline", "CRM", "High", "Done"],
    ["BR-CRM-003", "Review queue: deal > threshold bắt buộc GDKD approve", "CRM", "High", "Done"],
    ["BR-CRM-004", "Add-on ngành: routing specialist theo catalog line", "CRM", "Medium", "In progress"],
    ["BR-CRM-005", "Pre-sales record bắt buộc trước proposal stage", "CRM", "High", "Done"],
    ["BR-CRM-006", "Proposal version history immutable; client accept audit", "CRM", "High", "Done"],
    ["BR-CRM-007", "Customer code unique; một legal entity một master", "CRM", "High", "Done"],
    ["BR-CRM-008", "SLA breach highlight trên CSKH board theo config", "CRM", "High", "Done"],
    ["BR-CRM-009", "Pipeline lost reason taxonomy bắt buộc khi stage Lost", "CRM", "Medium", "In progress"],
    ["BR-CRM-010", "RE project lead gắn project_id; pool assign theo phân khu", "CRM", "High", "Done"],
    ["BR-CRM-011", "Hub contract renewal alert 30/60/90 ngày", "CRM", "High", "Done"],
    ["BR-CRM-012", "Catalog SKU disabled không xóa proposal in-use", "CRM", "Medium", "Done"],
    ["BR-CRM-013", "Staff KPI export chỉ tenant hiện tại; HR cap required", "CRM", "Medium", "Done"],
    ["BR-CRM-014", "Dashboard kinh doanh chỉ aggregate tenant hiện tại", "CRM", "High", "Done"],
    ["BR-CRM-015", "Import Excel phải dùng template chuẩn + validate cột bắt buộc", "CRM", "High", "Done"],
    # AI
    ["BR-AI-001", "Copilot KHÔNG auto-send Zalo/Email — chỉ draft + copy", "AI", "High", "Done"],
    ["BR-AI-002", "Lead brief tối đa 5 bullet tiếng Việt; không ghi đè CRM fields", "AI", "High", "Done"],
    ["BR-AI-003", "confidence < 0.6 → banner cảnh báo; không ẩn score", "AI", "High", "Done"],
    ["BR-AI-004", "CSKH chỉ copilot lead owner=me; GDKD/Admin xem team", "AI", "High", "Done"],
    ["BR-AI-005", "Explainability hiển thị ≥3 factors khi đủ data attribution", "AI", "Medium", "Done"],
    ["BR-AI-006", "Override score: 0–100 + reason ≥10 ký tự + audit trail", "AI", "High", "Done"],
    ["BR-AI-007", "Dismiss draft bắt buộc chọn preset reason", "AI", "Medium", "Done"],
    ["BR-AI-008", "Timeline event bắt buộc cho activity/webhook/status change", "AI", "High", "Done"],
    ["BR-AI-009", "100% LLM/score calls ghi ai_agent_runs + request_id", "AI", "High", "Done"],
    ["BR-AI-010", "Pilot flag off → copilot hidden; CRM core unaffected", "AI", "High", "Done"],
    ["BR-AI-011", "NBA không emit trên deal Won hoặc vừa close", "AI", "Medium", "Done"],
    ["BR-AI-012", "Deal score recompute on stage advance hoặc quote attach", "AI", "Medium", "Done"],
    ["BR-AI-013", "Forecast commit immutable snapshot per period", "AI", "Medium", "Done"],
    ["BR-AI-014", "Renewal draft AM review — không auto-send outbound", "AI", "Medium", "Done"],
    ["BR-AI-015", "Pipeline risk alert → user confirm trước khi tạo task", "AI", "Medium", "Done"],
    ["BR-AI-016", "NL query curated whitelist — không free SQL mutate", "AI", "High", "Done"],
    ["BR-AI-017", "Health score chỉ tính customer đã convert", "AI", "Medium", "Done"],
    ["BR-AI-018", "Manager coach digest — insights only, no auto HR action", "AI", "Medium", "Done"],
    ["BR-AI-019", "Anomaly digest threshold configurable per channel", "AI", "Medium", "Done"],
    ["BR-AI-020", "Workflow AI node simulate trước publish — no prod mutate", "AI", "High", "Done"],
    # Meta
    ["BR-META-001", "Ad account OAuth refresh trước khi hết hạn token", "Meta", "High", "Done"],
    ["BR-META-002", "Hub campaign map bắt buộc trước CPL client rollup", "Meta", "High", "Done"],
    ["BR-META-003", "CPL/ROAS tính theo last-click attribution default", "Meta", "High", "Done"],
    ["BR-META-004", "Webhook leadgen verify signature + map field VN", "Meta", "High", "Done"],
    ["BR-META-005", "CAPI event_id dedup hash(lead_id+event_name+date)", "Meta", "High", "Done"],
    ["BR-META-006", "Tracking health green required trước launch gate", "Meta", "High", "Done"],
    ["BR-META-007", "Launch wizard bắt buộc Launch QA + Campaign Write approval", "Meta", "High", "Done"],
    ["BR-META-008", "Campaign edit qua write queue — no direct API bypass prod", "Meta", "High", "Done"],
    ["BR-META-009", "Anomaly alert khi CPL vượt baseline >2σ", "Meta", "Medium", "Done"],
    ["BR-META-010", "Forecast requires ≥30d historical data or warning", "Meta", "Medium", "Done"],
    ["BR-META-011", "Breakdown insights cache TTL + rate limit fallback", "Meta", "Medium", "Done"],
    ["BR-META-012", "Emergency pause audit who/when/reason bắt buộc", "Meta", "High", "Done"],
    ["BR-META-013", "Weekly PDF client-safe — no internal margin/owner fields", "Meta", "Medium", "Done"],
    ["BR-META-014", "API version migration signoff trước deprecation deadline", "Meta", "Medium", "Draft"],
    # Platform
    ["BR-PLAT-001", "Session refresh trước khi hết hạn access token", "Platform", "High", "Done"],
    ["BR-PLAT-002", "RBAC cap enforcement 403 trên route/API unauthorized", "Platform", "High", "Done"],
    ["BR-PLAT-003", "Portal JWT scoped single client_id", "Platform", "High", "Done"],
    ["BR-PLAT-004", "Webhook Meta verify X-Hub-Signature-256", "Platform", "High", "Done"],
    ["BR-PLAT-005", "Zalo/Google webhook signature verify trước normalize lead", "Platform", "High", "Done"],
    ["BR-PLAT-006", "ESP webhook idempotent — bounce triggers global suppression", "Platform", "High", "Done"],
    ["BR-PLAT-007", "Job queue retry + dead letter — poison message alert DevOps", "Platform", "High", "Done"],
    ["BR-PLAT-008", "Temporal approval timeout escalate AM notification", "Platform", "Medium", "In progress"],
    ["BR-PLAT-009", "Staff seed role template caps — deny by default", "Platform", "High", "Done"],
    ["BR-PLAT-010", "Health + soak gate PASS required trước prod cutover", "Platform", "High", "Done"],
    # System
    ["BR-SYS-002", "Closed-loop attribution requires campaign ↔ CRM map", "System", "High", "Done"],
    ["BR-SYS-003", "Không launch campaign nếu Launch QA critical fail", "System", "High", "Done"],
    ["BR-SYS-004", "Client approver JWT scoped một client_id cross-module", "System", "High", "Done"],
    ["BR-SYS-005", "Client-facing report bắt buộc attribution disclaimer", "System", "High", "Done"],
    ["BR-SYS-006", "Offboard revoke all OAuth portal webhook tokens", "System", "High", "In progress"],
    ["BR-SYS-007", "Executive drill-down ≤3 clicks từ dashboard tile", "System", "Medium", "Done"],
    ["BR-SYS-008", "Webhook down P1 incident alert within 5 minutes", "System", "High", "Done"],
    ["BR-SYS-009", "Staged prod cutover module flag soak ≥3 ngày gate PASS", "System", "High", "Done"],
    ["BR-SYS-010", "Cross-module audit query immutable export compliance role", "System", "Medium", "Done"],
    ["BR-SYS-011", "Multi-tenant isolation — no cross-client data leak", "System", "High", "Done"],
    ["BR-SYS-012", "Hypercare 30-day P1 ack SLA post go-live", "System", "Medium", "In progress"],
    # Portal
    ["BR-PORTAL-001", "Portal login scoped client — không thấy data client khác", "Portal", "High", "Done"],
    ["BR-PORTAL-002", "Dashboard KPI chỉ module enabled cho client", "Portal", "Medium", "Done"],
    ["BR-PORTAL-003", "Meta portal CSV client-safe — no internal attribution fields", "Portal", "High", "Done"],
    ["BR-PORTAL-004", "SEO summary read-only subset; sync stale timestamp shown", "Portal", "Medium", "Done"],
    ["BR-PORTAL-005", "Email stats aggregate only — no subscriber PII", "Portal", "High", "Done"],
    ["BR-PORTAL-006", "Creative approval synced ops-web SYS-UC-004", "Portal", "High", "Done"],
    ["BR-PORTAL-007", "SEO content approval advances pipeline stage", "Portal", "Medium", "Done"],
    ["BR-PORTAL-008", "Email campaign dual approval staff + client EM-UC-007", "Portal", "Medium", "Done"],
    ["BR-PORTAL-009", "Reject without comment blocked min length", "Portal", "High", "Done"],
    ["BR-PORTAL-010", "Download signed URL expiry + audit log compliance", "Portal", "High", "Done"],
    ["BR-PORTAL-011", "Forgot password generic response — no email enumeration", "Portal", "High", "Done"],
    ["BR-PORTAL-012", "Change password requires current password when logged in", "Portal", "High", "Done"],
    ["BR-PORTAL-013", "Portal Zalo export scoped JWT — no cross-tenant KPI leak", "Portal", "High", "Done"],
    ["BR-PORTAL-014", "Zalo creative reject requires comment min length", "Portal", "High", "Done"],
    ["BR-PORTAL-015", "Google portal view read-only — no internal margin fields", "Portal", "Medium", "In progress"],
    # Mobile
    ["BR-MOB-01", "PWA staff chỉ staff JWT — không dùng portal JWT trên ops-web", "Mobile", "High", "Done"],
    ["BR-MOB-02", "Offline: chỉ GET; POST/PATCH hiện banner «Cần mạng»", "Mobile", "High", "Done"],
    ["BR-MOB-03", "Push portal scoped tenant — payload không chứa PII subscriber", "Mobile", "High", "Done"],
    ["BR-MOB-04", "AI copilot mobile: draft only — BR-AI-01 không đổi", "Mobile", "High", "Done"],
    ["BR-MOB-05", "Admin caps (admin_page_permissions) áp dụng identical trên mobile viewport", "Mobile", "High", "Done"],
    ["BR-MOB-06", "Session timeout mobile = desktop (staff 8h / portal theo policy)", "Mobile", "Medium", "Done"],
    # Zalo
    ["BR-ZALO-001", "Zalo OAuth token refresh SLA <24h before expiry", "Zalo", "High", "Done"],
    ["BR-ZALO-002", "Hub campaign map bắt buộc trước tính CPL client-facing", "Zalo", "High", "Done"],
    ["BR-ZALO-003", "Insights sync T+1; manual sync audit job_run_id", "Zalo", "High", "Done"],
    ["BR-ZALO-004", "Hub CPL staff exclude unmapped spend khỏi client KPI", "Zalo", "High", "Done"],
    ["BR-ZALO-005", "Portal Zalo KPI scoped JWT client_id only", "Zalo", "High", "Done"],
    ["BR-ZALO-006", "Brief Zalo phải có budget + form type trước draft", "Zalo", "Medium", "Done"],
    ["BR-ZALO-007", "Campaign draft không publish khi thiếu creative approved", "Zalo", "Medium", "In progress"],
    ["BR-ZALO-008", "Creative Zalo dual approval client + internal QA", "Zalo", "High", "Done"],
    ["BR-ZALO-011", "Zalo webhook lead dedup same as CRM BR-CRM-001", "Zalo", "High", "Done"],
    ["BR-ZALO-012", "Form poll SLA ≤15 phút từ submit form", "Zalo", "High", "Done"],
    ["BR-ZALO-013", "Dedup phone+client trong 24h → duplicate flag", "Zalo", "High", "Done"],
    ["BR-ZALO-014", "Lead Zalo pipeline theo CRM status chuẩn B1/B2", "Zalo", "High", "Done"],
    ["BR-ZALO-015", "CRM Won/Lost sync conversion metrics hub Zalo", "Zalo", "Medium", "Done"],
    ["BR-ZALO-017", "Alert CPL > target hoặc zero leads 24h", "Zalo", "Medium", "Done"],
    ["BR-ZALO-021", "Onboard orchestrator Zalo 5 steps trước enable module", "Zalo", "Medium", "Done"],
    # Email
    ["BR-EM-001", "Email domain phải verified trước khi send campaign", "EM", "High", "Done"],
    ["BR-EM-002", "No marketing send without documented consent", "EM", "High", "Done"],
    ["BR-EM-003", "CSV import validate format + dedup before batch", "EM", "High", "Done"],
    ["BR-EM-004", "Segment compute versioned; recompute on schedule", "EM", "Medium", "Done"],
    ["BR-EM-005", "Template preflight pass required before attach campaign", "EM", "High", "Done"],
    ["BR-EM-006", "Campaign F1 test send staff list trước submit approval", "EM", "High", "Done"],
    ["BR-EM-007", "Dual approval staff + client trước ESP send", "EM", "High", "Done"],
    ["BR-EM-008", "ESP send batch scoped suppression list applied", "EM", "High", "Done"],
    ["BR-EM-009", "Suppression global per client workspace — unsub honored", "EM", "High", "Done"],
    ["BR-EM-010", "Deliverability F3 pause sends on bounce/blocklist spike", "EM", "High", "Done"],
    ["BR-EM-011", "Journey enroll cap respected — pause on threshold", "EM", "Medium", "Done"],
    ["BR-EM-012", "Governance rule changes audit immutable", "EM", "Medium", "Done"],
    ["BR-EM-013", "Email reports client-safe — no subscriber PII export", "EM", "High", "Done"],
    ["BR-EM-014", "Preference center token expiry + unsub sync suppression", "EM", "High", "Done"],
    # SEO
    ["BR-SEO-001", "SEO workspace isolated per client tenant", "SEO", "High", "Done"],
    ["BR-SEO-002", "GSC property must match workspace domain before sync", "SEO", "High", "Done"],
    ["BR-SEO-003", "GA4 property linked for combined attribution reports", "SEO", "High", "Done"],
    ["BR-SEO-004", "Keyword import CSV template validate required columns", "SEO", "High", "Done"],
    ["BR-SEO-005", "Content pipeline stage advance requires checklist per step", "SEO", "High", "Done"],
    ["BR-SEO-006", "Governance block publish — no bypass without admin override", "SEO", "High", "Done"],
    ["BR-SEO-007", "Technical audit issues prioritized P0/P1/P2 backlog", "SEO", "High", "Done"],
    ["BR-SEO-008", "AEO coverage scan configurable per client vertical", "SEO", "Medium", "Done"],
    ["BR-SEO-009", "CMS publish webhook retry 3x on 5xx", "SEO", "Medium", "Done"],
    ["BR-SEO-010", "Freshness queue stale threshold default 90 days", "SEO", "Medium", "Done"],
    ["BR-SEO-011", "Rank tracker daily job alert on drop >N positions", "SEO", "Medium", "Done"],
    ["BR-SEO-012", "SEO hub drill-down ≤3 clicks", "SEO", "Medium", "Done"],
    ["BR-SEO-013", "Client PDF report client-safe metrics only", "SEO", "High", "Done"],
    ["BR-SEO-014", "ClickHouse export incremental watermark required", "SEO", "Medium", "In progress"],
    # Agency/SVC
    ["BR-SVC-001", "Không Deliver nếu onboard checklist incomplete", "Agency", "High", "Done"],
    ["BR-SVC-002", "Onboard checklist bắt buộc trước go-live module", "Agency", "High", "Done"],
    ["BR-SVC-003", "TMMT versioned trước lifecycle Deliver milestone", "Agency", "High", "Done"],
    ["BR-SVC-004", "Handover blocked nếu invoice overdue RNOS-25", "Agency", "High", "Done"],
    ["BR-SVC-005", "Launch QA critical fail blocks campaign write submit", "Agency", "High", "Done"],
    ["BR-SVC-006", "Creative client approval required before ads wizard", "Agency", "High", "Done"],
    ["BR-SVC-007", "Campaign write budget threshold → GDKD approve", "Agency", "High", "Done"],
    ["BR-SVC-008", "Channel account mapping unique per client", "Agency", "High", "Done"],
    ["BR-SVC-009", "Ingest monitor replay idempotent webhook payloads", "Agency", "Medium", "Done"],
    ["BR-SVC-010", "KPI formula changes versioned with audit", "Agency", "Medium", "Done"],
    ["BR-SVC-011", "SOP/marketing plan linked lifecycle Optimize stage", "Agency", "Medium", "In progress"],
    ["BR-SVC-012", "Offboard revoke all OAuth portal webhook tokens", "Agency", "High", "Draft"],
    ["BR-SYS-001", "Onboard client phải map ít nhất 1 channel account", "System", "High", "Done"],
]

# ── Traceability [br_id, screens, use_cases, test_cases, status] ──
TRACEABILITY: list[list] = [
    ["BR-CRM-001", "SCR-CRM-001, SCR-CRM-002", "CRM-UC-001, CRM-UC-015", "TC-CRM-001, TC-CRM-003", "Done"],
    ["BR-CRM-002", "SCR-CRM-002", "CRM-UC-002", "TC-CRM-005", "Done"],
    ["BR-CRM-008", "SCR-CRM-004", "CRM-UC-008", "TC-CSKH-01", "Done"],
    ["BR-CRM-014", "SCR-CRM-005", "CRM-UC-014, SYS-UC-007", "TC-BIZ-01", "Done"],
    ["BR-CRM-015", "SCR-CRM-001", "CRM-UC-015", "TC-CRM-001, TC-CRM-002", "Done"],
    ["BR-AI-001", "SCR-CRM-002", "AI-UC-002, AI-UC-004", "TC-AI-001", "Done"],
    ["BR-AI-006", "SCR-CRM-002", "AI-UC-006", "TC-AI-002", "Done"],
    ["BR-AI-007", "SCR-CRM-002, SCR-AI-001", "AI-UC-007", "TC-AI-003", "Done"],
    ["BR-AI-009", "SCR-ADMIN-001", "AI-UC-009", "TC-AI-009", "Done"],
    ["BR-AI-013", "SCR-CRM-006", "AI-UC-013", "TC-FORECAST-01", "Done"],
    ["BR-AI-017", "SCR-CRM-007", "AI-UC-017", "TC-HEALTH-01", "Done"],
    ["BR-AI-019", "SCR-AI-001, SCR-META-001", "AI-UC-019", "TC-ANOMALY-01", "Done"],
    ["BR-META-004", "SCR-CRM-015", "META-UC-004, PLAT-UC-004", "TC-PROJ-08", "Done"],
    ["BR-PLAT-001", "SCR-AUTH-001", "PLAT-UC-001", "TC-AUTH-01", "Done"],
    ["BR-PLAT-004", "SCR-AGENCY-004", "PLAT-UC-004", "TC-WH-META-01", "Done"],
    ["BR-PORTAL-001", "SCR-PORTAL-002", "PORTAL-UC-001, PLAT-UC-003", "TC-PORTAL-01", "Done"],
    ["BR-SYS-002", "SCR-META-001, SCR-CRM-005", "SYS-UC-002", "TC-LOOP-01", "Done"],
    ["BR-SYS-011", "SCR-AGENCY-001", "SYS-UC-011", "TC-ISO-01", "Done"],
    ["BR-ZALO-011", "SCR-ZALO-002", "ZALO-UC-011, ZALO-UC-013", "TC-ZALO-01", "Done"],
    ["BR-EM-001", "SCR-EM-001", "EM-UC-001", "TC-EM-01", "Done"],
    ["BR-SEO-012", "SCR-SEO-001", "SEO-UC-012", "TC-SEO-01", "Done"],
    ["BR-SVC-002", "SCR-AGENCY-001", "SVC-UC-002, SYS-UC-001", "TC-ONBOARD-01", "Done"],
    ["BR-MOB-01", "SCR-MOB-001, SCR-MOB-005", "MOB-UC-001, MOB-UC-005", "TC-MOB-01, TC-MOB-02", "Done"],
    ["BR-MOB-02", "SCR-MOB-002", "MOB-UC-004", "TC-MOB-01", "Done"],
    ["BR-MOB-03", "SCR-MOB-010", "MOB-UC-009, MOB-UC-006", "TC-MOB-02", "Done"],
]

# ── Test Cases [tc_id, uc_id, name, steps, expected, actual, status, priority, fixture] ──
TEST_CASES: list[list] = [
    ["TC-CRM-001", "CRM-UC-015", "Import 4 dòng CSV hợp lệ", "1. /crm/leads → Import\n2. Chọn leads_import_sample.csv\n3. Xác nhận", "3 lead mới + 1 skip trùng SĐT", "", "Pass", "P0", "tests/fixtures/test_data/leads_import_sample.csv"],
    ["TC-CRM-002", "CRM-UC-015", "Import file thiếu cột bắt buộc", "Upload file sai template", "HTTP 400 + message validate", "", "Pass", "P0", ""],
    ["TC-CRM-003", "CRM-UC-001", "Search lead theo SĐT", "Nhập 0907 vào ô search", "Chỉ lead khớp partial phone", "", "Pass", "P1", ""],
    ["TC-CRM-005", "CRM-UC-002", "Cập nhật status B2 + activity", "Mở lead → log call → status B2", "Timeline + status updated", "", "Pass", "P0", ""],
    ["TC-CSKH-01", "CRM-UC-008", "SLA breach hiển thị board", "Tạo case quá hạn SLA", "Card highlight đỏ/vàng", "", "Pass", "P1", "cskh_board_gate.sh"],
    ["TC-BIZ-01", "CRM-UC-014", "Business dashboard tiles load", "Mở /crm/business-dashboard", "Revenue tiles render ≤3s", "", "Pass", "P0", "RNOS-46 gate"],
    ["TC-AI-001", "AI-UC-004", "Copilot draft không auto-send", "Generate follow-up draft", "Draft hiện; không gửi outbound", "", "Pass", "P0", "playwright_ops_ai_copilot_e2e.sh"],
    ["TC-AI-002", "AI-UC-006", "GDKD override score hợp lệ", "Override 85 + reason ≥10 chars", "Badge GDKD điều chỉnh hiện", "", "Pass", "P0", "UI-R1-08"],
    ["TC-AI-003", "AI-UC-007", "Dismiss draft với reason", "Dismiss → chọn preset", "PATCH dismissed_reason OK", "", "Pass", "P1", "RNOS-29 gate"],
    ["TC-AI-009", "AI-UC-009", "Admin AI runs trace", "Mở /admin/ai/runs", "Run list searchable by request_id", "", "Pass", "P0", "RNOS-09 gate"],
    ["TC-FORECAST-01", "AI-UC-013", "Commit forecast snapshot", "Bấm Commit trên /crm/forecast", "Snapshot saved immutable", "", "Pass", "P1", "RNOS-17 gate"],
    ["TC-HEALTH-01", "AI-UC-017", "Customer health score visible", "Mở /crm/health", "Score table populated", "", "Pass", "P1", "RNOS-19 gate"],
    ["TC-ANOMALY-01", "AI-UC-019", "Anomaly digest on insights", "Seed CPL spike → cron", "Digest entry on SCR-AI-001", "", "Pass", "P2", "RNOS-28 gate"],
    ["TC-PROJ-08", "META-UC-004", "Webhook Facebook tạo lead", "POST leadgen payload DA-A", "Lead trong /crm/leads + owner", "", "Pass", "P0", "facebook_webhook_payloads.json"],
    ["TC-WH-META-01", "PLAT-UC-004", "Webhook signature verify", "POST invalid signature", "401 rejected", "", "Pass", "P0", ""],
    ["TC-AUTH-01", "PLAT-UC-001", "Login admin staging", "Nhập admin credentials", "Redirect dashboard + caps", "", "Pass", "P0", "accounts.json → admin"],
    ["TC-PORTAL-01", "PORTAL-UC-001", "Portal login scoped client", "Login client viewer", "JWT scoped; /dashboard OK", "", "Pass", "P0", "playwright_portal_ai_summary_e2e.sh"],
    ["TC-LOOP-01", "SYS-UC-002", "Closed-loop attribution visible", "Lead from Meta → convert", "CPL/ROAS on business dashboard", "", "Pass", "P0", ""],
    ["TC-ISO-01", "SYS-UC-011", "Cross-tenant isolation", "Login tenant A; query tenant B data", "403 / empty result", "", "Pass", "P0", ""],
    ["TC-ZALO-01", "ZALO-UC-011", "Zalo webhook lead ingest", "POST zalo lead webhook", "Lead in CRM deduped", "", "Pass", "P0", "zalo_prod_cutover_gate.sh"],
    ["TC-EM-01", "EM-UC-001", "Email domain verify gate", "Send without verified domain", "Blocked with error", "", "Pass", "P0", "email_p1_gate.sh"],
    ["TC-SEO-01", "SEO-UC-012", "SEO hub drill-down", "Click tile → detail", "Reached in ≤3 clicks", "", "Pass", "P1", "seo_handoff_gate.sh"],
    ["TC-ONBOARD-01", "SYS-UC-001", "Client onboard checklist", "Create client → complete checklist", "Modules enabled", "", "Pass", "P0", ""],
    ["TC-MOB-01", "MOB-UC-001", "PWA staff gate manifest + mobile cards", "Run rnos41_pwa_gate.sh", "16/16 PASS manifest sw cards", "", "Pass", "P0", "scripts/rnos41_pwa_gate.sh"],
    ["TC-MOB-02", "MOB-UC-009", "Portal PWA + push gate", "Run rnos_m2_portal_pwa_gate.sh", "21/21 PASS portal PWA push", "", "Pass", "P0", "scripts/rnos_m2_portal_pwa_gate.sh"],
]

# ── Code registry (sheet 00_DanhSach_Ma) ─────────────────────────────────────
CODE_REGISTRY: list[tuple[str, str, str, str]] = [
    ("Màn hình", "SCR", "SCR-CRM-001", "Route ops-web / portal-web — sidebar menu"),
    ("Use case", "UC", "CRM-UC-001", "Luồng nghiệp vụ end-to-end theo module prefix"),
    ("Test case", "TC", "TC-CRM-001", "UAT / E2E / regression gate script"),
    ("Yêu cầu nghiệp vụ", "BR", "BR-CRM-001", "Business rule bắt buộc — traceability"),
    ("API endpoint", "API", "GET /api/v1/leads", "REST contract ptt-crm-api"),
    ("Deliverable RNOS", "RNOS", "RNOS-29", "Backlog spec §18 production coding"),
    ("Parity Getfly", "P0", "P0-2", "Import/export Excel CRM parity"),
    ("Lỗi / defect", "BUG", "BUG-001", "Tracker QA / incident"),
]

UC_MODULE_DOC: dict[str, str] = {
    "SYS": "docs/use-cases/00-SYSTEM-OVERVIEW.md",
    "CRM": "docs/use-cases/01-CRM-CORE.md",
    "SVC": "docs/use-cases/02-AGENCY-SERVICE-DELIVERY.md",
    "META": "docs/use-cases/03-META-ENTERPRISE.md",
    "SEO": "docs/use-cases/04-SEO-AEO.md",
    "EM": "docs/use-cases/05-EMAIL-MARKETING.md",
    "PORTAL": "docs/use-cases/06-CLIENT-PORTAL.md",
    "PLAT": "docs/use-cases/07-PLATFORM-AUTH-WEBHOOKS.md",
    "ZALO": "docs/use-cases/08-ZALO-ADS.md",
    "AI": "docs/use-cases/09-AI-REVENUE-OS.md",
    "MOB": "docs/specs/2026-08-01-rnosai-mobile-strategy-spec.md",
}


def _uc_doc_link(uc_id: str) -> str:
    prefix = uc_id.split("-", 1)[0]
    return UC_MODULE_DOC.get(prefix, "docs/use-cases/README.md")


def _index_use_cases_by_screen() -> dict[str, list[list]]:
    by_scr: dict[str, list[list]] = {}
    for uc in USE_CASES:
        for scr in uc[2].split(","):
            by_scr.setdefault(scr.strip(), []).append(uc)
    return by_scr


def _rules_for_screen(scr_id: str) -> list[str]:
    rules: set[str] = set()
    for uc in _index_use_cases_by_screen().get(scr_id, []):
        if uc[8]:
            rules.add(str(uc[8]))
    for row in TRACEABILITY:
        if scr_id in str(row[1]):
            rules.add(str(row[0]))
    return sorted(rules)


def _rules_for_uc(uc_id: str, rules_field: str) -> list[str]:
    if rules_field:
        return [rules_field]
    for row in TRACEABILITY:
        if uc_id in str(row[2]):
            return [str(row[0])]
    return []


def auto_screen_detail(row: list) -> dict:
    scr_id, name, module, route, roles, status, linked_ucs, version, owner, _priority, trace_ref, _updated, notes = row
    mod_label = next(
        (f"{mid} — {mname}" for mid, mname, _ in MODULES if module in (mid, mname) or module in mname),
        module,
    )
    app = "portal-web (portal.pttads.vn)" if module == "Portal" else "ops-web (rs.pttads.vn)"
    rules = _rules_for_screen(scr_id)
    return {
        "meta": [
            ("Mã màn hình", scr_id),
            ("Tên màn hình", name),
            ("Route", route),
            ("Module", mod_label),
            ("Ứng dụng", app),
            ("Mục đích", f"Thực hiện nghiệp vụ «{name}» trên route {route}"),
            ("Vai trò", roles),
            ("Điều kiện trước", f"Đã đăng nhập {app} + quyền module tương ứng"),
            ("Điều kiện sau", "Thao tác phản ánh đúng trạng thái nghiệp vụ trên DB/API"),
            ("Use case liên quan", linked_ucs),
            ("Parity / RNOS", trace_ref),
            ("Trạng thái triển khai", f"{status} (v{version})"),
            ("Owner", owner),
            ("Ghi chú", notes or "—"),
        ],
        "ui": [
            [1, f"{app.split()[0]} shell", "Layout", "Có", "Header + sidebar + vùng nội dung"],
            [2, "PageHeader", "Header", "Có", f"Tiêu đề màn hình: {name}"],
            [3, "MainContent", "Panel", "Có", notes or f"Dữ liệu / form chính route {route}"],
            [4, "ActionBar", "Toolbar", "Không", "Nút thao tác chính theo UC liên quan"],
            [5, "List / Form / Chart", "Content", "Có", "Bảng, biểu mẫu hoặc dashboard theo module"],
        ],
        "rules": rules or ["—"],
        "_auto": True,
    }


def auto_use_case_detail(row: list) -> dict:
    uc_id, name, screens, actor, priority, status, pre, post, rules_field, owner, wave, trace = row
    pri = {"High": "P0", "Medium": "P1", "Low": "P2"}.get(str(priority), str(priority))
    rules = _rules_for_uc(uc_id, str(rules_field))
    primary_scr = screens.split(",")[0].strip()
    return {
        "meta": [
            ("Mã use case", uc_id),
            ("Tên use case", name),
            ("Màn hình", screens),
            ("Actor chính", actor),
            ("Mục tiêu", name),
            ("Trigger", f"Người dùng hoặc hệ thống khởi phát «{name}»"),
            ("Pre-condition", pre or "Quyền và dữ liệu đầu vào hợp lệ"),
            ("Post-condition", post or "Trạng thái nghiệp vụ cập nhật và audit"),
            ("Ưu tiên", pri),
            ("Trạng thái", status),
            ("Owner", owner),
            ("Sprint/Wave", wave),
            ("Trace ref", trace),
            ("Tham chiếu chi tiết", _uc_doc_link(uc_id)),
        ],
        "main_flow": [
            [1, f"Actor «{actor}» mở màn hình {primary_scr}"],
            [2, f"Thực hiện thao tác: {name}"],
            [3, "Hệ thống kiểm tra pre-condition + RBAC cap"],
            [4, "API ptt-crm-api xử lý và ghi audit/domain event"],
            [5, f"Post-condition: {post or 'Hoàn tất luồng nghiệp vụ'}"],
        ],
        "alt_flow": [
            ["E1", "Thiếu quyền → HTTP 403 + thông báo"],
            ["E2", "Dữ liệu không hợp lệ → validate message + không persist"],
            ["E3", "Lỗi hệ thống → retry / incident theo PLAT-UC-008"],
        ],
        "io": [
            ["Input", pre or f"Payload thao tác {uc_id}"],
            ["Output", post or f"Kết quả nghiệp vụ {uc_id}"],
        ],
        "rules": rules or ["—"],
        "_auto": True,
    }


def get_all_screen_details() -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for row in SCREENS:
        scr_id = str(row[0])
        if scr_id in SCREEN_DETAILS:
            merged[scr_id] = SCREEN_DETAILS[scr_id]
        elif scr_id in DEEP_SCREEN_DETAILS:
            merged[scr_id] = DEEP_SCREEN_DETAILS[scr_id]
        elif scr_id in ENRICHED_SCREEN_DETAILS:
            merged[scr_id] = ENRICHED_SCREEN_DETAILS[scr_id]
        else:
            merged[scr_id] = auto_screen_detail(row)
    return merged


def get_all_use_case_details() -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for row in USE_CASES:
        uc_id = str(row[0])
        if uc_id in USE_CASE_DETAILS:
            merged[uc_id] = USE_CASE_DETAILS[uc_id]
        else:
            merged[uc_id] = auto_use_case_detail(row)
    return merged


def manual_use_case_count() -> int:
    return sum(1 for u in USE_CASES if USE_CASE_DETAILS.get(str(u[0]), {}).get("_manual"))


def manual_screen_count() -> int:
    return sum(1 for s in SCREENS if not get_all_screen_details().get(str(s[0]), {}).get("_auto"))


from rnosai_ba_scr_details_enriched import build_all_enriched_screen_details  # noqa: E402
from rnosai_ba_scr_details_crm import CRM_SCR_OVERRIDES  # noqa: E402
from rnosai_ba_scr_details_seo import SEO_SCR_OVERRIDES  # noqa: E402
from rnosai_ba_scr_details_em import EM_SCR_OVERRIDES  # noqa: E402
from rnosai_ba_scr_details_portal import PORTAL_SCR_OVERRIDES  # noqa: E402
from rnosai_ba_scr_details_mob import MOB_SCR_OVERRIDES  # noqa: E402
from rnosai_ba_scr_deep_builder import merge_deep_specs  # noqa: E402

DEEP_SCREEN_DETAILS: dict[str, dict] = {
    **merge_deep_specs(
        SCREENS,
        CRM_SCR_OVERRIDES,
        _rules_for_screen,
        prefix="SCR-CRM-",
        skip=set(SCREEN_DETAILS),
    ),
    **merge_deep_specs(
        SCREENS,
        SEO_SCR_OVERRIDES,
        _rules_for_screen,
        prefix="SCR-SEO-",
        skip=set(SCREEN_DETAILS),
    ),
    **merge_deep_specs(
        SCREENS,
        EM_SCR_OVERRIDES,
        _rules_for_screen,
        prefix="SCR-EM-",
        skip=set(SCREEN_DETAILS),
    ),
    **merge_deep_specs(
        SCREENS,
        PORTAL_SCR_OVERRIDES,
        _rules_for_screen,
        prefix="SCR-PORTAL-",
        skip=set(SCREEN_DETAILS),
    ),
    **merge_deep_specs(
        SCREENS,
        MOB_SCR_OVERRIDES,
        _rules_for_screen,
        prefix="SCR-MOB-",
        skip=set(SCREEN_DETAILS),
    ),
}

ENRICHED_SCREEN_DETAILS: dict[str, dict] = build_all_enriched_screen_details(
    SCREENS,
    _rules_for_screen,
    skip_ids=set(SCREEN_DETAILS) | set(DEEP_SCREEN_DETAILS),
    modules=MODULES,
)
