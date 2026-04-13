# Code to Docs Map

更新时间：2026-04-13  
用途：建立“代码文件 -> 文档文件”映射，作为增量文档更新门禁输入。

## 1) App / Entry

- `src/main.tsx`
  - `docs/development/00-overview/codemaps/frontend/main/main.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
- `src/App.tsx`
  - `docs/development/00-overview/codemaps/frontend/app/app.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
- `src/app/index.ts`
  - `docs/development/00-overview/codemaps/frontend/app/index.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
- `src/app/App.tsx`
  - `docs/development/00-overview/codemaps/frontend/app/app.md`
  - `docs/development/30-modules/tuner-implementation-current.md`

## 2) Feature: Tuner

- `src/features/tuner/model/index.ts`
  - `docs/development/00-overview/codemaps/frontend/features/model.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
- `src/features/tuner/model/useTunerPrototype.ts`
  - `docs/development/00-overview/codemaps/frontend/features/model-use-tuner-prototype.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
  - `docs/development/30-modules/type-contracts-current.md`
- `src/features/tuner/model/tunerState.ts`
  - `docs/development/00-overview/codemaps/frontend/features/model-tuner-state.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
  - `docs/development/30-modules/type-contracts-current.md`
- `src/features/tuner/ui/TunerLandingScreen.tsx`
  - `docs/development/00-overview/codemaps/frontend/features/ui-tuner-landing-screen.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
  - `docs/development/30-modules/ui-and-interaction-current.md`

## 3) Components

- `src/components/PageShell.tsx`
  - `docs/development/00-overview/codemaps/frontend/components/page-shell.md`
  - `docs/development/30-modules/ui-and-interaction-current.md`
- `src/components/PrimaryButton.tsx`
  - `docs/development/00-overview/codemaps/frontend/components/primary-button.md`
  - `docs/development/30-modules/ui-and-interaction-current.md`
- `src/components/StatusCard.tsx`
  - `docs/development/00-overview/codemaps/frontend/components/status-card.md`
  - `docs/development/30-modules/ui-and-interaction-current.md`
- `src/components/DebugReadoutCard.tsx`
  - `docs/development/00-overview/codemaps/frontend/components/debug-readout-card.md`
  - `docs/development/30-modules/ui-and-interaction-current.md`

## 4) Audio Library

- `src/lib/audio/index.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/audio.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
- `src/lib/audio/microphoneManager.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/audio-microphone-manager.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
  - `docs/development/30-modules/type-contracts-current.md`
- `src/lib/audio/frameCapture.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/audio-frame-capture.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
- `src/lib/audio/pitchDetector.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/audio-pitch-detector.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
  - `docs/development/30-modules/type-contracts-current.md`
- `src/lib/audio/pitchStabilizer.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/audio-pitch-stabilizer.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
  - `docs/development/30-modules/type-contracts-current.md`

## 5) Music Library

- `src/lib/music/index.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/music.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
- `src/lib/music/noteMapping.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/music-note-mapping.md`
  - `docs/development/30-modules/tuner-implementation-current.md`
  - `docs/development/30-modules/audio-and-detection-current.md`
- `src/lib/music/standardTuning.ts`
  - `docs/development/00-overview/codemaps/frontend/lib/music-standard-tuning.md`
  - `docs/development/30-modules/tuner-implementation-current.md`

## 6) Types

- `src/types/index.ts`
  - `docs/development/00-overview/codemaps/frontend/types/index.md`
  - `docs/development/30-modules/type-contracts-current.md`
- `src/types/tuner.ts`
  - `docs/development/00-overview/codemaps/frontend/types/tuner.md`
  - `docs/development/30-modules/type-contracts-current.md`

## 7) Styles

- `src/styles/globals.css`
  - `docs/development/30-modules/ui-and-interaction-current.md`
- `src/index.css`（遗留）
  - `docs/development/30-modules/ui-and-interaction-current.md`
- `src/App.css`（遗留）
  - `docs/development/30-modules/ui-and-interaction-current.md`

## 8) 使用规则（增量更新）

当代码文件变更时，至少同步更新对应映射中的一个 Manual Layer 文档；仅更新 codemap 不视为“实现文档已更新”。
