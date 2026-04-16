# 调试指南

## 概述

本项目提供了完整的调试工具链，用于观测四层数据流的实时状态和时序变化。

## 调试工具

### 1. 增强调试面板 (EnhancedDebugPanel)

实时显示四层数据流的完整信息。

**使用方法**:

```typescript
import { EnhancedDebugPanel } from "@/components/EnhancedDebugPanel";
import { useTunerPrototype } from "@/features/tuner/model/useTunerPrototype";

function TunerPage() {
  const {
    rawCandidate,
    trackingState,
    interpretation,
    viewModel,
    detectorComparison,
  } = useTunerPrototype();

  return (
    <>
      <TunerUI />
      <EnhancedDebugPanel
        rawCandidate={rawCandidate}
        trackingState={trackingState}
        interpretation={interpretation}
        viewModel={viewModel}
        frameRms={detectorComparison.frameRms}
        framePeak={null}
      />
    </>
  );
}
```

**显示内容**:
- Layer 1: 原始候选 (频率、清晰度、RMS、Peak)
- Layer 2: 跟踪状态 (阶段、置信度、失配计数、保持时间)
- Layer 3: 调音解释 (目标弦、偏差、方向)
- Layer 4: 视图模型 (UI 阶段、显示内容、成功状态)
- 数据流图示
- 关键指标摘要

### 2. 时序日志记录器 (TimeSeriesLogger)

记录四层数据流的时序变化，用于离线分析。

**基础使用**:

```typescript
const { timeSeriesLogger } = useTunerPrototype();

// 开始记录
timeSeriesLogger.start();

// 拨弦测试...

// 停止记录
timeSeriesLogger.stop();

// 导出到控制台
timeSeriesLogger.export();

// 下载 CSV 文件
timeSeriesLogger.downloadCSV();
```

**高级分析**:

```typescript
// 分析状态转换
timeSeriesLogger.analyzeTransitions();

// 分析失配点
timeSeriesLogger.analyzeMismatches();

// 分析锁定持续时间
timeSeriesLogger.analyzeLockDuration();

// 生成完整报告
timeSeriesLogger.generateReport();
```

### 3. 浏览器控制台快捷方式

在浏览器控制台中，可以直接访问调试工具：

```javascript
// 假设 tuner 实例已暴露到 window
const tuner = window.tuner;

// 开始时序记录
tuner.timeSeriesLogger.start();

// 拨弦测试...

// 停止并生成报告
tuner.timeSeriesLogger.stop();
tuner.timeSeriesLogger.generateReport();

// 下载 CSV
tuner.timeSeriesLogger.downloadCSV("my-test-20240417.csv");
```

## 调试场景

### 场景 1: 延音保持不够长

**症状**: 拨弦后 1-2 秒就丢失锁定

**调试步骤**:

1. 启动时序记录
```typescript
timeSeriesLogger.start();
```

2. 拨动 6 弦（E2）

3. 停止记录并分析
```typescript
timeSeriesLogger.stop();
timeSeriesLogger.analyzeLockDuration();
```

4. 查看关键指标:
   - `stableDurationMs`: 锁定持续时长
   - `mismatchCount`: 失配计数变化
   - `trackingStage`: 状态转换序列

5. 下载 CSV 进行详细分析
```typescript
timeSeriesLogger.downloadCSV("lock-duration-test.csv");
```

6. 在 Excel/Python 中分析:
   - 绘制 `trackingConfidence` 随时间变化
   - 查看 `mismatchCount` 何时开始增加
   - 观察 `rawClarity` 的衰减曲线

**预期结果**:
- `locked` 状态应保持 4-6 秒
- `mismatchCount` 应缓慢增加
- 应先进入 `degraded` 再进入 `lost`

**调参建议**:

如果锁定时间不足，调整 `ContinuousPitchTracker` 配置：

```typescript
new ContinuousPitchTracker({
  holdClarityThreshold: 0.40,  // 降低保持阈值
  holdDurationMs: 800,         // 增加保持时间
  releaseAfterMisses: 12,      // 增加容错次数
})
```

### 场景 2: 频繁闪断

**症状**: locked 后频繁在 locked/degraded 之间跳转

**调试步骤**:

1. 启动时序记录并拨弦

2. 分析状态转换
```typescript
timeSeriesLogger.analyzeTransitions();
```

3. 查看输出:
```
frame | from      | to        | duration
------|-----------|-----------|----------
10    | acquiring | locked    | 3
15    | locked    | degraded  | 5
18    | degraded  | locked    | 3
22    | locked    | degraded  | 4
```

4. 如果 `duration` 很短（< 5 帧），说明阈值过严

**调参建议**:

```typescript
new ContinuousPitchTracker({
  holdClarityThreshold: 0.45,  // 降低保持阈值
  maxFrequencyJumpCents: 60,   // 允许更大频率变化
  releaseAfterMisses: 10,      // 增加容错次数
})
```

### 场景 3: 锁定过慢

**症状**: 拨弦后需要很久才能锁定

**调试步骤**:

1. 启动时序记录并拨弦

2. 分析状态转换
```typescript
timeSeriesLogger.analyzeTransitions();
```

3. 查看 `acquiring` 到 `locked` 的帧数

4. 下载 CSV 查看 `rawClarity` 是否足够高

**调参建议**:

```typescript
new ContinuousPitchTracker({
  lockClarityThreshold: 0.78,  // 降低锁定阈值
  lockRequiredFrames: 2,       // 减少所需帧数
})
```

### 场景 4: 误锁定噪声

**症状**: 没有拨弦时也显示锁定

**调试步骤**:

1. 不拨弦，观察调试面板

2. 查看 `rawCandidate.clarity` 和 `rawCandidate.rms`

3. 如果 `clarity` 很低但仍锁定，说明阈值过松

**调参建议**:

```typescript
new ContinuousPitchTracker({
  lockClarityThreshold: 0.85,  // 提高锁定阈值
  lockRequiredFrames: 5,       // 增加所需帧数
})
```

## CSV 数据分析

### 导出的 CSV 字段

| 字段 | 说明 |
|------|------|
| `timestampMs` | 时间戳 |
| `frameNumber` | 帧编号 |
| `frameRms` | 音频帧 RMS |
| `framePeak` | 音频帧峰值 |
| `rawFrequencyHz` | 原始检测频率 |
| `rawClarity` | 原始清晰度 |
| `trackingStage` | 跟踪阶段 |
| `trackedFrequencyHz` | 跟踪频率 |
| `trackingConfidence` | 跟踪置信度 |
| `mismatchCount` | 失配计数 |
| `stableDurationMs` | 稳定持续时长 |
| `centsOffset` | 偏差（cents）|
| `uiStage` | UI 阶段 |
| `showSuccess` | 是否显示成功 |

### Python 分析示例

```python
import pandas as pd
import matplotlib.pyplot as plt

# 读取 CSV
df = pd.read_csv('tuner-timeseries.csv')

# 绘制跟踪置信度随时间变化
plt.figure(figsize=(12, 6))
plt.plot(df['frameNumber'], df['trackingConfidence'], label='Tracking Confidence')
plt.axhline(y=0.82, color='r', linestyle='--', label='Lock Threshold')
plt.axhline(y=0.50, color='y', linestyle='--', label='Hold Threshold')
plt.xlabel('Frame Number')
plt.ylabel('Confidence')
plt.title('Tracking Confidence Over Time')
plt.legend()
plt.grid(True)
plt.show()

# 分析状态持续时间
stage_durations = df.groupby('trackingStage').size()
print("Stage Durations (frames):")
print(stage_durations)

# 查找失配点
mismatches = df[df['mismatchCount'] > 0]
print(f"\nTotal mismatch frames: {len(mismatches)}")
print(f"Max mismatch count: {mismatches['mismatchCount'].max()}")
```

## 调试最佳实践

### 1. 记录完整的拨弦周期

```typescript
// 开始记录
timeSeriesLogger.start();

// 拨弦
// 等待 5-10 秒

// 停止记录
timeSeriesLogger.stop();

// 生成报告
timeSeriesLogger.generateReport();
```

### 2. 对比不同参数配置

```typescript
// 测试 1: 默认配置
timeSeriesLogger.start();
// 拨弦...
timeSeriesLogger.stop();
timeSeriesLogger.downloadCSV("test-default.csv");
timeSeriesLogger.clear();

// 测试 2: 宽松配置
// 修改 ContinuousPitchTracker 配置
timeSeriesLogger.start();
// 拨弦...
timeSeriesLogger.stop();
timeSeriesLogger.downloadCSV("test-relaxed.csv");
```

### 3. 记录问题场景

当遇到问题时：

1. 立即启动时序记录
2. 重现问题
3. 停止记录并下载 CSV
4. 在 CSV 文件名中注明问题描述

```typescript
timeSeriesLogger.downloadCSV("issue-early-dropout-string6.csv");
```

### 4. 使用增强调试面板实时监控

在开发过程中，始终显示 `EnhancedDebugPanel`，可以：
- 实时观察四层数据流
- 快速发现异常状态
- 验证参数调整效果

## 常见问题

### Q: 如何查看某一帧的详细数据？

A: 使用浏览器控制台：

```javascript
// 获取所有记录
const entries = tuner.timeSeriesLogger.getEntries();

// 查看第 100 帧
console.log(entries[99]);

// 查看最后 10 帧
console.table(entries.slice(-10));
```

### Q: CSV 文件太大怎么办？

A: 可以在记录前设置最大帧数限制（需要修改 `TimeSeriesLogger`），或者只记录关键时段。

### Q: 如何对比两次测试？

A: 下载两个 CSV 文件，使用 Excel 或 Python 进行对比分析。

## 相关文档

- [架构设计](./ARCHITECTURE.md)
- [参数配置](./PITCH_TRACKER_CONFIG.md)
- [快速开始](./QUICK_START.md)
