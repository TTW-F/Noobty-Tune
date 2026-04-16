# Type Contracts Current

## 1. Scope

本文档描述当前调音器核心类型契约，以及它们在运行链路中的实际作用。

## 2. Source Files

- `src/types/tuner.ts`
- `src/types/index.ts`
- `src/types/pitchTracking.ts`

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
- `TuningInterpretation.targetId`：`TuningStringId | null`（避免无效字符串 ID 渗透到解释层）

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
- `TunerUiStatus` 虽保留兼容层语义，但运行主流程已依赖 `pitchTracking` 的 stage + interpretation + viewModel。
- `DetectionSource` 支持 `test-tone`，当前链路主要输出 `microphone`。

## 6. `src/types/pitchTracking.ts` Contract Notes

已实现（代码事实）：

- 类型定义了四层数据流：`RawPitchCandidate -> PitchTrackingState -> TuningInterpretation -> TunerViewModel`。
- `TuningInterpretation.targetId` 使用 `TuningStringId | null`，与标准弦 ID 收敛，避免任意字符串渗透。
- `DEFAULT_TRACKER_CONFIG` 提供默认跟踪参数（lock/hold/release/history），作为跟踪器默认行为基线。

未实现（当前边界）：

- 仅提供类型和默认配置，不包含参数热更新或按设备动态配置契约。
- 未定义多乐器/多调弦场景的通用目标 ID 契约。

已知限制：

- `TunerUiStage` 与兼容层 `TunerUiStatus` 并存，调用方需要承担映射一致性维护成本。
- `detectedNote` 当前为 `string | null`，尚未收敛为受限枚举类型。

未验证项：

- 新增 stage 在所有 UI 映射表中的覆盖完整性（尤其错误与降级分支）。
- 未来扩展 alternate tuning 时，`targetId` 契约是否仍可复用现有 `TuningStringId`。

## 7. Mapping to Runtime Flow

1. `AudioFrame` 由 `TimeDomainFrameCapture.readFrame()` 产生
2. `PitchDetector.detect()` 输出 `PitchReading | null`
3. `PitchStabilizer.push()` 输出 `StabilizedPitchReading | null`
4. `resolveDeviation()` 产出 `TunerDeviation | null`
5. 全部写入 `TunerState` 并驱动 UI

## 8. Change Risk Areas

以下类型变更会直接影响文档和调用方理解，应视为高风险：

- `TunerUiStatus` 增删状态
- `TunerState` 字段变化
- `PitchReading` / `StabilizedPitchReading` 字段语义变化
- `TuningTarget` 结构或 ID 规则变化

## 9. Evidence Paths

- `src/types/tuner.ts`
- `src/features/tuner/model/tunerState.ts`
- `src/features/tuner/model/useTunerPrototype.ts`
- `src/lib/audio/microphoneManager.ts`
- `src/lib/audio/pitchDetector.ts`
- `src/lib/audio/pitchStabilizer.ts`
