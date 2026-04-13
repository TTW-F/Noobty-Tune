# Docs Sync Checklist

- Generated At: `2026-04-13T15:09:38.294Z`
- Pipeline: `docs:codemap` -> `docs:index`

## Execution Status
- [x] Codemap generated
- [x] Link index generated
- [ ] Governance review by `documentation-maintainer`

## Artifact Pointers
- Codemap root: `docs/development/00-overview/codemaps/`
- Link index: `docs/_meta/link-index.json`
- Codemap summary: `docs/_meta/codemap-summary.json`

## Codemap Snapshot
- Canonical Root: `docs/development/00-overview/codemaps/`
- Total Domains: `1`
- Total Subsystems: `6`
- Total Topics: `21`
- Total Modules: `22`

## Domain Breakdown
- `frontend`: 6 subsystems, 21 topics, 22 modules

## Governance Handoff (Required)
- [ ] Validate canonical vs mirror path consistency
- [ ] Validate split thresholds and oversized pages
- [ ] Validate assumptions and unresolved items
- [ ] Publish final decision (pass/rework)

## Runbook
```bash
npm run docs:sync
```

> Last sync day: 2026-04-13
