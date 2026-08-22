# GitHub — RNOSAI (`sdadtuan/RNOSAI`)

> **Repository:** https://github.com/sdadtuan/RNOSAI  
> Issue templates · PR checklist · labels — chạy setup một lần sau clone.

---

## Links nhanh

| Mục | URL |
|-----|-----|
| **Repo** | https://github.com/sdadtuan/RNOSAI |
| **Issues** | https://github.com/sdadtuan/RNOSAI/issues |
| **RNOS Deliverable (new)** | https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml |
| **Bug report** | https://github.com/sdadtuan/RNOSAI/issues/new?template=bug-report.yml |
| **UAT / Gap** | https://github.com/sdadtuan/RNOSAI/issues/new?template=uat-gap.yml |
| **Pull requests** | https://github.com/sdadtuan/RNOSAI/pulls |
| **Contributing** | https://github.com/sdadtuan/RNOSAI/blob/main/.github/CONTRIBUTING.md |
| **PR checklist** | https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md |
| **Implementation plan** | https://github.com/sdadtuan/RNOSAI/blob/main/docs/specs/2026-07-26-rnosai-system-implementation-plan.md |

---

## Clone

```bash
git clone https://github.com/sdadtuan/RNOSAI.git
cd RNOSAI
```

---

## Labels (một lần)

Cần [GitHub CLI](https://cli.github.com/) (`gh auth login`):

```bash
chmod +x scripts/github_labels.sh
./scripts/github_labels.sh sdadtuan/RNOSAI
```

Hoặc thủ công — xem script [`scripts/github_labels.sh`](../../scripts/github_labels.sh).

| Nhóm | Labels |
|------|--------|
| Loại | `deliverable`, `bug`, `uat` |
| Wave | `wave-phase-0`, `wave-r1`, `wave-r2`, `wave-r3` |
| Workstream | `ws-data`, `ws-be`, `ws-fe`, `ws-platform`, `ws-qa` |
| Priority | `p0`, `p1`, `p2` |
| Trạng thái | `ready`, `blocked`, `in-uat` |

---

## Workflow issue → PR

```text
https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml
  → Assign + labels (wave-r1, ws-be, p0)
  → Branch feat/RNOS-06-copilot-panel
  → PR — Closes #123 (template auto-load)
  → Tick PR checklist + UAT staging
  → Merge
```

---

## Tài liệu trong repo

| File | GitHub link |
|------|-------------|
| Issue templates | https://github.com/sdadtuan/RNOSAI/tree/main/.github/ISSUE_TEMPLATE |
| PR template | https://github.com/sdadtuan/RNOSAI/blob/main/.github/pull_request_template.md |
| PR checklist | https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md |
