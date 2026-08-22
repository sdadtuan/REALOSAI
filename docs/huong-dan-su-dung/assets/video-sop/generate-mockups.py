#!/usr/bin/env python3
"""Generate wireframe SVG mockups for Video SOP UI screens."""
from pathlib import Path

OUT = Path(__file__).parent
W, H = 1120, 640

# Colors
BG = "#f8fafc"
SHELL = "#0f172a"
BANNER = "#e2e8f0"
CARD = "#ffffff"
BORDER = "#cbd5e1"
MUTED = "#64748b"
ACCENT = "#2563eb"
ACCENT_LIGHT = "#dbeafe"
BTN = "#2563eb"
BTN_SEC = "#e2e8f0"
HIGHLIGHT = "#fef3c7"
LABEL = "#dc2626"


def shell(title: str, breadcrumb: str, banner: str, body: str, route: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <style>
      text {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
      .t {{ fill: #0f172a; font-size: 13px; }}
      .ts {{ fill: #64748b; font-size: 11px; }}
      .tb {{ fill: #fff; font-size: 12px; font-weight: 600; }}
      .hl {{ fill: {LABEL}; font-size: 10px; font-weight: 600; }}
    </style>
  </defs>
  <rect width="{W}" height="{H}" fill="{BG}"/>
  <!-- Top shell -->
  <rect x="0" y="0" width="{W}" height="48" fill="{SHELL}"/>
  <text x="20" y="30" class="tb">RNOSAI · ops-web</text>
  <text x="820" y="30" class="tb" font-size="11" opacity="0.85">rs.pttads.vn</text>
  <!-- Sidebar hint -->
  <rect x="0" y="48" width="180" height="{H-48}" fill="#f1f5f9"/>
  <text x="20" y="80" class="ts">CRM</text>
  <rect x="12" y="92" width="156" height="28" rx="4" fill="{ACCENT_LIGHT}"/>
  <text x="24" y="111" class="t" font-weight="600">Video SOP</text>
  <text x="20" y="140" class="ts">Content OS</text>
  <text x="20" y="162" class="ts">Service Delivery</text>
  <!-- Main -->
  <rect x="180" y="48" width="{W-180}" height="{H-48}" fill="{BG}"/>
  <text x="200" y="78" class="ts">{breadcrumb}</text>
  <text x="200" y="102" class="t" font-size="18" font-weight="700">{title}</text>
  <text x="200" y="122" class="ts">{route}</text>
  <!-- Banner -->
  <rect x="200" y="134" width="880" height="36" rx="4" fill="{BANNER}" stroke="{BORDER}"/>
  <text x="214" y="157" class="ts">{banner}</text>
  <!-- Body card -->
  <rect x="200" y="182" width="880" height="{H-200}" rx="6" fill="{CARD}" stroke="{BORDER}"/>
  {body}
  <!-- Footer note -->
  <text x="200" y="{H-12}" class="ts">Wireframe mockup · Module 7 Video SOP · không phải screenshot production</text>
</svg>"""


def btn(x, y, w, label, primary=True, highlight=False):
    fill = ACCENT if primary else BTN_SEC
    tc = "#fff" if primary else "#0f172a"
    stroke = ""
    if highlight:
        stroke = f' stroke="{LABEL}" stroke-width="2" stroke-dasharray="4 2"'
    return f"""
  <rect x="{x}" y="{y}" width="{w}" height="32" rx="4" fill="{fill}"{stroke}/>
  <text x="{x + 12}" y="{y + 21}" fill="{tc}" font-size="11" font-weight="600">{label}</text>"""


def field(x, y, w, label, value="", h=28):
    return f"""
  <text x="{x}" y="{y}" class="ts">{label}</text>
  <rect x="{x}" y="{y+6}" width="{w}" height="{h}" rx="3" fill="#fff" stroke="{BORDER}"/>
  <text x="{x+8}" y="{y+24}" class="t" font-size="11">{value}</text>"""


def table(x, y, w, headers, rows, col_w=None):
    if not col_w:
        col_w = [w // len(headers)] * len(headers)
    parts = [f'<rect x="{x}" y="{y}" width="{w}" height="24" fill="#f1f5f9" stroke="{BORDER}"/>']
    cx = x
    for i, h in enumerate(headers):
        parts.append(f'<text x="{cx+6}" y="{y+16}" class="t" font-size="10" font-weight="600">{h}</text>')
        cx += col_w[i]
    ry = y + 24
    for row in rows:
        parts.append(f'<rect x="{x}" y="{ry}" width="{w}" height="22" fill="#fff" stroke="{BORDER}"/>')
        cx = x
        for i, cell in enumerate(row):
            parts.append(f'<text x="{cx+6}" y="{ry+15}" class="ts" font-size="10">{cell}</text>')
            cx += col_w[i]
        ry += 22
    return "\n".join(parts)


def callout(x, y, text):
    return f"""
  <text x="{x}" y="{y}" class="hl">▶ {text}</text>"""


MOCKUPS = {
    "01-content-board-picker": shell(
        "Content Board — Media AI",
        "CRM › Service Delivery › Content OS › Media AI",
        "Chọn studio video — không đổi sau khi đã có job",
        f"""
  <text x="220" y="210" class="t" font-weight="600">Chọn studio video</text>
  <rect x="220" y="222" width="400" height="120" rx="8" fill="#fff" stroke="{BORDER}"/>
  <text x="236" y="248" class="t" font-weight="600">Video tuần (FFmpeg)</text>
  <text x="236" y="268" class="ts">15–35s · TTS + B-roll · caption</text>
  <rect x="640" y="222" width="400" height="120" rx="8" fill="{ACCENT_LIGHT}" stroke="{ACCENT}" stroke-width="2"/>
  <text x="656" y="248" class="t" font-weight="600">Video chiến dịch (SOP)</text>
  <text x="656" y="268" class="ts">15–60s · 4 cổng QC · keyframe → Kling/Runway</text>
  {callout(656, 318, "Bấm thẻ này để tạo vd_project")}
  <text x="656" y="300" class="ts">Mở hub /crm/video (không form beat Media AI)</text>
""",
        "/crm/service-delivery/{{id}}?tab=content-os",
    ),
    "02-hub-list": shell(
        "Video SOP — Hub",
        "CRM › Video SOP",
        "Danh sách project cinematic theo lifecycle",
        f"""
  {field(220, 210, 200, "lifecycle_id", "3")}
  {table(220, 260, 820, ["ID", "Title", "Stage", "Created"], [
      ["42", "Campaign Tet 2026", "scripting", "2026-08-20"],
      ["41", "Brand film Q3", "keyframes", "2026-08-18"],
  ], [60, 280, 160, 120])}
  {callout(220, 360, "Click dòng → overview project")}
  <text x="220" y="390" class="ts">Hub trống: «Chọn Video chiến dịch từ Content Board»</text>
""",
        "/crm/video?lifecycle_id=3",
    ),
    "03-overview": shell(
        "Video #42 — Tổng quan (SC-02)",
        "CRM › Video SOP › Campaign Tet 2026",
        "S9 — Delivery SC-13 + Gate 4 live · Post · Cost · Portal review",
        f"""
  <text x="220" y="210" class="ts">Brief · Script · Bible · Keyframes · Gate 1 · Gate 2 · Render · Takes · Gate 3 · Cost · Post · Gate 4 · Delivery</text>
  <text x="220" y="240" class="t" font-weight="600">Metadata</text>
  <text x="220" y="260" class="ts">stage: keyframe_pending · cmkt_item_id: 881 · lifecycle #3</text>
  {table(220, 280, 820, ["Job ID", "Type", "Status", "Model"], [
      ["901", "cine_keyframe", "succeeded", "image.leonardo.lucid_origin"],
      ["902", "cine_motion_draft", "running", "video.runway.gen4_turbo_draft"],
  ], [70, 180, 100, 280])}
  {btn(220, 380, 180, "Tạo job keyframe thử", True, True)}
  {callout(410, 400, "Debug nhanh — production dùng Keyframes SC-06")}
""",
        "/crm/video/42",
    ),
    "04-brief": shell(
        "Brief 8 nhóm (SC-03)",
        "CRM › Video SOP › #42 › Brief",
        "S3 — 8 nhóm SOP · Insight M6 được để trống",
        f"""
  {field(220, 210, 380, "objective (≥8 ký tự)", "Tăng nhận diện thương hiệu…")}
  {field(620, 210, 380, "audience", "Gen Z 18–24, TP.HCM")}
  {field(220, 260, 380, "offer", "Ưu đãi launch sản phẩm mới")}
  {field(620, 260, 180, "duration_sec (15–60)", "30")}
  {field(820, 260, 180, "platform", "reels ▾")}
  {field(220, 320, 380, "tone", "Trẻ trung, năng động")}
  {field(620, 320, 380, "constraints", "Không competitor, logo góc phải")}
  <text x="220" y="390" class="ts">insight_ids: [] — Không có insight approved — được để trống</text>
  {btn(220, 410, 100, "Lưu brief")}
  {btn(330, 410, 200, "Đánh dấu brief sẵn sàng", True, True)}
""",
        "/crm/video/42/brief",
    ),
    "05-script": shell(
        "Script & Shotlist (SC-04)",
        "CRM › Video SOP › #42 › Script",
        "S3 — 3 cột template · ý tưởng · shotlist",
        f"""
  <rect x="220" y="205" width="260" height="280" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="230" y="228" class="t" font-weight="600">Template</text>
  <text x="230" y="250" class="ts">Prompt seed campaign…</text>
  <rect x="490" y="205" width="260" height="280" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="500" y="228" class="t" font-weight="600">Ý tưởng / Script</text>
  {btn(500, 240, 120, "Sinh 3 ý tưởng", True, True)}
  {btn(630, 240, 100, "Chọn ý tưởng")}
  {btn(500, 280, 100, "Lưu script", True)}
  <rect x="760" y="205" width="320" height="280" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="770" y="228" class="t" font-weight="600">Shotlist</text>
  <text x="770" y="252" class="ts">#1 · 5000ms · 9:16 · FR-R03</text>
  <text x="770" y="272" class="ts">#2 · 4000ms · 9:16 · OK</text>
  {btn(770, 290, 100, "Thêm shot", True, True)}
""",
        "/crm/video/42/script",
    ),
    "06-bible": shell(
        "Style + Character Bible (SC-05)",
        "CRM › Video SOP › #42 › Bible",
        "S4 — Style + Character bible · BR-03 lock region",
        f"""
  <text x="220" y="210" class="t" font-weight="600">Style</text>
  {field(220, 220, 400, "palette", "teal, coral, cream")}
  {field(640, 220, 400, "lens", "35mm anamorphic")}
  {field(220, 280, 400, "lighting", "golden hour soft")}
  {field(640, 280, 400, "refs", "ref1.jpg, ref2.jpg")}
  {btn(220, 340, 100, "Lưu style")}
  <text x="220" y="390" class="t" font-weight="600">Characters</text>
  {field(220, 400, 200, "name", "Mai")}
  {field(440, 400, 300, "lock_regions", "{{lock:face}}")}
  {btn(220, 450, 120, "Thêm nhân vật")}
  {btn(350, 450, 120, "Lưu characters", True, True)}
""",
        "/crm/video/42/bible",
    ),
    "07-keyframes": shell(
        "Keyframe Workbench (SC-06)",
        "CRM › Video SOP › #42 › Keyframes",
        "S5 — Keyframe thử theo shot · Gate 2 review SC-10",
        f"""
  <rect x="220" y="205" width="180" height="300" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="230" y="228" class="t" font-weight="600">Shots</text>
  <rect x="230" y="240" width="160" height="36" rx="4" fill="{ACCENT}" stroke="{ACCENT}"/>
  <text x="242" y="262" fill="#fff" font-size="10">#1 · Hero opening</text>
  <rect x="230" y="282" width="160" height="36" rx="4" fill="#fff" stroke="{BORDER}"/>
  <text x="242" y="304" class="ts">#2 · Product close-up</text>
  <rect x="410" y="205" width="420" height="300" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="420" y="228" class="t" font-weight="600">Keyframes (max 4 tiles)</text>
  <rect x="420" y="240" width="190" height="120" rx="4" fill="#e2e8f0"/>
  <text x="430" y="300" class="ts">preview · sha a3f2…</text>
  <rect x="620" y="240" width="190" height="120" rx="4" fill="#e2e8f0"/>
  {btn(420, 380, 180, "Tạo keyframe cho shot", True, True)}
  <rect x="850" y="205" width="210" height="300" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="860" y="228" class="t" font-weight="600">Gate 2 — SC-10</text>
  <text x="860" y="260" class="ts">Link → /gates/2</text>
""",
        "/crm/video/42/keyframes",
    ),
    "08-gate": shell(
        "Gate Review (SC-10)",
        "CRM › Video SOP › #42 › Gate 2",
        "S5 — Gate 2 keyframe · AC-R3 animating",
        f"""
  {table(220, 210, 600, ["Checklist", "OK"], [
      ["Mọi shot có ≥1 keyframe succeeded", "✓"],
      ["Không shot keyframe_pending", "✓"],
      ["Stage ≥ animating_ready", "✗"],
  ], [480, 120])}
  {btn(220, 310, 90, "Approve", True, True)}
  {btn(320, 310, 80, "Reject")}
  <rect x="220" y="355" width="400" height="50" rx="3" fill="#fff" stroke="{BORDER}"/>
  <text x="230" y="375" class="ts">Reject reason</text>
  <rect x="230" y="385" width="12" height="12" fill="#fff" stroke="{BORDER}"/>
  <text x="250" y="395" class="ts">Override (bỏ qua checklist)</text>
  <text x="220" y="430" class="ts">Gate 1: shotlist · Gate 3: clip_selected · Gate 4: QC auto</text>
""",
        "/crm/video/42/gates/2",
    ),
    "09-render": shell(
        "Motion Render (SC-07)",
        "CRM › Video SOP › #42 › Render",
        "S6 — Motion render · BR-07 final cần take draft passed",
        f"""
  <rect x="220" y="205" width="200" height="280" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="230" y="228" class="t" font-weight="600">Shots</text>
  <rect x="230" y="240" width="180" height="40" rx="4" fill="{ACCENT}"/>
  <text x="242" y="265" fill="#fff" font-size="10">#1 · keyframe_approved</text>
  <rect x="440" y="205" width="620" height="280" rx="4" fill="#fafafa" stroke="{BORDER}"/>
  <text x="450" y="228" class="t" font-weight="600">Credit estimate</text>
  <text x="450" y="252" class="ts">Job type: cine_motion_draft ▾</text>
  <text x="450" y="280" class="t" font-size="20" font-weight="700">credit_estimate: 48</text>
  <text x="450" y="300" class="ts">alert_threshold: 40 · needs_confirm: yes</text>
  <rect x="450" y="315" width="12" height="12" fill="#fff" stroke="{BORDER}"/>
  <text x="470" y="326" class="ts">Xác nhận vượt ngưỡng budget</text>
  {btn(450, 345, 180, "Enqueue draft motion", True, True)}
  {btn(640, 345, 180, "Enqueue final motion")}
  {callout(450, 395, "Draft → Runway · Final → Kling via Leonardo")}
""",
        "/crm/video/42/render",
    ),
    "10-takes": shell(
        "Takes Review (SC-08)",
        "CRM › Video SOP › #42 › Takes",
        "S6 — Takes review · playbackRate 0.25 · BR-08 block sau 5 fail",
        f"""
  <rect x="220" y="205" width="200" height="110" rx="4" fill="#1e293b"/>
  <text x="280" y="265" fill="#94a3b8" font-size="11">▶ take #1201 · 0.25x</text>
  <rect x="440" y="205" width="200" height="110" rx="4" fill="#1e293b"/>
  <text x="500" y="265" fill="#94a3b8" font-size="11">take #1202</text>
  <text x="220" y="340" class="t" font-weight="600">Score take #1201</text>
  <text x="220" y="362" class="ts">Verdict: passed ▾</text>
  <rect x="220" y="372" width="400" height="50" rx="3" fill="#fff" stroke="{BORDER}"/>
  <text x="230" y="400" class="ts">artifact_json.notes</text>
  {btn(220, 435, 90, "Ghi score")}
  {btn(320, 435, 200, "Chọn take (clip_selected)", True, True)}
""",
        "/crm/video/42/takes",
    ),
    "11-cost": shell(
        "Cost Ledger (SC-11)",
        "CRM › Video SOP › #42 › Cost",
        "S7 — Cost ledger · BR-06 reserve trước enqueue",
        f"""
  <text x="220" y="210" class="t" font-weight="600">Budget</text>
  <text x="220" y="232" class="ts">estimated_total: 120 · actual_total: 87 · warn90: yes</text>
  {field(220, 245, 120, "limit_amount", "150")}
  {field(360, 245, 100, "buffer_factor", "1.2")}
  {btn(480, 251, 100, "Lưu budget", True, True)}
  {table(220, 300, 820, ["id", "kind", "vendor", "amount"], [
      ["1", "reserve", "runway", "48.00"],
      ["2", "actual", "leonardo", "12.50"],
  ], [50, 120, 120, 100])}
  {btn(220, 400, 130, "Tải export.xlsx")}
  <text x="360" y="420" class="ts">Chỉ khi cancelled / archived</text>
""",
        "/crm/video/42/cost",
    ),
    "12-post": shell(
        "Post Pipeline (SC-09)",
        "CRM › Video SOP › #42 › Post",
        "S8 — Post pipeline · DAG cố định BR-09 · QC auto BR-12",
        f"""
  <text x="220" y="210" class="ts">Next node: <tspan font-weight="600">topaz_video_enhance</tspan></text>
  <text x="220" y="230" class="ts">Gate 4 auto: ok</text>
  {table(220, 250, 820, ["#", "node", "label", "status"], [
      ["1", "ffmpeg_compose", "Stitch clips", "succeeded"],
      ["2", "topaz_image", "Enhance stills", "skipped"],
      ["3", "topaz_video", "Starlight saga", "running"],
  ], [40, 160, 200, 100])}
  {btn(220, 360, 180, "Enqueue cine_compose", True, True)}
""",
        "/crm/video/42/post",
    ),
    "13-delivery": shell(
        "Delivery (SC-13)",
        "CRM › Video SOP › #42 › Delivery",
        "S9 — Delivery + Portal SC-14 · BR-14 TTL ≤14 ngày",
        f"""
  <text x="220" y="210" class="ts">Gate 4 status: approved · QC auto pass: yes</text>
  {table(220, 230, 820, ["package #", "files", "contains_human", "ai_disclosure"], [
      ["7", "TET2026_master.mp4, TET2026_social.mp4", "false", "true"],
  ], [80, 360, 120, 120])}
  {btn(220, 310, 180, "Tạo editor package", True, True)}
  {btn(220, 355, 260, "Tạo portal review link (14 ngày)")}
  <text x="220" y="400" class="ts">Portal SC-14: portal.pttads.vn/review/…</text>
""",
        "/crm/video/42/delivery",
    ),
    "14-dashboard": shell(
        "Production Dashboard (SC-16)",
        "CRM › Video SOP › Dashboard",
        "S10 — 7 benchmark KPI (BA §10.3)",
        f"""
  {field(220, 210, 120, "lifecycle_id", "3")}
  {table(220, 260, 820, ["Metric", "Value", "Target"], [
      ["Keyframe pass rate", "82.5%", "≥80%"],
      ["Clip pass rate", "71.0%", "≥70%"],
      ["Takes / shot", "2.3", "≤3.0"],
      ["Credit ratio", "0.92", "≤1.0"],
      ["Client rounds", "1.2", "≤2.0"],
      ["Lead days", "11.5", "≤14"],
      ["Override rate", "4.0%", "≤10%"],
  ], [280, 120, 120])}
""",
        "/crm/video/dashboard?lifecycle_id=3",
    ),
    "15-admin-providers": shell(
        "Video SOP — Providers (SC-15)",
        "Quản trị › AI & Automation › Video SOP — Providers",
        "Registry L5 — model_key · verified_at · capability_json",
        f"""
  <text x="220" y="210" class="t" font-weight="600">Providers</text>
  {table(220, 220, 500, ["code", "label"], [
      ["leonardo", "Leonardo AI"],
      ["runway", "Runway"],
      ["kling", "Kling (via Leonardo)"],
  ], [120, 200])}
  <text x="220" y="310" class="t" font-weight="600">Models</text>
  {table(220, 320, 820, ["model_key", "verified_at", "capability"], [
      ["image.leonardo.lucid_origin", "2026-08-20", "IMAGE_GEN · DIRECT"],
      ["video.runway.gen4_turbo_draft", "2026-08-20", "VIDEO_GEN · POLL"],
      ["video.kling.v3.pro", "2026-08-20", "VIDEO_GEN · VIA_LEONARDO"],
  ], [280, 100, 280])}
  {btn(220, 420, 120, "Thêm provider")}
  {btn(350, 420, 100, "Thêm model", True)}
  <text x="470" y="440" class="ts">API key chỉ trong env — không nhập trên UI</text>
""",
        "/admin/video/providers",
    ),
}


def main():
    for name, svg in MOCKUPS.items():
        path = OUT / f"{name}.svg"
        path.write_text(svg.strip() + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")


if __name__ == "__main__":
    main()
