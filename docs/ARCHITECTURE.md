# 调音器架构文档

## 设计原则

本项目的核心设计原则是：**把调音器从"页面驱动"改为"测量驱动"**。

### 核心问题

之前的架构问题：
1. UI 状态直接绑定单帧检测结果，导致闪断
2. 检测器、稳定器、目标解释混在一起
3. 单帧失配立即 reset，不适合延音场景
4. 页面状态超前于底层测量能力

### 解决方案

采用**四层数据流架构**，职责清晰分离：

```
Audio Frame
    ↓
[1] PitchCandidateExtractor  ← 候选提取
    ↓
RawPitchCandidate
    ↓
[2] ContinuousPitchTracker   ← 连续跟踪
    ↓
PitchTrackingState
    ↓
[3] TuningInterpreter        ← 调音解释
    ↓
TuningInterpretation
    ↓
[4] TunerViewModelBuilder    ← UI 视图模型
    ↓
TunerViewModel
    ↓
UI Components
```

## 四层架构详解

### 第一层：候选提取（PitchCandidateExtractor）

**职责**:
- 从音频帧中提取候选频率
- 输出原始检测结果（频率、清晰度、能量）
- **不负责判断"是否该显示给用户"**

**关键设计**:
- 即使质量低，也返回低置信候选（不轻易返回 null）
- "是否采信"交给 Tracker 决定

**数据结构**:
```typescript
interface RawPitchCandidate {
  frequencyHz: number | null;
  clarity: number;
  rms: number;
  peak: number;
  timestampMs: number;
  algorithm: "yin" | "autocorrelation";
}
```

### 第二层：连续跟踪（ContinuousPitchTracker）

**职责**:
- 维护一次拨弦后的连续 pitch 轨迹
- 管理状态机：idle → acquiring → tracking → locked → degraded → lost
- 支持短时 hold，不因单帧失配丢锁
- 频率连续性优先于能量阈值

**关键设计**:
- **双阈值模型**：锁定严格，保持宽松
- **失配计数**：连续失配才释放
- **Hold 机制**：短时失配进入 degraded 而非 lost

**状态机**:
```
idle: 还没有有效输入
  ↓
acquiring: 听到了可能的单音，但还没形成连续目标
  ↓
tracking: 已经形成连续轨迹，但还不够稳
  ↓
locked: 已稳定锁定
  ↓
degraded: 还在跟踪，但可信度下降
  ↓
lost: 原本锁定过，但现在确认已丢失
```

**数据结构**:
```typescript
interface PitchTrackingState {
  trackedFrequencyHz: number | null;
  confidence: number;
  stage: TrackingStage;
  lastStableFrequencyHz: number | null;
  stableDurationMs: number;
  holdRemainingMs: number;
  mismatchCount: number;
  timestampMs: number;
}
```

### 第三层：调音解释（TuningInterpreter）

**职责**:
- 根据 PitchTrackingState 决定当前目标弦
- 计算 cents 偏差
- 输出调音方向

**关键设计**:
- **auto 模式**：未进入足够稳定阶段时，不强推目标弦
- **manual 模式**：直接以指定目标弦计算偏差
- **detected note 与 target note 必须区分**

**数据结构**:
```typescript
interface TuningInterpretation {
  detectedFrequencyHz: number | null;
  detectedNote: string | null;          // 检测到的音名
  targetId: string | null;              // 目标弦ID
  targetFrequencyHz: number | null;
  centsOffset: number | null;
  direction: "flat" | "sharp" | "in-tune" | "unknown";
  confidence: number;
  trackingStage: TrackingStage;
}
```

### 第四层：视图模型（TunerViewModelBuilder）

**职责**:
- 把调音语义翻译成 UI 需要的展示字段
- 不再自己判断底层真伪

**关键设计**:
- **success 表达只在 locked + in-tune + confidence 足够高时出现**
- **degraded 阶段显示"仍在跟踪，但信号变弱"**
- **acquiring 阶段不显示目标弦**

**数据结构**:
```typescript
interface TunerViewModel {
  uiStage: TunerUiStage;
  displayFrequency: string;             // "82.4 Hz" 或 "E2"
  displayCents: string;                 // "+12¢" 或 "---"
  displayTarget: string | null;         // "6弦 (E2)"
  needlePosition: number;               // -1 到 1
  showSuccess: boolean;
  statusMessage: string;
  confidence: number;
}
```

## 关键改进点

### 1. 状态机改进

**之前**:
```
有值 / 没值
成功 / 失败
```

**现在**:
```
idle → acquiring → tracking → locked → degraded → lost
```

**优势**:
- 区分"还没开始"和"已经丢失"
- 区分"正在锁定"和"已经锁定"
- 区分"信号变弱"和"完全丢失"

### 2. 双阈值模型

**锁定阶段（严格）**:
```typescript
{
  lockClarityThreshold: 0.82,
  lockRequiredFrames: 3,
  maxFrequencyJumpCents: 50,
}
```

**保持阶段（宽松）**:
```typescript
{
  holdClarityThreshold: 0.50,  // 降低 39%
  holdDurationMs: 600,
  releaseAfterMisses: 8,
}
```

**优势**:
- 避免误锁定
- 避免频繁闪断
- 延音阶段保持更久

### 3. 目标解释延后

**之前**:
- 检测器输出就包含目标弦信息
- acquiring 阶段就显示目标弦

**现在**:
- acquiring 阶段只显示"检测中"和频率
- locked 阶段才推断目标弦
- detected note 和 target note 分离

**优势**:
- 不会过早误导用户
- 自动目标不会在不稳定阶段乱跳

### 4. 频率连续性优先

**之前**:
```typescript
if (clarity < threshold || rms < threshold) {
  reset();  // 立即清空
}
```

**现在**:
```typescript
// 优先检查频率连续性
const centsDelta = getCentsOffset(current, tracked);
if (Math.abs(centsDelta) < maxJump) {
  // 即使 clarity 低，也继续跟踪
  maintain();
}
```

**优势**:
- 延音衰减阶段仍能跟踪
- 不因单帧能量下降丢锁

## 数据流示例

### 场景：用户拨动 6 弦（E2）

```
Frame 1:
  RawCandidate: { frequencyHz: 82.1, clarity: 0.85 }
  TrackingState: { stage: "acquiring", confidence: 0.85 }
  Interpretation: { detectedNote: "E2", targetId: null }
  ViewModel: { displayFrequency: "82.1 Hz", statusMessage: "正在检测..." }

Frame 2-3:
  RawCandidate: { frequencyHz: 82.3, clarity: 0.87 }
  TrackingState: { stage: "acquiring", confidence: 0.86 }
  Interpretation: { detectedNote: "E2", targetId: null }
  ViewModel: { displayFrequency: "82.3 Hz", statusMessage: "正在检测..." }

Frame 4:
  RawCandidate: { frequencyHz: 82.4, clarity: 0.88 }
  TrackingState: { stage: "locked", confidence: 0.87 }  ← 锁定成功
  Interpretation: { detectedNote: "E2", targetId: "string-6", centsOffset: -2 }
  ViewModel: { displayFrequency: "E2", displayTarget: "6弦 (E2)", statusMessage: "接近准确" }

Frame 10 (延音衰减):
  RawCandidate: { frequencyHz: 82.5, clarity: 0.55 }  ← clarity 下降
  TrackingState: { stage: "locked", confidence: 0.70 }  ← 仍保持锁定
  Interpretation: { detectedNote: "E2", targetId: "string-6", centsOffset: +1 }
  ViewModel: { displayFrequency: "E2", statusMessage: "调音准确！" }

Frame 20 (严重衰减):
  RawCandidate: { frequencyHz: null, clarity: 0.20 }
  TrackingState: { stage: "degraded", mismatchCount: 3 }  ← 进入降级
  Interpretation: { detectedNote: "E2", targetId: "string-6" }
  ViewModel: { displayCents: "信号变弱", statusMessage: "信号变弱，仍在跟踪" }

Frame 30 (完全丢失):
  RawCandidate: { frequencyHz: null, clarity: 0.10 }
  TrackingState: { stage: "lost", mismatchCount: 10 }  ← 确认丢失
  Interpretation: { detectedNote: null, targetId: null }
  ViewModel: { displayFrequency: "---", statusMessage: "信号丢失，请重新拨弦" }
```

## 验收标准

重构完成后，应满足：

1. ✅ **连续性**: 单次拨弦后，系统能形成连续 tracking 对象
2. ✅ **延音保持**: 延音衰减阶段优先进入 degraded，而不是直接丢失
3. ✅ **低抖动**: UI 不再随单帧波动频繁闪断
4. ✅ **目标稳定**: 自动目标弦不会在不稳定阶段过早跳转
5. ✅ **职责分离**: 原始检测、跟踪结果、调音解释三层边界清晰
6. ✅ **状态诚实**: UI 状态与底层测量能力一致

## 相关文档

- [参数配置指南](./PITCH_TRACKER_CONFIG.md)
- [调试指南](./DEBUGGING.md)
- [测试指南](./TESTING.md)
