# Lead Meeting Prep (SCI) — Acceptance Checklist

> **Document ID:** LMP-AC-20260813  
> **Parent:** [`lead-meeting-prep.md`](./lead-meeting-prep.md) · [`2026-08-13-lead-meeting-prep-implementation-plan.md`](./2026-08-13-lead-meeting-prep-implementation-plan.md)  
> **Sign-off:** PO · Trưởng Sales · GDKD · Eng Lead

---

## P0 — MVP Research + Panel (S-LMP-1 / S-LMP-2)

| ID | Criteria | Staging | VPS Pilot | Sign |
|---|---|:---:|:---:|:---:|
| EC-LMP-01 | Lead B2B → prep `ready` ≤5 ph | ☐ | ☐ | |
| EC-LMP-02 | Thiếu company → `skipped` + CTA | ☐ | ☐ | |
| EC-LMP-03 | Entity trùng tên → awaiting choice | ☐ | ☐ | |
| EC-LMP-04 | select-entity → facts 1 pháp nhân | ☐ | ☐ | |
| EC-LMP-05 | Panel: profile + DV + script | ☐ | ☐ | |
| EC-LMP-06 | Badge Có nguồn / AI suy luận | ☐ | ☐ | |
| EC-LMP-07 | contact_profile.found=false | ☐ | ☐ | |
| EC-LMP-08 | Missing Tavily → failed graceful | ☐ | ☐ | |
| EC-LMP-09 | Duplicate lead → no enqueue | ☐ | ☐ | |
| EC-LMP-10 | Manual run idempotent | ☐ | ☐ | |
| EC-LMP-11 | ai_agent_runs logged | ☐ | ☐ | |
| EC-LMP-12 | Timeline event visible | ☐ | ☐ | |
| GATE-P0 | `lead_meeting_prep_gate.sh` PASS | ☐ | ☐ | |

**UAT P0 (3 AM):** Lead mới → đọc script → gọi khách — đủ context? ☐ Có ☐ Không  
Ghi chú: _______________________________

---

## P1 — Sales Cockpit + Close Intelligence (S-LMP-3)

| ID | Criteria | Staging | Pilot | Sign |
|---|---|:---:|:---:|:---:|
| EC-LMP-13 | talk_track ≥3 phases | ☐ | ☐ | |
| EC-LMP-14 | offer_ladder CB+TC+CS | ☐ | ☐ | |
| GATE-P1 | `lmp_p1_gate.sh` PASS | ☐ | ☐ | |
| UAT-01 | 2 lead thật — talk track hữu ích | ☐ | ☐ | |
| UAT-02 | Apify FB snapshot hoặc graceful skip | ☐ | ☐ | |
| UAT-03 | Close readiness gauge hợp lý | ☐ | ☐ | |
| UAT-04 | 👍/👎 feedback lưu được | ☐ | ☐ | |

---

## P2 — Deal Close Bridge (S-LMP-4)

| ID | Criteria | Staging | Pilot | Sign |
|---|---|:---:|:---:|:---:|
| EC-LMP-16 | M3 → deal_room_payload | ☐ | ☐ | |
| EC-LMP-17 | Deal Room sci slice applied | ☐ | ☐ | |
| EC-LMP-18 | apply-offer-ladder → quote 3 gói | ☐ | ☐ | |
| GATE-P2 | `lmp_p2_gate.sh` PASS | ☐ | ☐ | |
| UAT-05 | Buổi chốt screen-share Deal Room | ☐ | ☐ | |

---

## P3 — Multi-moment (S-LMP-5)

| ID | Criteria | Staging | Pilot | Sign |
|---|---|:---:|:---:|:---:|
| EC-LMP-15 | Intake Go → M2 refresh | ☐ | ☐ | |
| INT-01 | consult-brief có external_research | ☐ | ☐ | |
| INT-02 | Copilot slice meeting_prep | ☐ | ☐ | |
| INT-03 | Prep time Intake→Deal Room ≤45 ph | ☐ | ☐ | |

---

## P4 — Win Loop + GA (S-LMP-6)

| ID | Criteria | GA | Sign |
|---|---|:---:|:---:|
| EC-LMP-19 | chot → win_outcome_json | ☐ | |
| KPI-01 | SCI coverage ≥80% B2B leads | ☐ | |
| KPI-02 | Deal Room SCI usage tracked | ☐ | |
| GATE-FULL | `lmp_full_gate.sh` PASS | ☐ | |

---

## Final sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| PO | | | |
| Trưởng Sales | | | |
| GDKD | | | |
| Eng Lead | | | |
