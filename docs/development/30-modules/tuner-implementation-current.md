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
5. `RollingPitchStabilizer.push()` 进行多帧稳定化
6. `resolveActiveTarget()` 计算当前目标弦（默认自动）
7. `resolveDeviation()` 计算 cents 偏差与方向
8. UI 根据 `TunerState` 渲染状态与调试读数

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

当前代码可到达的 UI 状态：

- `idle`
- `requesting-permission`
- `permission-denied`
- `listening`
- `detecting`
- `unstable`
- `in-tune`
- `error`

说明：

- `no-signal` 类型已定义，但当前 Hook 未显式切换到该状态。
- 页面错误恢复依赖 “重置状态” 按钮（在 `permission-denied` / `error` 时展示）。

## 6. Target and Deviation Logic

- 目标弦来源优先级：手动选择（若有） -> 稳定化 target -> 候选音高最近目标
- 当前 UI 未提供手动选弦入口，实际运行以自动目标为主
- 偏差计算：`getCentsOffset(reading.frequencyHz, target.frequencyHz)`
- 方向判定：`flat / in-tune / sharp`（默认 `inTuneTolerance = 5` cents）

## 7. What Is Implemented vs Not

### 7.1 Implemented

- 浏览器本地音频处理（无后端音频上传链路）
- 标准六弦目标映射（E2 A2 D3 G3 B3 E4）
- 候选检测 + 稳定化 + 偏差方向基本闭环
- 调试读数面板（频率、音名、cents、clarity、sampleCount）

### 7.2 Not implemented

- 手动目标弦切换 UI
- alternate tuning（降半音、开放和弦等）
- 多乐器模式
- AudioWorklet 版本检测链路
- 自动化回归测试与参数自适应调参机制

## 8. Known Limits and Risks

- 低信噪比环境下，候选值可能频繁中断，导致稳定化窗口反复重置。
- `setInterval(75ms)` 轮询在不同设备上的时序精度存在差异。
- 当前参数以“可用原型”为目标，尚未按多设备样本系统标定。
- 状态定义与实际切换存在轻微不一致（如 `no-signal` 未实际触发）。

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
- `src/lib/audio/pitchStabilizer.ts`
- `src/lib/music/noteMapping.ts`
- `src/lib/music/standardTuning.ts`
- `src/types/tuner.ts`
