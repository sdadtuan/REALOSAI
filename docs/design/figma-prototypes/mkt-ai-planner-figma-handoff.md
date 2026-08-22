# Figma Handoff — SCR-MKT-AI-001 AI Planner Wizard

> **Spec:** [`../../specs/2026-08-08-mkt-ai-planner-integration-spec.md`](../../specs/2026-08-08-mkt-ai-planner-integration-spec.md)  
> **Clickable reference:** [`mkt-ai-planner-scr-001-prototype.html`](./mkt-ai-planner-scr-001-prototype.html) — mở browser để demo stakeholder  
> **Frame size:** 1440 × 900 (Desktop) · Content max-width 1200px  
> **Design tokens:** PTT `#17692f` primary · `#ecefea` page bg · `#5c6f63` muted

---

## 1. Figma file structure

```
📁 RNOSAI · AI Marketing Planner
├── 📄 Cover (link spec + prototype HTML)
├── 🎨 Foundations
│   ├── Colors (PTT + semantic error/warning/success)
│   ├── Typography (system-ui scale)
│   └── Spacing (4/8/12/16/24)
├── 🧩 Components
│   ├── Button / Primary · Secondary · Ghost · Sm
│   ├── Input / Text · Textarea · Select · Tags
│   ├── Card / Default · Campaign
│   ├── Banner / Gate-fail · Gate-pass · Info
│   ├── Stepper / Step-dot · Step-label
│   ├── JobRow / pending · running · done · failed
│   ├── Accordion / Strategy-section
│   ├── Modal / Apply-confirm
│   └── Toast / Success
└── 📱 Screens — SCR-MKT-AI-001
    ├── 001 · Step 1 Brief
    ├── 002 · Step 2 Strategy (generated)
    ├── 003 · Step 3 Campaign (generated)
    ├── 004 · Step 4 Content calendar
    ├── 005 · Step 5 Apply & Export
    ├── 006 · Step 3 Campaign — JOB FAILED ★
    └── 007 · Step 5 Apply — Gate pass (post-apply)
```

---

## 2. Prototype connections (Figma Prototype mode)

### Flow A — Happy path (default)

| From | Interaction | To |
|------|-------------|-----|
| Cover | Click「Start demo」 | 001 Brief |
| 001 | Click「Tiếp tục →」 | 002 Strategy |
| 002 | Click「Sinh chiến lược AI」→ wait overlay 2s → auto | 002 (variant: filled) |
| 002 | Click「Tiếp tục →」 | 003 Campaign |
| 003 | Click「Sinh chiến dịch AI」→ overlay | 003 (variant: 2 cards) |
| 003 | Click「Tiếp tục →」 | 004 Content |
| 004 | Click「Tiếp tục →」 | 005 Apply |
| 005 | Click「Apply vào TMMT」 | Modal Apply-confirm |
| Modal | Click「Xác nhận Apply」 | 007 Gate pass + toast |
| 007 | Click「Mở tab TMMT →」 | (link placeholder frame) |

### Flow B — Job failed (EC-MKT-AI-05)

| From | Interaction | To |
|------|-------------|-----|
| Cover | Click「Job failed demo」 | 002 Strategy (filled) |
| 002 | Click「Tiếp tục →」 | 003 Campaign |
| 003 | Click「Sinh chiến dịch AI」 | 006 JOB FAILED |
| 006 | Click「Thử lại」 | 003 Campaign (running → success) |

**Note:** Frame 006 giữ draft strategy visible bên trái — chứng minh không mất draft.

---

## 3. Screen specs (per frame)

### Frame 001 — Step 1 Brief

| Zone | Height | Content |
|------|--------|---------|
| Breadcrumb | 40px | CRM › Triển khai DV › #123 |
| Page title | 56px | `#123 · meta-lead-gen` · Stage: onboard |
| Tab bar | 44px | Workflow \| TMMT \| **AI Planner** \| Finance \| SOP \| Launch QA |
| Gate banner | 48px | Red: Gate chưa pass · 4/12 mục |
| Stepper | 56px | 5 steps, step 1 active |
| Form card | flex | 2-col grid fields (see spec §6.2) |
| Prefill info | 72px | Blue info callout |
| Footer | 56px | Quay lại \| Lưu nháp \| **Tiếp tục →** |

**Sample data (prefilled):**

- Brand: Công ty ABC Logistics  
- Industry: Logistics / B2B  
- Service: meta-lead-gen (readonly)  
- Budget: 80.000.000  
- Geo: HCM, Bình Dương  

### Frame 002 — Step 2 Strategy

| Element | State |
|---------|-------|
| Toolbar | `[Sinh chiến lược AI]` primary · Quality 72/100 |
| Accordion | 4 strategy keys expanded + sample AI text |
| TMMT prof | 4 core keys with `*` + AI chip |
| SWOT | 4 mini cards 2×2 |
| Job panel | Strategy ✓ 42s · Campaign pending |

### Frame 003 — Step 3 Campaign

| Element | State |
|---------|-------|
| CTA | Sinh chiến dịch AI |
| Cards | Meta Lead Gen Q3 (35%) · Google Search B2B (25%) |
| Job panel | Strategy ✓ · Campaign running (pulse) |

### Frame 004 — Step 4 Content

| Element | State |
|---------|-------|
| Sub-tabs | Lịch 30 ngày (active) \| Ad copy \| Email |
| Calendar | 7-col week grid, 3 chips on days |
| Day drawer | Right inline panel day 12 — Meta post copy |

### Frame 005 — Step 5 Apply

| Element | State |
|---------|-------|
| Quality | 78/100 green · 5/6 criteria checked |
| TMMT preview | Collapsed diff list |
| Primary CTA | Apply vào TMMT chính thức |
| Export row | PDF · DOCX · Excel (enabled) |

### Frame 006 — JOB FAILED ★

| Element | State |
|---------|-------|
| Job panel | Campaign **failed** red · error: `LLM timeout (504)` |
| Actions | **[Thử lại]** primary in panel |
| Main content | Campaign area empty — *「Sinh chiến dịch thất bại — thử lại hoặc thêm thủ công」* |
| Strategy draft | Still visible if user navigates back — do NOT clear |

### Frame 007 — Post-apply

| Element | State |
|---------|-------|
| Gate banner | Green: Gate TMMT ✓ |
| Toast | Bottom-right: Đã apply — Gate pass |
| Quality | unchanged 78/100 |
| Export | all enabled |

---

## 4. Component variants

### JobRow

| Variant | Icon | Label color | Trailing |
|---------|------|-------------|----------|
| pending | ○ hollow | muted | — |
| running | ◐ arc | accent + pulse | … |
| done | ● filled | accent | duration `42s` |
| failed | ✕ | danger | `[Thử lại]` |

### Gate banner

| Variant | BG token | Text |
|---------|----------|------|
| fail | `--win-warning-bg` + red border left 4px | Gate chưa pass · N mục |
| pass | `--win-success-bg` + green border | Gate TMMT ✓ |

### Stepper dot

| State | Fill | Label weight |
|-------|------|--------------|
| done | accent | 600 |
| active | accent ring | 600 |
| todo | border only | 400 |

---

## 5. Import vào Figma (workflow designer)

1. Mở [`mkt-ai-planner-scr-001-prototype.html`](./mkt-ai-planner-scr-001-prototype.html) full screen 1440px.
2. **Plugin:** *html.to.design* hoặc screenshot từng step (001–007) → paste vào Figma frames.
3. Trace vectors over screenshot → replace with components §3.
4. Wire prototype theo bảng §2.
5. Share link Figma + ghi version v1.0 trong cover.

---

## 6. Acceptance (design QA)

| # | Check |
|---|-------|
| FQ-01 | 7 frames tồn tại đúng tên |
| FQ-02 | Happy path prototype 001→007 không dead-end |
| FQ-03 | Frame 006 có JobRow failed + Thử lại |
| FQ-04 | Label TMMT khớp `LifecycleTmmtPanel` (VI) |
| FQ-05 | Primary `#17692f` — không gradient, không shadow (WIN slop rules) |
| FQ-06 | Tab AI Planner có active state distinct |

---

*Sau khi Figma file được tạo, cập nhật link vào spec §Phụ lục B.*
