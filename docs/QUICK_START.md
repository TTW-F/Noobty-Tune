# 快速开始指南

## 重构完成情况

✅ **Task 1**: 引入 PitchTracker - **已完成**  
✅ **Task 2**: 拆分 TuningInterpreter - **已完成**  
✅ **Task 3**: 重构状态派生 - **已完成**  
⏳ **Task 4**: 调整页面反馈策略 - **待实施**  
⏳ **Task 5**: 补充调试能力 - **待实施**  
⏳ **Task 6**: 测试重构 - **待实施**

## 新架构概览

```
Audio Frame
    ↓
PitchCandidateExtractor  ← 提取候选（不判断是否有效）
    ↓
ContinuousPitchTracker   ← 连续跟踪（双阈值，失配计数）
    ↓
TuningInterpreter        ← 调音解释（延后目标推断）
    ↓
TunerViewModelBuilder    ← 视图模型（UI 只消费这一层）
    ↓
UI Components
```

## 核心改进

### 1. 状态机升级

**之前**: `有值 / 没值`  
**现在**: `idle → acquiring → tracking → locked → degraded → lost`

### 2. 双阈值模型

| 阶段 | 清晰度 | 说明 |
|------|--------|------|
| 锁定 | 0.82 | 严格 |
| 保持 | 0.50 | 宽松（降低 39%）|

### 3. 延音保持

- 单帧失配不丢锁
- 连续 8 次失配才释放
- 短时失配进入 `degraded` 而非 `lost`

## 如何测试

### 1. 启动项目

```bash
cd Noobty-Tune
npm install
npm run dev
```

### 2. 打开调音器

访问 `http://localhost:3000`（或项目配置的端口）

### 3. 测试延音保持

1. 拨动 6 弦（E2）
2. 观察状态转换：
   ```
   idle → acquiring → locked → degraded → lost
   ```
3. 预期：保持 4-6 秒（之前只有 1-2 秒）

### 4. 测试目标稳定性

1. 拨弦
2. 观察 `acquiring` 阶段：
   - ✅ 应显示"正在检测..."
   - ✅ 应显示频率（如 "82.4 Hz"）
   - ❌ 不应显示目标弦
3. 观察 `locked` 阶段：
   - ✅ 应显示目标弦（如 "6弦 (E2)"）
   - ✅ 应显示偏差（如 "+2¢"）

### 5. 启用调试日志

在浏览器控制台：

```javascript
// 启动日志记录
window.tuner.debugLogger.start();

// 拨弦测试...

// 停止并导出
window.tuner.debugLogger.stop();
window.tuner.debugLogger.exportCSV();
```

## 调参建议

### 场景 1: 延音保持不够长

编辑 `src/features/tuner/model/useTunerPrototype.ts`:

```typescript
const trackerRef = useRef(new ContinuousPitchTracker({
  holdClarityThreshold: 0.40,  // 降低保持阈值
  holdDurationMs: 800,         // 增加保持时间
  releaseAfterMisses: 12,      // 增加容错次数
}));
```

### 场景 2: 锁定过慢

```typescript
const trackerRef = useRef(new ContinuousPitchTracker({
  lockClarityThreshold: 0.78,  // 降低锁定阈值
  lockRequiredFrames: 2,       // 减少所需帧数
}));
```

### 场景 3: 频繁闪断

```typescript
const trackerRef = useRef(new ContinuousPitchTracker({
  holdClarityThreshold: 0.45,  // 降低保持阈值
  maxFrequencyJumpCents: 60,   // 允许更大频率变化
  releaseAfterMisses: 10,      // 增加容错次数
}));
```

## 查看四层数据

在组件中：

```typescript
const {
  rawCandidate,        // 第一层：原始候选
  trackingState,       // 第二层：跟踪状态
  interpretation,      // 第三层：调音解释
  viewModel,           // 第四层：视图模型
} = useTunerPrototype();

console.log("Stage:", trackingState?.stage);
console.log("Confidence:", trackingState?.confidence);
console.log("Target:", interpretation?.targetId);
console.log("UI Status:", viewModel.statusMessage);
```

## 常见问题

### Q: 为什么 acquiring 阶段不显示目标弦？

A: 这是设计决策。在未稳定前，不应过早误导用户。只有 `locked` 后才推断目标弦。

### Q: degraded 状态是什么？

A: 信号质量下降但仍在跟踪。这是延音衰减的正常阶段，不应立即显示"丢失"。

### Q: 如何调整参数？

A: 参考 [参数配置指南](./PITCH_TRACKER_CONFIG.md)

### Q: 如何查看日志？

A: 所有状态转换都会自动记录到控制台。使用 `debugLogger` 可以导出详细数据。

## 下一步

1. **测试真机**: 在实际设备上测试延音保持
2. **调整参数**: 根据真机表现微调阈值
3. **完成 Task 4-6**: 页面反馈、调试面板、测试

## 相关文档

- [架构设计](./ARCHITECTURE.md) - 理解设计原理
- [参数配置](./PITCH_TRACKER_CONFIG.md) - 调参指南
- [重构总结](./REFACTORING_SUMMARY.md) - 完整变更记录

## 反馈

如有问题或建议，请查看：
- 控制台日志
- `docs/ARCHITECTURE.md`
- `docs/PITCH_TRACKER_CONFIG.md`
