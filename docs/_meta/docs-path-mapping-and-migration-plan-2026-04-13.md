# Docs 路径映射与迁移计划（2026-04-13）

## 目标

在不破坏现有链接的前提下，将当前扁平 `docs/` 结构渐进迁移到规范分层结构。

## 迁移原则

1. 先映射，后迁移，最后清理。
2. 每批迁移必须完成：路径映射 -> 批量修链 -> 校验。
3. 迁移期间保留兼容入口（`docs-index.md`），避免断链。
4. 未通过校验不得进入下一批。

## 目标目录（本轮规划）

- `docs/product-or-design/`
- `docs/development/`
- `docs/operations/`
- `docs/changelog/`（当前暂无历史文件，先预留）
- `docs/adr/`（保持不变）
- `docs/_meta/`

## 旧路径 -> 新路径映射表（计划）

### Batch A: Product / Design

- `docs/guitar-tuner-web-v1-analysis.md` -> `docs/product-or-design/analysis-web-v1.md`
- `docs/guitar-tuner-web-v1-prd.md` -> `docs/product-or-design/prd-web-v1.md`
- `docs/ui-spec-web-v1.md` -> `docs/product-or-design/ui-spec-web-v1.md`

### Batch B: Development

- `docs/technical-design-web-v1.md` -> `docs/development/technical-design-web-v1.md`
- `docs/test-plan-web-v1.md` -> `docs/development/test-plan-web-v1.md`
- `docs/wbs-web-v1.md` -> `docs/development/wbs-web-v1.md`
- `docs/milestones-web-v1.md` -> `docs/development/milestones-web-v1.md`
- `docs/implementation-plan-m1.md` -> `docs/development/implementation-plan-m1.md`
- `docs/implementation-checklist-m1.md` -> `docs/development/implementation-checklist-m1.md`

### Batch C: Operations

- `docs/deploy.md` -> `docs/operations/deploy.md`
- `docs/handover-deployment-status.md` -> `docs/operations/handover-deployment-status.md`
- `docs/git.md` -> `docs/operations/git.md`

### Batch D: Meta

- `docs/skills-for-this-stage.md` -> `docs/_meta/skills-for-this-stage.md`
- `docs/docs-index.md` -> `docs/_meta/docs-index-legacy.md`（最后阶段再执行）
- `docs/link-index.json` -> `docs/_meta/link-index.json`（建议在 Batch C 后执行）

## 批次执行清单（每批固定）

1. 创建目标目录与目标文件（复制内容，不删旧文件）。
2. 更新 `docs/README.md` 导航到新路径。
3. 批量更新仓库内链接到新路径。
4. 运行链接校验并记录结果。
5. 旧文件顶部加“已迁移”提示（含新路径）。
6. 观察一轮后再删除旧文件（可选）。

## 执行状态

- Batch A（Product / Design）：**已完成（一步到位）**
  - 新路径已承载完整正文：
    - `docs/product-or-design/analysis-web-v1.md`
    - `docs/product-or-design/prd-web-v1.md`
    - `docs/product-or-design/ui-spec-web-v1.md`
  - 主入口与兼容索引已切换到新路径
  - 旧路径已改为“已迁移说明”占位文件，用于兼容与防断链
- Batch B（Development）：**已完成（结构迁移）**
  - 已创建 `docs/development/` 下目标路径入口文件
  - 主入口与兼容索引已切换到 development 路径
  - 旧路径正文保留，后续可做正文实迁与归档
- Batch C（Operations）：**已完成（结构迁移）**
  - 已创建 `docs/operations/` 下目标路径入口文件
  - 主入口已切换到 operations 路径
  - 旧路径正文保留，后续可做正文实迁与归档
- Batch D（Meta）：**已完成（结构迁移）**
  - 已创建 `docs/_meta/skills-for-this-stage.md`
  - 已创建 `docs/_meta/docs-index-legacy.md`
  - 已创建 `docs/_meta/link-index.json`

## 已归档文件清单

归档目录：`docs/_backup/2026-04-13/`

- `technical-design-web-v1.md`
- `test-plan-web-v1.md`
- `wbs-web-v1.md`
- `milestones-web-v1.md`
- `implementation-plan-m1.md`
- `implementation-checklist-m1.md`
- `deploy.md`
- `handover-deployment-status.md`
- `git.md`
- `skills-for-this-stage.md`
- `guitar-tuner-web-v1-analysis.md`
- `guitar-tuner-web-v1-prd.md`
- `ui-spec-web-v1.md`
- `link-index.json`

## 风险与回滚

- 风险：相对路径更新不完整导致局部断链。
- 回滚：从 `docs/_backup/2026-04-13/` 恢复对应历史文件到 canonical 路径。

## 完成判定

以下条件全部满足才视为迁移完成：

- 所有映射项均已迁移或明确取消。
- `docs/README.md` 仅指向新路径。
- 全量链接校验通过。
- 旧入口文件仅保留兼容说明或已归档到 `_meta/`。
