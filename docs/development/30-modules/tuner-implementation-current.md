# Tuner Current Implementation

## 1. Scope

本文档描述当前仓库中 Web 调音器的实际实现状态（基于 `src/`），不描述未来规划。

## 2. Entry and Composition

- App 入口：`src/main.tsx` -> `src/app/index.ts` -> `src/app/App.tsx`
- 业务主 Hook：`src/features/tuner/model/useTunerPrototype.ts`
- 主页面：`src/features/tuner/ui/TunerLandingScreen.tsx`
- 音频链路：`src/lib/audio/*`
- 音乐映射：`src/lib/music/*`
- 类型契约：`src/types/tuner.ts`

## 3. Runtime Pipeline (Current)

当前运行链路按以下顺序执行：

1. 用户点击“开始调音”
2. `BrowserMicrophoneManager.start()` 请求麦克风权限并初始化 `AudioContext`
3. `AnalyserTimeDomainFrameCapture.readFrame()` 读取时域音频帧
4. `YinPitchDetector.detect()` 输出候选音高（或 `null`）
5. `ContinuousPitchTracker.update()` 进行连续跟踪与锁定状态机判断
6. `TuningInterpreter.interpret()` 计算目标弦与偏差解释（自动/手动模式）
7. `TunerViewModelBuilder.build()` 产出 UI 视图模型
8. `mapViewModelStageToLegacyUiStatus()` 映射回兼容状态并写入 `TunerState`
9. UI 根据 `TunerState + TunerViewModel` 渲染主界面与调试读数

补充（最新变更）：

10. 页面支持列出可用麦克风输入源，并允许用户手动选择输入设备
11. 选定设备后，后续启动调音会优先使用该输入源
12. 页面提供手动目标弦锁定入口（默认仍为自动目标）

## 4. Audio and Detection Parameters

### 4.1 Frame capture

- 默认 `fftSize = 2048`
- 默认 `smoothingTimeConstant = 0.05`
- 每帧附带 `sampleRate`、`rms`、`peak`

### 4.2 Pitch detection (YIN)

- `minFrequencyHz = 70`
- `maxFrequencyHz = 360`
- `probabilityThreshold = 0.82`
- `rmsThreshold = 0.008`
- 输入能量不足或置信度不足时返回 `null`

### 4.3 Stabilization

- `requiredSamples = 3`
- `centsTolerance = 12`
- `clarityThreshold = 0.82`
- `maxHistory = 5`
- 仅在窗口内离散度满足条件时判定 `stable=true`

## 5. State Model (Observed)

当前代码可到达的 UI 状态（`TunerState.uiStatus`）：

- `idle`
- `requesting-permission`
- `permission-denied`
- `listening`
- `signal-weak`
- `no-signal`
- `detecting`
- `unstable`
- `in-tune`
- `error`

说明：

- 当音频能量存在但未检测到可用频率时，Hook 会根据 RMS 映射到 `signal-weak` 或 `no-signal`。
- 页面错误恢复依赖 “重置会话” 按钮（在非 idle/requesting-permission 状态可用）。

## 6. Target and Deviation Logic

- 目标弦来源优先级：手动选择（若有） -> `TuningInterpretation.targetId` -> 无目标
- UI 默认自动目标，并在 Advanced targeting 中提供手动选弦入口
- 偏差计算来自 `TuningInterpreter.interpret()` 输出的 `centsOffset`
- 方向判定沿用 `flat / in-tune / sharp / unknown`

### 6.1 `src/lib/music/tuningInterpreter.ts` 当前实现边界

已实现（代码事实）：

- 自动模式在 `locked/degraded` 阶段按最近标准弦计算 `targetId` 与偏差。
- 自动模式在 `acquiring/tracking` 阶段仅输出检测音名，不分配目标弦（`targetId=null`）。
- 手动模式在存在 `selection.targetId` 时强制按该目标弦解释偏差。
- `idle/lost` 或 `trackedFrequencyHz=null` 时返回空解释（`detectedFrequencyHz/targetId/centsOffset` 为空）。

未实现（当前边界）：

- 非标准六弦调弦规则（alternate tuning）下的解释策略。
- 基于历史上下文的目标弦连续性约束（当前按单次 tracking 输入解释）。

已知限制：

- `in-tune` 阈值固定为 `5 cents`，尚未按设备或场景动态调整。
- 若上游 tracking 频率抖动大，解释层会直接反映抖动，不做二次平滑。

未验证项：

- manual/auto 快速切换时，解释输出在弱信号边界下的稳定性。
- `degraded` 阶段长期保持后重新锁定的目标连续性体验（需真机回归）。

## 7. What Is Implemented vs Not

### 7.1 Implemented

- 浏览器本地音频处理（无后端音频上传链路）
- 标准六弦目标映射（E2 A2 D3 G3 B3 E4）
- 候选检测 + 连续跟踪 + 调音解释 + 视图模型闭环
- 调试读数面板（频率、音名、cents、clarity、sampleCount）
- 麦克风输入源刷新与手动选择（device picker）
- 手动目标弦锁定入口（Advanced targeting）
- 开发日志控制台（permission/audio/detector 等事件时间线）

### 7.2 Not implemented

- 目标模式的持久化策略（刷新后仍恢复上次手动目标）
- alternate tuning（降半音、开放和弦等）
- 多乐器模式
- AudioWorklet 版本检测链路
- 自动化回归测试与参数自适应调参机制

## 8. Known Limits and Risks

- 低信噪比环境下，候选值可能频繁中断，导致稳定化窗口反复重置。
- `setInterval(75ms)` 轮询在不同设备上的时序精度存在差异，可能影响锁定体验一致性。
- 当前参数以“可用原型”为目标，尚未按多设备样本系统标定。
- 旧 `uiStatus` 与新 `viewModel.uiStage` 并行维护，存在双状态映射复杂度。

## 9. Verification Checklist

建议每次算法或阈值调整后至少回归以下点：

- 权限成功/拒绝流程是否正常
- 低 E 和高 E 的收敛速度与稳定性
- 弱信号场景是否能保持“谨慎输出”而非误报
- `in-tune` 状态是否出现抖动

## 10. Evidence

本文档结论基于以下代码路径：

- `src/features/tuner/model/useTunerPrototype.ts`
- `src/features/tuner/model/tunerState.ts`
- `src/features/tuner/ui/TunerLandingScreen.tsx`
- `src/lib/audio/microphoneManager.ts`
- `src/lib/audio/frameCapture.ts`
- `src/lib/audio/pitchDetector.ts`
- `src/lib/audio/continuousPitchTracker.ts`
- `src/features/tuner/model/tunerViewModel.ts`
- `src/lib/music/noteMapping.ts`
- `src/lib/music/standardTuning.ts`
- `src/types/tuner.ts`
