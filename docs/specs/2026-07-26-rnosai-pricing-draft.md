# RNOSAI — Bảng giá draft (Agency vs Brand)

> **Phiên bản:** 0.1 DRAFT · **Ngày:** 2026-07-26  
> **Trạng thái:** Nội bộ sales / product — **chưa publish**, số liệu cần PO + Finance sign-off  
> **Bám spec:** [`SPEC_AI_REVENUE_OPERATING_SYSTEM.md`](../SPEC_AI_REVENUE_OPERATING_SYSTEM.md) §20.4, §18.2, §23  
> **Đối chiếu thị trường:** Getfly ~521k–1,568k/tháng (3–50 user) · MISA CRM ~55k–120k/user/tháng (block 10 user)

---

## 1. Nguyên tắc định giá

| # | Nguyên tắc | Ý nghĩa |
|---|------------|---------|
| P1 | **Không war giá SME** | Không cạnh Getfly “31k/tháng” hay MISA 80k/user |
| P2 | **Metric đúng moat** | Agency → **per active client workspace**; Brand → **per org + seat** |
| P3 | **Tách lớp rõ** | Platform (CRM + OS) · Channel OS · AI wave — khách mua đúng phần đã ship |
| P4 | **Outcome pricing narrative** | Bán closed-loop CPL/ROAS + governance, không bán “CRM + 100 tính năng” |
| P5 | **Annual-first** | List price tháng; **khuyến khích trả năm −15%**; triển khai/setup tách dòng |
| P6 | **Fair use AI** | AI theo **wave/org**, không bán từng API call; overage seat + cap LLM riêng |

**North-star so sánh TCO (agency 25 client, 15 staff, Meta+Zalo):**

| Stack rời | Ước lượng/tháng | RNOSAI draft |
|-----------|-----------------|--------------|
| CRM (Getfly Pro) + Excel hub + Ads Manager + portal thủ công | ~8–15M VND + hidden ops | **RevenueOS Agency Growth** ~**22–28M** all-in (có closed-loop) |

---

## 2. Mô hình metric

### 2.1. Định nghĩa

| Metric | Ký hiệu | Định nghĩa billable |
|--------|---------|---------------------|
| **Active client workspace** | `ACW` | Agency client `status=active` + ≥1 channel mapped (Meta/Zalo/Email/SEO) trong 30 ngày |
| **Staff seat (ops-web)** | `SEAT` | User staff có JWT + cap CRM/agency (AM, CSKH, Buyer, Strategist…) |
| **Portal seat (client)** | `PSEAT` | User portal viewer/approver — **miễn phí** đến cap gói; vượt cap tính phí |
| **Org (Brand)** | `ORG` | Một tenant DN = 1 brand; không tính ACW |

### 2.2. Ai trả theo metric nào?

```text
RevenueOS Agency  →  Platform fee (org)  +  ACW × gói  +  SEAT vượt cap  +  Channel OS / ACW  +  AI wave (org)
RevenueOS Brand   →  Platform fee (org)  +  SEAT × tier    +  Channel OS (org)  +  AI wave (org)
```

| | **Agency** | **Brand** |
|---|-----------|-----------|
| **Đơn vị chính** | **ACW** (client quảng cáo) | **SEAT** (team nội bộ) |
| **Phụ** | SEAT vượt gói | 1 org = 1 brand workspace |
| **Portal KH** | Included đến 2 PSEAT/ACW | Included đến 5 PSEAT/org |
| **Multi-client** | ✅ Core | ❌ |

---

## 3. Ba lớp sản phẩm (tách bill)

### 3.1. Lớp A — Platform + CRM Core (bắt buộc)

**Gồm:** CRM lead/pipeline/CSKH SLA · Agency lifecycle 7 stage · RBAC · webhook ingest · audit · import/export (R1) · isolation multi-client (Agency).

| Thành phần | Agency | Brand |
|------------|--------|-------|
| CRM Core | ✅ | ✅ |
| Service Delivery / Onboard orchestrator | ✅ | ○ Lite |
| CSKH board + SLA 15p | ✅ | ✅ |
| RE Projects (BĐS) | Add-on vertical | Add-on vertical |

### 3.2. Lớp B — Channel OS (add-on theo kênh)

Mỗi module = workspace kênh **per ACW** (Agency) hoặc **per ORG** (Brand).

| Module | SKU | Ship status | Bill |
|--------|-----|-------------|------|
| Meta Enterprise OS | `CH-META` | ✅ | ACW hoặc ORG |
| Zalo Ads OS | `CH-ZALO` | ✅ | ACW hoặc ORG |
| Email Marketing OS | `CH-EMAIL` | ✅ | ACW hoặc ORG |
| SEO/AEO OS | `CH-SEO` | ✅ | ACW hoặc ORG |
| Client Portal (performance + approval) | `CH-PORTAL` | ✅ | Bundled 1/ACW |

**Bundle kênh (Agency, per ACW/tháng):**

| Bundle | SKU | Giá list | Gồm |
|--------|-----|----------|-----|
| Performance Duo | `BDL-MZ` | **1.200.000đ** | Meta + Zalo + Portal |
| Full Funnel | `BDL-4CH` | **2.200.000đ** | Meta + Zalo + Email + SEO + Portal |

### 3.3. Lớp C — AI Revenue OS (theo wave, per org)

Không bán lẻ từng copilot action. **Wave = entitlement + fair-use LLM pool.**

| Wave | SKU | Capabilities (RNOS) | Ship |
|------|-----|---------------------|------|
| **R1 AI Assist** | `AI-R1` | Copilot, lead score v1, summarize, draft+approve, audit | R1 pilot |
| **R2 Workflow + NBA** | `AI-R2` | + Deal score, NBA, RAG playbook, workflow AI nodes | R2 |
| **R3 Revenue OS** | `AI-R3` | + Forecast, churn, renewal agent, manager coach | R3 |
| **R4 Channel AI** | `AI-R4` | + CPL/ROAS anomaly, budget recommend, multi-agent | R4 |

**Seat copilot included trong AI wave:** 15 SEAT (Agency Growth / Brand Pro trở lên); vượt → **250.000đ/SEAT/tháng**.

---

## 4. RevenueOS Agency — bảng giá draft

> **Target:** Agency 10–100 client chạy ads · message: *Một OS thay 5 tool — CPL/ROAS theo client*

### 4.1. Platform tiers (org fee + ACW + SEAT cap)

| Tier | ACW included | SEAT included | Platform list/tháng | ACW thêm | SEAT thêm |
|------|--------------|-------------|---------------------|----------|-----------|
| **Agency Starter** | 5 | 8 | **12.000.000đ** | +**800.000đ**/ACW | +**400.000đ**/SEAT |
| **Agency Growth** ⭐ | 15 | 20 | **28.000.000đ** | +**650.000đ**/ACW | +**350.000đ**/SEAT |
| **Agency Scale** | 40 | 50 | **58.000.000đ** | +**500.000đ**/ACW | +**300.000đ**/SEAT |
| **Agency Enterprise** | Custom | Custom | Liên hệ | Volume | Volume |

**Bao gồm trong Platform:** Lớp A (CRM Core + Agency OS + portal provisioning template).

**Không bao gồm:** Channel OS (Lớp B), AI wave (Lớp C), RE vertical.

### 4.2. Channel OS (Agency) — per ACW/tháng

| SKU | Giá list/ACW/tháng | Ghi chú |
|-----|---------------------|---------|
| `CH-META` | **800.000đ** | Hub map, CAPI, insights, Launch QA |
| `CH-ZALO` | **600.000đ** | Lead webhook, CPL hub, form sync |
| `CH-EMAIL` | **700.000đ** | Workspace, deliverability, journeys (flag) |
| `CH-SEO` | **600.000đ** | GSC/GA4, content pipeline, AEO scan |
| `CH-PORTAL` | **0đ** | Auto với ≥1 channel paid |
| `BDL-MZ` | **1.200.000đ** | Meta + Zalo + Portal |
| `BDL-4CH` | **2.200.000đ** | 4 kênh + Portal |

### 4.3. AI wave (Agency) — per org/tháng

| SKU | Giá list/org/tháng | Requires platform |
|-----|---------------------|-------------------|
| `AI-R1` | **4.500.000đ** | Starter+ |
| `AI-R2` | **+6.000.000đ** (stack) | Growth+ · includes R1 |
| `AI-R3` | **+9.000.000đ** (stack) | Growth+ · includes R1–R2 |
| `AI-R4` | **+14.000.000đ** (stack) | Scale · includes R1–R3 |

**Early adopter (R1 pilot):** `AI-R1` **3.000.000đ** org/tháng nếu ký trước Gate R1 + case study.

**LLM overage (optional):** pool 500k tokens org/tháng included R1; vượt **800đ/1k tokens** (pass-through + 20%).

### 4.4. Ví dụ TCO Agency Growth

**Profile:** 18 ACW active · 22 SEAT · Meta+Zalo mọi client · AI-R1

| Dòng | Tính | VND/tháng |
|------|------|-----------|
| Platform Growth | Base | 28.000.000 |
| ACW vượt 3 | 3 × 650.000 | 1.950.000 |
| SEAT vượt 2 | 2 × 350.000 | 700.000 |
| Channel BDL-MZ × 18 | 18 × 1.200.000 | 21.600.000 |
| AI-R1 | Org | 4.500.000 |
| **Tổng list** | | **56.750.000** |
| Trả năm (−15%) | | **~48.237.500** |

**≈ 3,15M/ACW all-in** — so với 5 tool rời thường **4–6M/ACW** hidden cost.

---

## 5. RevenueOS Brand — bảng giá draft

> **Target:** Brand in-house performance MKT · message: *Biết đồng ads nào ra đơn*

### 5.1. Platform tiers (org + SEAT)

| Tier | SEAT included | PSEAT portal | Platform list/tháng | SEAT thêm |
|------|---------------|--------------|---------------------|-----------|
| **Brand Core** | 10 | 5 | **9.000.000đ** | +**450.000đ**/SEAT |
| **Brand Pro** ⭐ | 25 | 15 | **18.000.000đ** | +**380.000đ**/SEAT |
| **Brand Enterprise** | Custom | Custom | Liên hệ | Volume |

**Bao gồm:** Lớp A CRM (single org) · 1 brand workspace · closed-loop cơ bản.

### 5.2. Channel OS (Brand) — per org/tháng

Brand không nhân ACW — flat org hoặc theo số ad account:

| SKU | Giá list/org/tháng | Cap |
|-----|---------------------|-----|
| `CH-META` | **2.500.000đ** | ≤5 ad accounts |
| `CH-ZALO` | **1.800.000đ** | ≤3 OA/form clusters |
| `CH-EMAIL` | **2.200.000đ** | 1 workspace |
| `CH-SEO` | **1.800.000đ** | 1 domain workspace |
| `BDL-MZ` | **3.800.000đ** | Meta + Zalo caps |
| `BDL-4CH` | **6.500.000đ** | Full funnel |

Ad account vượt cap: **+400.000đ/account/tháng**.

### 5.3. AI wave (Brand) — per org/tháng

| SKU | Giá list | Ghi chú |
|-----|----------|---------|
| `AI-R1` | **3.500.000đ** | 10 copilot SEAT included |
| `AI-R2` | **+5.000.000đ** stack | |
| `AI-R3` | **+8.000.000đ** stack | |
| `AI-R4` | **+12.000.000đ** stack | |

### 5.4. Ví dụ TCO Brand Pro

**Profile:** 18 SEAT · Meta+Zalo · AI-R1

| Dòng | VND/tháng |
|------|-----------|
| Brand Pro | 18.000.000 |
| BDL-MZ | 3.800.000 |
| AI-R1 | 3.500.000 |
| **Tổng** | **25.300.000** |

---

## 6. Add-on & dịch vụ one-time

| SKU | Loại | Giá draft | Ghi chú |
|-----|------|-----------|---------|
| `SVC-ONBOARD` | One-time | **15.000.000–45.000.000đ** | Theo số ACW + kênh; orchestrator + training |
| `SVC-MIGRATE` | One-time | **8.000.000đ** + **500k/1k lead** | Import CRM cũ |
| `VERT-RE` | Vertical/month | **+2.000.000đ/org** hoặc **+400k/ACW** | RE Projects + accounting AI |
| `CONN-MISA` | Integration/year | **12.000.000đ** | Export/sync kế toán — không ERP |
| `PSEAT-EXTRA` | Recurring | **150.000đ/PSEAT/tháng** | Vượt cap portal |
| `SLA-PREMIUM` | Recurring | **+20% platform** | SLA 99.95%, dedicated support |

---

## 7. Ma trận tính năng × gói (tóm tắt)

| Capability | CRM Core (A) | Channel OS (B) | AI-R1 | AI-R2 | AI-R3 | AI-R4 |
|------------|:------------:|:--------------:|:-----:|:-----:|:-----:|:-----:|
| Lead/pipeline/CSKH SLA | ✅ | | | | | |
| Multi-client agency | Agency | | | | | |
| Meta hub CPL/ROAS | | META | | | | |
| Zalo lead/CPL | | ZALO | | | | |
| Email OS | | EMAIL | | | | |
| SEO OS | | SEO | | | | |
| Portal client | | PORTAL | | | | |
| Copilot + score + draft | | | ✅ | ✅ | ✅ | ✅ |
| NBA + deal score | | | | ✅ | ✅ | ✅ |
| Forecast + renewal agent | | | | | ✅ | ✅ |
| CPL anomaly + budget AI | | | | | | ✅ |

---

## 8. So sánh positioning giá (FAQ sales)

| Câu hỏi | Trả lời |
|---------|---------|
| “Đắt hơn Getfly?” | Getfly **521k/3 user** không có multi-client, Meta OS, portal, closed-loop. RNOS **~800k–1,2M/ACW** channel-only đã có hub + lead + portal. |
| “Đắt hơn MISA?” | MISA **~120k/user** = CRM+DMS single DN. RNOS Agency **~1,5–3M/ACW all-in** cho agency 15–25 client — so với 5 tool riêng vẫn rẻ hơn ops. |
| “AI tính riêng?” | **`AI-R1` org-level** — không surprise bill API; copilot unlimited fair use trong cap SEAT. |
| “Chỉ cần CRM?” | **Không target** — xem `Lite` future hoặc từ chối politely (§20.4). |
| “Trả tháng được?” | Có, **+10%** vs list annual/12. |

---

## 9. Không target & hướng Lite (future)

| Phân khúc | Chiến lược giá |
|-----------|----------------|
| SME đa ngành, ít ads | **Không bán** hoặc **`RNOS Lite`** future: **2.500.000đ/tháng** · 5 SEAT · CRM only · không Agency OS |
| Phân phối / đi tuyến | **Không bán** — redirect MISA |
| BĐS / dự án | **`VERT-RE`** add-on trên Agency/Brand |

---

## 10. Checklist trước khi publish giá

- [ ] Finance validate margin (LLM cost, infra ACW)
- [ ] Legal: điều khoản fair use AI + không cam kết ROI
- [ ] Sales deck + calculator Excel (ACW × channel × AI)
- [ ] Đồng bộ catalog SKU trong `crm/catalog` proposal flow
- [ ] Cập nhật §20.4 master spec → link doc này

---

## Phụ lục — Công thức nhanh

**Agency monthly list:**

```text
Total = Platform(tier)
      + max(0, ACW − ACW_included) × ACW_overage
      + max(0, SEAT − SEAT_included) × SEAT_overage
      + Σ ACW × ChannelSKU   (hoặc BDL)
      + AI_wave_stack
      + add-ons
```

**Brand monthly list:**

```text
Total = Platform(tier)
      + max(0, SEAT − SEAT_included) × SEAT_overage
      + ChannelSKU_org (hoặc BDL)
      + AI_wave_stack
      + add-ons
```

---

*Draft v0.1 — chỉ dùng nội bộ PTT/RNOSAI. Publish sau pilot R1 + 3 paying agency references.*
