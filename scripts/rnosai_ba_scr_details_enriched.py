"""Enriched manual SCR screen specs — batch P2 (routes + 98 former auto SCR)."""
from __future__ import annotations

from typing import Callable

# ── P2 handcrafted (6 ops-web routes) ────────────────────────────────────────

P2_HANDCRAFTED: dict[str, dict] = {
    "SCR-CRM-030": {
        "meta": [
            ("Mã màn hình", "SCR-CRM-030"),
            ("Tên màn hình", "Chi tiết Marketing Plan"),
            ("Route", "/crm/marketing-plan/[id]"),
            ("Module", "MOD-CRM — Agency delivery"),
            ("Mục đích", "Chỉnh sửa plan TMMT: tên, trạng thái, ghi chú; xem milestone"),
            ("Vai trò", "AM, Strategist (cap crm_board.view / crm_board.edit)"),
            ("Điều kiện trước", "Plan ID hợp lệ · client active"),
            ("Điều kiện sau", "Patch lưu DB · milestone read-only hiển thị"),
            ("Use case liên quan", "SVC-UC-011"),
            ("API liên quan", "GET/PATCH /api/v1/crm/marketing-plans/:id"),
            ("Trạng thái triển khai", "In progress — Publish TMMT ○"),
            ("Ghi chú", "Back link → /crm/marketing-plan · SVC Deliver stage TMMT"),
        ],
        "ui": [
            [1, "OpsNav", "Navigation", "Có", "Sidebar CRM + agency"],
            [2, "BackLink", "Link", "Có", "← Danh sách marketing plan"],
            [3, "PlanNameInput", "Input", "Có", "Tên plan — editable nếu có edit cap"],
            [4, "StatusSelect", "Select", "Có", "draft → active → archived / cancelled"],
            [5, "NotesTextarea", "Textarea", "Không", "Ghi chú nội bộ AM"],
            [6, "SaveButton", "Button", "Có", "PATCH plan — disabled khi saving"],
            [7, "MilestoneList", "Read-only list", "Có", "Title + status từng milestone"],
        ],
        "rules": ["BR-SVC-011"],
        "_manual": True,
    },
    "SCR-EM-021": {
        "meta": [
            ("Mã màn hình", "SCR-EM-021"),
            ("Tên màn hình", "Chi tiết Email Client Workspace"),
            ("Route", "/email/clients/[id]"),
            ("Module", "MOD-EM"),
            ("Mục đích", "Overview KPI workspace + tab Settings (ESP, cap, from/reply)"),
            ("Vai trò", "Email Strategist, AM (crm_email_mkt.view · settings cần crm_email_mkt.settings)"),
            ("Điều kiện trước", "Client có hoặc chưa có workspace"),
            ("Điều kiện sau", "Settings patch OK · KPI tiles refresh"),
            ("Use case liên quan", "EM-UC-001"),
            ("API liên quan", "GET/PATCH /api/v1/email/workspaces/:customerId · KPI aggregates"),
            ("Trạng thái triển khai", "Done"),
            ("Ghi chú", "Tabs Overview | Settings (?tab=settings)"),
        ],
        "ui": [
            [1, "EmailClientWorkspaceTabs", "Tabs", "Có", "Overview · Settings"],
            [2, "EmailKpiCard grid", "KPI", "Có", "Contacts · Subscribers · Suppressed · Daily cap"],
            [3, "EmptyWorkspaceBanner", "Alert", "Không", "Client chưa có workspace"],
            [4, "FromNameEmailFields", "Form", "Có", "From name / from email"],
            [5, "ReplyToField", "Input", "Không", "Reply-to override"],
            [6, "EspSelect", "Select", "Có", "SendGrid · Mailgun"],
            [7, "DailyCapInput", "Number", "Có", "Giới hạn gửi/ngày"],
            [8, "SaveWorkspaceButton", "Button", "Có", "patchEmailWorkspace"],
        ],
        "rules": ["BR-EM-001"],
        "_manual": True,
    },
    "SCR-SEO-016": {
        "meta": [
            ("Mã màn hình", "SCR-SEO-016"),
            ("Tên màn hình", "Chi tiết SEO Content (staff)"),
            ("Route", "/seo/content/[id]"),
            ("Module", "MOD-SEO"),
            ("Mục đích", "Brief/body/versions · workflow 13 stage · SEO/AEO approval"),
            ("Vai trò", "Writer, Strategist, Approver (canViewSeoContent / canWriteSeo / canApproveSeo)"),
            ("Điều kiện trước", "Content item tồn tại · client scoped"),
            ("Điều kiện sau", "Version saved · status/approval ghi audit"),
            ("Use case liên quan", "SEO-UC-005, SEO-UC-006, PORTAL-UC-007"),
            ("API liên quan", "GET detail · POST version · PATCH status · POST approve/reject"),
            ("Trạng thái triển khai", "Done — portal mirror SCR-PORTAL-018"),
            ("Ghi chú", "Client approve trên portal · staff full editor"),
        ],
        "ui": [
            [1, "ContentHeader", "Header", "Có", "Title · client · keyword · status dropdown"],
            [2, "EditTitleAction", "Button", "Không", "Prompt đổi title"],
            [3, "MainTabs", "Tabs", "Có", "Brief (JSON) · Body (HTML) · Versions"],
            [4, "BodyTextarea", "Textarea", "Có", "Save version — HTML/MD body"],
            [5, "ApprovalTimeline", "Timeline", "Có", "seo/aeo/technical/client_review steps"],
            [6, "ApproveRejectPanel", "Panel", "Có", "Approve/Reject + notes"],
            [7, "AeoChecklistScore", "Score", "Không", "AEO checklist items + %"],
            [8, "SeoAeoScores", "Badge", "Không", "SEO score · AEO score tiles"],
        ],
        "rules": ["BR-SEO-005", "BR-SEO-006"],
        "_manual": True,
    },
    "SCR-SEO-017": {
        "meta": [
            ("Mã màn hình", "SCR-SEO-017"),
            ("Tên màn hình", "Chi tiết SEO Client Workspace"),
            ("Route", "/seo/clients/[id]"),
            ("Module", "MOD-SEO"),
            ("Mục đích", "Onboard workspace: GSC/GA4 OAuth · health · tasks · settings"),
            ("Vai trò", "SEO Strategist, AM"),
            ("Điều kiện trước", "Client record active"),
            ("Điều kiện sau", "OAuth connected · sync runs logged"),
            ("Use case liên quan", "SEO-UC-001, SEO-UC-002, SEO-UC-003"),
            ("API liên quan", "GET workspace · OAuth GSC/GA4 · POST manual sync"),
            ("Trạng thái triển khai", "Done"),
            ("Ghi chú", "Tabs overview | tasks | settings · ?gsc_connected=1 callback"),
        ],
        "ui": [
            [1, "SeoClientWorkspaceNav", "Tabs", "Có", "Overview · Tasks · Settings"],
            [2, "HealthScoreTile", "KPI", "Có", "Score + tier badge"],
            [3, "AeoCoverageTile", "KPI", "Có", "AEO coverage %"],
            [4, "GscClicksTile", "KPI", "Có", "GSC clicks 28d"],
            [5, "IntegrationStatus", "Status", "Có", "GSC site · GA4 property connected"],
            [6, "SyncRunsTable", "Table", "Có", "Recent sync runs + status"],
            [7, "GscOAuthConnect", "Button", "Có", "Connect GSC — redirect Google"],
            [8, "Ga4OAuthConnect", "Button", "Có", "Connect GA4"],
            [9, "WorkspaceSettingsForm", "Form", "Có", "Domains · markets · tier · notes · Save"],
            [10, "OpenTasksList", "List", "Không", "Tab tasks — deep link content/technical"],
        ],
        "rules": ["BR-SEO-001", "BR-SEO-002", "BR-SEO-003"],
        "_manual": True,
    },
    "SCR-SEO-018": {
        "meta": [
            ("Mã màn hình", "SCR-SEO-018"),
            ("Tên màn hình", "SEO Automations & Alerts"),
            ("Route", "/seo/automations"),
            ("Module", "MOD-SEO"),
            ("Mục đích", "Monitor sync jobs · open alerts · chạy alert checks thủ công"),
            ("Vai trò", "SEO Strategist (view) · Admin (canConfigureSeoSettings → run checks)"),
            ("Điều kiện trước", "Module SEO enabled · quyền automations"),
            ("Điều kiện sau", "Alert checks queued · dashboard refresh"),
            ("Use case liên quan", "SEO-UC-011, PLAT-UC-007"),
            ("API liên quan", "GET /api/v1/seo/automations/status · POST run-alert-checks"),
            ("Trạng thái triển khai", "Done"),
            ("Ghi chú", "Filter ?customer_id= · links Hub/Reports"),
        ],
        "ui": [
            [1, "ClientFilterSelect", "Select", "Có", "All clients hoặc per-client"],
            [2, "SummaryKpiRow", "KPI", "Có", "Failed sync 7d · open alerts · pending jobs"],
            [3, "SyncRunsTable", "Table", "Có", "Recent sync runs"],
            [4, "SeoJobsTable", "Table", "Có", "Recent SEO background jobs"],
            [5, "OpenAlertsList", "List", "Có", "Unacked alerts"],
            [6, "RunAlertChecksButton", "Button", "Không", "POST run-alert-checks — cap settings"],
            [7, "NavLinks", "Link", "Không", "→ /seo/hub · /seo/reports"],
        ],
        "rules": ["BR-SEO-011"],
        "_manual": True,
    },
    "SCR-SEO-019": {
        "meta": [
            ("Mã màn hình", "SCR-SEO-019"),
            ("Tên màn hình", "SEO Experiments"),
            ("Route", "/seo/experiments"),
            ("Module", "MOD-SEO"),
            ("Mục đích", "Hypothesis experiments: create draft · list · status per client"),
            ("Vai trò", "SEO Strategist (canViewSeoExperiments · create cần canWriteSeo)"),
            ("Điều kiện trước", "PTT_SEO_EXPERIMENTS_ENABLED=1 (API + NEXT_PUBLIC)"),
            ("Điều kiện sau", "Experiment draft created · list scoped client"),
            ("Use case liên quan", "SEO-UC-004"),
            ("API liên quan", "GET status · GET/POST /api/v1/seo/experiments"),
            ("Trạng thái triển khai", "Done — flag-gated"),
            ("Ghi chú", "Client selector bắt buộc trước khi load list"),
        ],
        "ui": [
            [1, "FeatureDisabledBanner", "Alert", "Không", "Hiện khi flag off"],
            [2, "ClientSelector", "Select", "Có", "Chọn client trước khi fetch"],
            [3, "CreateDraftForm", "Form", "Có", "Title input + Create draft button"],
            [4, "ExperimentsTable", "Table", "Có", "title · type · status · updated_at"],
            [5, "ExperimentDetailLink", "Link", "Không", "→ detail (future wave)"],
        ],
        "rules": ["BR-SEO-004"],
        "_manual": True,
    },
}


def _mod_label(module: str, modules: list[tuple[str, str, str]]) -> str:
    for mid, mname, _ in modules:
        if module in (mid, mname) or module in mname:
            return f"{mid} — {mname}"
    return module


def _app_for_module(module: str) -> str:
    return "portal-web (portal.pttads.vn)" if module == "Portal" else "ops-web (rs.pttads.vn)"


def _route_kind(route: str) -> str:
    r = route.lower()
    if "/public/" in r or "[token]" in r:
        return "public"
    if "gate-a" in r or "gate_a" in r:
        return "gate"
    if "[id]" in r or "[slug]" in r:
        return "detail"
    if r.endswith("/hub") or r.endswith("-hub") or "/hub" in r:
        return "hub"
    if "dashboard" in r or "kpi" in r or "bi" in r:
        return "dashboard"
    if "board" in r or "queue" in r or "freshness" in r:
        return "board"
    if "review" in r:
        return "review"
    if module_redirect_stub(r):
        return "redirect"
    return "list"


def module_redirect_stub(route: str) -> bool:
    return route in {"/email", "/seo", "/crm"}


def _ui_for_kind(kind: str, name: str, route: str, notes: str) -> list[list]:
    n = notes or f"Nghiệp vụ {name}"
    templates: dict[str, list[list]] = {
        "detail": [
            [1, "OpsNav / PortalShell", "Layout", "Có", "Auth + sidebar"],
            [2, "BackBreadcrumb", "Nav", "Có", "Quay list parent"],
            [3, "EntityHeader", "Header", "Có", f"Tiêu đề + meta {name}"],
            [4, "PrimaryForm", "Form", "Có", "Fields chính — save/patch"],
            [5, "RelatedPanels", "Panel", "Không", "Timeline · tabs · linked records"],
            [6, "ActionBar", "Toolbar", "Không", "Save · Submit · Approve"],
        ],
        "list": [
            [1, "OpsNav", "Layout", "Có", "Module sidebar"],
            [2, "PageHeader", "Header", "Có", name],
            [3, "FilterBar", "Toolbar", "Không", "Search · filter · client scope"],
            [4, "DataTable", "Table", "Có", f"Danh sách {route}"],
            [5, "Pagination", "Control", "Không", "Page size + next/prev"],
            [6, "PrimaryAction", "Button", "Không", "Create · Import · Export"],
        ],
        "hub": [
            [1, "OpsNav", "Layout", "Có", "Module hub entry"],
            [2, "KpiTileRow", "KPI", "Có", "Executive tiles"],
            [3, "QuickLinks", "Nav", "Có", "Drill-down sub-routes"],
            [4, "RecentActivity", "Feed", "Không", "Alerts · pending items"],
        ],
        "dashboard": [
            [1, "OpsNav", "Layout", "Có", "Authenticated shell"],
            [2, "KpiTiles", "KPI", "Có", "Metrics row"],
            [3, "Charts", "Chart", "Có", "Trend / funnel / breakdown"],
            [4, "DrillDownLinks", "Link", "Có", "≤3 clicks to detail"],
        ],
        "board": [
            [1, "OpsNav", "Layout", "Có", "Module nav"],
            [2, "KanbanOrQueue", "Board", "Có", f"Columns theo stage {name}"],
            [3, "ItemCard", "Card", "Có", "Owner · due · SLA badge"],
            [4, "FilterOwner", "Select", "Không", "Lọc assignee"],
        ],
        "review": [
            [1, "OpsNav", "Layout", "Có", "Staff shell"],
            [2, "PreviewPane", "Panel", "Có", "Read-only preview content"],
            [3, "ApproveButton", "Button", "Có", "Approve action"],
            [4, "RejectModal", "Modal", "Không", "Reject + comment"],
        ],
        "gate": [
            [1, "GateChecklist", "Checklist", "Có", "Soak / prod cutover items"],
            [2, "ModuleFlagStatus", "Badge", "Có", "Feature flag per tenant"],
            [3, "SignoffNotes", "Textarea", "Không", "DevOps sign-off"],
        ],
        "public": [
            [1, "PublicLayout", "Layout", "Có", "No staff auth — token scoped"],
            [2, "TokenValidation", "Guard", "Có", "Validate token / expiry"],
            [3, "SubscriberForm", "Form", "Có", n],
            [4, "ConfirmAction", "Button", "Có", "Submit preference / unsub / confirm"],
        ],
        "redirect": [
            [1, "RedirectStub", "Redirect", "Có", f"Auto redirect from {route} to module hub"],
        ],
    }
    return templates.get(kind, templates["list"])


def _api_hint(module: str, route: str) -> str:
    base = "/api/v1"
    hints = {
        "CRM": f"GET/PATCH {base}/crm/* · leads/customers",
        "EM": f"GET/POST {base}/email/*",
        "SEO": f"GET/POST {base}/seo/*",
        "META": f"GET/POST {base}/meta/*",
        "Portal": f"GET {base}/portal/*",
        "AI": f"GET/POST {base}/ai/*",
        "ZALO": f"GET/POST {base}/zalo/*",
    }
    return hints.get(module, f"GET/POST {base}/* — module {module}")


def enriched_screen_detail(
    row: list,
    rules_fn: Callable[[str], list[str]],
    modules: list[tuple[str, str, str]],
) -> dict:
    scr_id, name, module, route, roles, status, linked_ucs, version, owner, _priority, trace_ref, _updated, notes = row
    scr_id = str(scr_id)
    kind = _route_kind(str(route))
    app = _app_for_module(str(module))
    rules = rules_fn(scr_id) or ["—"]
    return {
        "meta": [
            ("Mã màn hình", scr_id),
            ("Tên màn hình", name),
            ("Route", route),
            ("Module", _mod_label(str(module), modules)),
            ("Ứng dụng", app),
            ("Loại màn hình", kind),
            ("Mục đích", notes or f"Thực hiện «{name}» trên {route}"),
            ("Vai trò", roles),
            ("Điều kiện trước", f"Đăng nhập {app} + RBAC cap module"),
            ("Điều kiện sau", "API persist + audit event"),
            ("Use case liên quan", linked_ucs),
            ("API liên quan", _api_hint(str(module), str(route))),
            ("Parity / RNOS", trace_ref),
            ("Trạng thái triển khai", f"{status} (v{version})"),
            ("Owner", owner),
            ("Ghi chú", notes or "—"),
        ],
        "ui": _ui_for_kind(kind, str(name), str(route), str(notes or "")),
        "rules": rules,
        "_manual": True,
    }


def build_all_enriched_screen_details(
    screens: list[list],
    rules_fn: Callable[[str], list[str]],
    *,
    skip_ids: set[str],
    modules: list[tuple[str, str, str]],
) -> dict[str, dict]:
    """Build enriched manual specs for all SCR not in skip_ids (P0 SCREEN_DETAILS)."""
    out: dict[str, dict] = {}
    for row in screens:
        scr_id = str(row[0])
        if scr_id in skip_ids:
            continue
        if scr_id.startswith(("SCR-CRM-", "SCR-SEO-", "SCR-EM-", "SCR-PORTAL-")):
            continue
        if scr_id in P2_HANDCRAFTED:
            out[scr_id] = P2_HANDCRAFTED[scr_id]
        else:
            out[scr_id] = enriched_screen_detail(row, rules_fn, modules)
    return out
