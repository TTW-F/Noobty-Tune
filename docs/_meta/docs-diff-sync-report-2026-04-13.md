# Docs Diff Sync Report (2026-04-13)

## Baseline

- Manual docs baseline commit: `6bfedbced7a6eee518d219b2842ba0af9464895b`
- Rule used: `baseline..HEAD` + `working tree`

## Cumulative Source Changes (`baseline..HEAD`)

- `src/app/App.tsx`
- `src/components/DeveloperLogConsole.tsx`
- `src/features/tuner/model/useTunerPrototype.ts`
- `src/features/tuner/ui/TunerLandingScreen.tsx`
- `src/lib/audio/microphoneManager.ts`
- `src/lib/logging/developerLogger.ts`
- `src/styles/globals.css`

## Working Tree Changes (Uncommitted)

- `src/app/App.tsx`
- `src/features/tuner/model/useTunerPrototype.ts`
- `src/features/tuner/ui/TunerLandingScreen.tsx`
- `src/styles/globals.css`

## Documentation Sync Coverage

- `docs/development/30-modules/tuner-implementation-current.md`
  - Added input device picker and developer log console behavior.
- `docs/development/30-modules/ui-and-interaction-current.md`
  - Added device panel interaction and Developer Log Console section.
- `docs/development/30-modules/audio-and-detection-current.md`
  - Added input device preference flow and lifecycle logging notes.
- `docs/_meta/code-to-docs-map.md`
  - Added mappings for `DeveloperLogConsole.tsx` and `developerLogger.ts`.

## Auto Artifacts Refreshed

- `docs/development/00-overview/codemaps/**`
- `docs/_meta/codemap-summary.json`
- `docs/_meta/link-index.json`

## Unverified / Follow-up

- Real-device verification for new input-device switch behavior.
- Confirm log volume and performance impact on low-end devices.
