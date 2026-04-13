# Type Contracts Current

## 1. Scope

本文档描述当前调音器核心类型契约，以及它们在运行链路中的实际作用。

## 2. Source Files

- `src/types/tuner.ts`
- `src/types/index.ts`

## 3. Core Domain Types

### 3.1 Tuning and note types

- `TuningStringId`：`string-6` 到 `string-1`
- `NoteName`：12 平均律音名集合（含升号）
- `TuningTarget`：`id/label/note/octave/frequencyHz`

### 3.2 Audio and pitch types

- `AudioFrame`：采样帧数据（`samples/sampleRate/rms/peak/timestamp`）
- `PitchReading`：候选音高（含 `clarity`、可选音名与偏差）
- `StabilizedPitchReading`：在 `PitchReading` 基础上增加 `stable/sampleCount/target`

### 3.3 State and status types

- `AudioEngineStatus`：音频引擎生命周期状态
- `TunerUiStatus`：页面交互状态
- `TunerDeviation`：`cents + direction`
- `TunerState`：调音器完整运行态快照

## 4. Contracts and Implementations

契约接口：

- `PitchDetector`
- `PitchStabilizer`
- `MicrophoneManager`（定义在 `src/lib/audio/microphoneManager.ts`）

当前实现：

- `PitchDetector` -> `YinPitchDetector`（主）/ `AutoCorrelationPitchDetector`（对比）
- `PitchStabilizer` -> `RollingPitchStabilizer`
- `MicrophoneManager` -> `BrowserMicrophoneManager`

## 5. Practical Constraints

- `TunerSelection` 支持 `auto/manual`，但当前 UI 只落地了自动模式入口。
- `TunerUiStatus` 包含 `no-signal`，但当前主 Hook 尚未显式切换到该状态。
- `DetectionSource` 支持 `test-tone`，当前链路主要输出 `microphone`。

## 6. Mapping to Runtime Flow

1. `AudioFrame` 由 `TimeDomainFrameCapture.readFrame()` 产生
2. `PitchDetector.detect()` 输出 `PitchReading | null`
3. `PitchStabilizer.push()` 输出 `StabilizedPitchReading | null`
4. `resolveDeviation()` 产出 `TunerDeviation | null`
5. 全部写入 `TunerState` 并驱动 UI

## 7. Change Risk Areas

以下类型变更会直接影响文档和调用方理解，应视为高风险：

- `TunerUiStatus` 增删状态
- `TunerState` 字段变化
- `PitchReading` / `StabilizedPitchReading` 字段语义变化
- `TuningTarget` 结构或 ID 规则变化

## 8. Evidence Paths

- `src/types/tuner.ts`
- `src/features/tuner/model/tunerState.ts`
- `src/features/tuner/model/useTunerPrototype.ts`
- `src/lib/audio/microphoneManager.ts`
- `src/lib/audio/pitchDetector.ts`
- `src/lib/audio/pitchStabilizer.ts`
