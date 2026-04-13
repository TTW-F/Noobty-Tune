# Audio and Detection Current

## 1. Scope

本文档描述当前音频采集、候选检测和稳定化链路的实际实现，不包含未来算法规划。

## 2. Modules

- `src/lib/audio/microphoneManager.ts`
- `src/lib/audio/frameCapture.ts`
- `src/lib/audio/pitchDetector.ts`
- `src/lib/audio/pitchStabilizer.ts`
- `src/lib/audio/index.ts`

## 3. Microphone Lifecycle

`BrowserMicrophoneManager` 当前负责音频会话生命周期：

- `requestAccess()`：检查 `mediaDevices` / `AudioContext` 可用性并请求权限
- `start()`：确保 `AudioContext` 进入 `running`，状态切到 `listening`
- `suspend()` / `resume()`：切换 `AudioContext` 运行状态
- `dispose()`：停止 tracks、断开 analyser、关闭 context

与输入设备选择相关的使用方式（由 Hook 驱动）：

- 可枚举可用输入源列表
- 可维护“偏好输入设备 ID”
- 启动会话时优先使用用户当前选择的输入源
- 关键生命周期节点会写入开发日志（scope: `permission` / `audio`）

当前启用的 getUserMedia 音频约束：

- `autoGainControl: false`
- `echoCancellation: false`
- `noiseSuppression: false`

## 4. Frame Capture

`AnalyserTimeDomainFrameCapture` 当前通过 `AnalyserNode` 获取时域样本：

- 默认 `fftSize = 2048`
- 默认 `smoothingTimeConstant = 0.05`
- 每次 `readFrame()` 输出：
  - `samples`
  - `sampleRate`
  - `timestampMs`
  - `rms`
  - `peak`

## 5. Pitch Detection

当前主路径为 `YinPitchDetector`，并保留 `AutoCorrelationPitchDetector` 作为对比实现。

### 5.1 YIN detector

- 输入长度不足（< 32）直接返回 `null`
- 先做 RMS 门限过滤（默认 `0.01`，在主 Hook 中配置为 `0.008`）
- 再做 YIN 差分与归一化累积
- 满足概率阈值后返回 `frequencyHz + clarity`
- 最终附带最近音名映射结果（`noteName` / `octave` / `cents`）

### 5.2 Autocorrelation detector

- 同样先做 RMS 过滤
- 通过归一化自相关寻找最优 `tau`
- 经抛物线插值后换算 `frequencyHz`
- 仅在相关度达阈值时输出

## 6. Stabilization Strategy

`RollingPitchStabilizer` 的当前稳定策略：

- 候选为空时立即 `reset`
- 清晰度低于阈值时立即 `reset`
- 在最近窗口上计算 cents spread
- spread 小于等于容差才标记 `stable=true`
- 输出中位数频率 + 平均清晰度 + 平均 RMS

默认（由 `useTunerPrototype` 配置）：

- `requiredSamples=3`
- `centsTolerance=12`
- `clarityThreshold=0.82`
- `maxHistory=5`

## 7. Known Behavior and Limits

- 当前主循环由 `setInterval(75ms)` 驱动，不是基于 `AudioWorklet` 的连续处理。
- 噪声或弱信号下会频繁触发 `reset`，表现为“有候选但不稳定”。
- 频率范围固定为 `70-360Hz`，超出范围不输出候选。
- `PlaceholderPitchDetector` / `PlaceholderPitchStabilizer` 当前只是兼容封装，不含独立逻辑。

## 8. Verification Focus

- 权限拒绝、设备不可用、AudioContext 不支持的错误分支
- 低 E 与高 E 的稳定窗口收敛速度
- 噪声条件下误检率与 `stable` 触发频率

## 9. Evidence Paths

- `src/lib/audio/microphoneManager.ts`
- `src/lib/audio/frameCapture.ts`
- `src/lib/audio/pitchDetector.ts`
- `src/lib/audio/pitchStabilizer.ts`
- `src/features/tuner/model/useTunerPrototype.ts`
- `src/lib/logging/developerLogger.ts`
