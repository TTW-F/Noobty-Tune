# Noobty Tune 文档索引

当前项目处于需求分析与设计阶段，文档按“研究 -> 需求 -> 设计”组织。

## 当前文档

- [项目分析草案](./guitar-tuner-web-v1-analysis.md)
  包含目标、竞品/参考实现、关键风险、技术方向和阶段建议。

- [Web V1 PRD](./guitar-tuner-web-v1-prd.md)
  包含产品范围、用户流程、功能需求、非功能需求、验收标准和版本规划。

- [Web V1 技术设计草案](./technical-design-web-v1.md)
  包含系统架构、模块拆分、音频链路、算法选择、状态机、测试和多端复用边界。

- [Web V1 测试计划](./test-plan-web-v1.md)
  包含测试范围、设备与浏览器矩阵、核心场景、质量指标和缺陷优先级。

- [Web V1 UI 规格](./ui-spec-web-v1.md)
  包含页面结构、核心组件、视觉方向、交互状态、响应式和无障碍要求。

- [Web V1 WBS](./wbs-web-v1.md)
  包含阶段拆解、任务优先级、里程碑建议和执行顺序。

- [Web V1 里程碑](./milestones-web-v1.md)
  包含 M1-M5 的完成定义与当前阶段判断。

- [M1 实现计划](./implementation-plan-m1.md)
  包含原型启动阶段的目标、范围、任务拆解和验收标准。

- [M1 检查清单](./implementation-checklist-m1.md)
  包含工程、页面、音频、结构和验证项的快速核对列表。

## 建议后续补充的文档

- `adr/`
  记录关键架构决策，例如：
  - 是否采用 `AudioWorklet`
  - 是否优先使用 `YIN`
  - V1 是否支持手动选弦

## 当前 ADR

- [ADR 0001 - Web V1 范围锁定](./adr/0001-web-v1-scope.md)
- [ADR 0002 - 浏览器本地音频处理](./adr/0002-browser-audio-local-first.md)
- [ADR 0003 - 正式实现优先 AudioWorklet](./adr/0003-audioworklet-preferred-architecture.md)
- [ADR 0004 - YIN 作为默认检测候选](./adr/0004-yin-as-default-pitch-detection-candidate.md)
- [ADR 0005 - V1 默认自动目标弦匹配](./adr/0005-auto-target-string-for-v1.md)
