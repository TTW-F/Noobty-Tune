# 音高跟踪器参数说明

## 概述

`ContinuousPitchTracker` 使用双阈值模型来实现连续音高跟踪。本文档说明各参数的含义和调整建议。

## 参数详解

### 锁定阶段参数（Lock Phase）

这些参数控制从 `acquiring` 到 `locked` 的转换条件（严格）。

#### `lockClarityThreshold`
- **默认值**: `0.82`
- **含义**: 锁定所需的最低清晰度（算法置信度）
- **调整建议**:
  - 提高（如 0.85）：减少误锁定，但可能难以锁定弱信号
  - 降低（如 0.78）：更容易锁定，但可能误锁定噪声

#### `lockRequiredFrames`
- **默认值**: `3`
- **含义**: 锁定所需的连续有效帧数
- **调整建议**:
  - 提高（如 5）：更稳定，但锁定延迟增加
  - 降低（如 2）：响应更快，但可能不够稳定

#### `maxFrequencyJumpCents`
- **默认值**: `50` cents
- **含义**: 允许的最大频率跳变（用于判断是否为同一音高）
- **调整建议**:
  - 提高（如 80）：允许更大的频率变化
  - 降低（如 30）：更严格的频率连续性要求

### 保持阶段参数（Hold Phase）

这些参数控制 `locked` 状态的维持条件（宽松）。

#### `holdClarityThreshold`
- **默认值**: `0.50`
- **含义**: 保持锁定所需的最低清晰度（比锁定阈值低 39%）
- **调整建议**:
  - 提高（如 0.60）：更早进入 degraded 状态
  - 降低（如 0.40）：延长保持时间，但可能跟踪噪声

#### `holdDurationMs`
- **默认值**: `600` ms
- **含义**: 短时失配的保持时间
- **调整建议**:
  - 提高（如 800）：更长的延音保持
  - 降低（如 400）：更快响应信号丢失

#### `trackingToleranceMisses`
- **默认值**: `2`
- **含义**: `tracking` 阶段连续多少次失配才降级到 `degraded`。
  没有缓冲时，clarity 在保持门限附近徘徊的延音会让状态每帧翻转（最高 10 次/秒），
  UI 文案随之闪烁。
- **调整建议**:
  - 提高（如 3）：更强的抗单帧抖动，但对真实信号变化的响应变慢
  - 降低（如 1）：更快反映信号恶化，但状态翻转风险回升

### 释放条件（Release Condition）

#### `releaseAfterMisses`
- **默认值**: `8`
- **含义**: 连续失配多少次后释放锁定
- **调整建议**:
  - 提高（如 12）：更长的容错时间
  - 降低（如 6）：更快释放

### 捕获阶段参数（Acquiring Phase）

#### `acquiringGraceMisses`
- **默认值**: `2`
- **含义**: `acquiring` 阶段容忍的连续空帧数。拨弦瞬态和麦克风间歇弱帧经常产生空帧，
  超过容忍次数才回到 `idle`，避免采集过程被反复打断。
- **调整建议**:
  - 提高（如 3）：更宽容的采集过程，但可能粘在无效信号上
  - 降低（如 1）：更快回到 idle，但锁定延迟增加

### 其他参数

#### `maxHistoryFrames`
- **默认值**: `12`
- **含义**: 最大历史帧数（用于平滑计算）
- **调整建议**:
  - 提高（如 16）：更平滑，但内存占用增加
  - 降低（如 8）：更快响应，但可能更抖动

## 状态转换流程

```
idle
  ↓ (检测到候选，且 clarity >= holdClarityThreshold)
acquiring
  ↓ (连续 lockRequiredFrames 帧，clarity >= lockClarityThreshold)
locked
  ↓ (clarity < holdClarityThreshold 或频率跳变)
degraded
  ↓ (连续 releaseAfterMisses 次失配)
lost
  ↓ (检测到候选，且 clarity >= holdClarityThreshold)
acquiring
```

注意：检测器自 2026-09 起对 clarity 介于 `holdClarityThreshold` 与锁定阈值之间的边缘帧
**如实上报**（不再直接丢弃）。`idle`/`lost` 进入 `acquiring` 时会以 `holdClarityThreshold`
做准入门，低于该值的候选视为噪声，不启动采集。

平滑窗口的一致性规则：被跳变门拒绝的候选（如八度跳错）虽然会进入历史，但
**不会进入平滑均值窗口**——窗口从尾部向前取帧，遇到与参考频率偏差超过
`maxFrequencyJumpCents` 的帧即停止，避免单个八度毛刺把均值拖偏并级联掉锁。

## 调参建议

### 场景 1: 延音保持不够长

**症状**: 拨弦后 1-2 秒就丢失锁定

**调整**:
```typescript
{
  holdClarityThreshold: 0.40,  // 降低保持阈值
  holdDurationMs: 800,         // 增加保持时间
  releaseAfterMisses: 12,      // 增加容错次数
}
```

### 场景 2: 锁定过慢

**症状**: 拨弦后需要很久才能锁定

**调整**:
```typescript
{
  lockClarityThreshold: 0.78,  // 降低锁定阈值
  lockRequiredFrames: 2,       // 减少所需帧数
}
```

### 场景 3: 误锁定噪声

**症状**: 没有拨弦时也显示锁定

**调整**:
```typescript
{
  lockClarityThreshold: 0.85,  // 提高锁定阈值
  lockRequiredFrames: 5,       // 增加所需帧数
}
```

### 场景 4: 频繁闪断

**症状**: 锁定后频繁在 locked/degraded 之间跳转

**调整**:
```typescript
{
  holdClarityThreshold: 0.45,  // 降低保持阈值
  maxFrequencyJumpCents: 60,   // 允许更大频率变化
  releaseAfterMisses: 10,      // 增加容错次数
}
```

## 使用示例

```typescript
import { ContinuousPitchTracker } from "@/lib/audio";

// 使用自定义配置
const tracker = new ContinuousPitchTracker({
  lockClarityThreshold: 0.80,
  lockRequiredFrames: 3,
  holdClarityThreshold: 0.45,
  holdDurationMs: 700,
  releaseAfterMisses: 10,
  maxFrequencyJumpCents: 50,
  maxHistoryFrames: 12,
});

// 更新跟踪器
const trackingState = tracker.update(candidate);

console.log(trackingState.stage); // "idle" | "acquiring" | "tracking" | "locked" | "degraded" | "lost"
```

## 调试建议

1. **启用日志**: 跟踪器会自动记录状态转换
2. **观察 confidence**: 查看 `trackingState.confidence` 的变化趋势
3. **监控 mismatchCount**: 查看失配计数是否频繁增加
4. **检查 stableDurationMs**: 查看锁定持续时间

## 相关文档

- [架构设计文档](./ARCHITECTURE.md)
- [调试指南](./DEBUGGING.md)
