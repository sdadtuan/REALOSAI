# RNOSAI

Revenue Operating System + AI layer — PTT Agency Platform.

**Repository:** https://github.com/sdadtuan/RNOSAI

## Quick links

| | |
|---|---|
| Master spec | [docs/SPEC_RNOSAI_MASTER.md](docs/SPEC_RNOSAI_MASTER.md) |
| Implementation plan | [docs/specs/2026-07-26-rnosai-system-implementation-plan.md](docs/specs/2026-07-26-rnosai-system-implementation-plan.md) |
| New RNOS issue | https://github.com/sdadtuan/RNOSAI/issues/new?template=rnos-deliverable.yml |
| PR checklist | https://github.com/sdadtuan/RNOSAI/blob/main/docs/templates/pr-checklist-rnos-uc-ui-uat.md |
| Contributing | https://github.com/sdadtuan/RNOSAI/blob/main/.github/CONTRIBUTING.md |

## Clone

```bash
git clone https://github.com/sdadtuan/RNOSAI.git
cd RNOSAI
docker compose up -d postgres   # DB: rnosaidb
source deploy/env.local.example
./scripts/github_labels.sh
```

Production: `ops.pttads.vn` · `portal.pttads.vn`
