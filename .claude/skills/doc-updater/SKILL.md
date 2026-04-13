---
name: doc-updater
description: 从代码自动生成和刷新文档与 codemaps（结构图、模块关系、README/GUIDES 同步）。当用户提到 codemap、文档自动更新、README 对齐、架构地图、依赖关系分析时使用。该技能只负责“生成与刷新”，最终门禁与治理由 documentation-maintainer 执行。
---

# Doc Updater

用于把“代码事实”快速转成文档产物，重点解决两件事：  
1) 生成分层 codemap 文档；2) 刷新 README/GUIDES 与代码一致。

## 角色边界（避免与其它 Skill 冲突）

- 本技能负责：**生成/刷新**（produce）。
- `documentation-maintainer` 负责：**治理/验收/门禁**（govern）。
- 若规则冲突，以 `documentation-maintainer` 的硬门禁为准。
- 本技能不单独宣告“文档任务完成”，需交给治理技能做最终判定。

## 触发条件

出现任一情形时优先启用本技能：

- 用户明确提到“codemap/架构地图/依赖关系图/自动更新文档”。
- 代码结构变化较大（新模块、目录迁移、入口变化）。
- README、GUIDE、API 说明与实际代码疑似不一致。
- 需要从 TS/TSX 代码自动提取模块关系或导出信息。

## 执行顺序（固定）

1. **对齐范围**：确认扫描目录与目标文档范围（默认 `src/` 与 `docs/`）。
2. **收集事实**：入口点、导入导出、关键模块、外部依赖。
3. **生成 codemaps**：默认写入分层目录（见下方结构），不采用单层扁平落盘。
4. **刷新说明文档**：更新 `README.md` 与 `docs/GUIDES/*`（若存在）。
5. **快速校验**：路径、链接、命令示例可执行性。
6. **交接治理**：输出变更清单与未验证项，交由 `documentation-maintainer` 门禁验收。

## 推荐产物结构（默认分层，非扁平）

```text
docs/
├── development/
│   └── 00-overview/
│       ├── README.md
│       └── codemaps/
│           ├── INDEX.md
│           ├── frontend/
│           │   ├── INDEX.md
│           │   ├── app-router.md
│           │   ├── components/
│           │   │   ├── INDEX.md
│           │   │   ├── forms.md
│           │   │   └── layout.md
│           │   └── state-and-dataflow.md
│           ├── backend/
│           │   ├── INDEX.md
│           │   ├── api/
│           │   │   ├── INDEX.md
│           │   │   ├── markets.md
│           │   │   └── pricing.md
│           │   ├── services.md
│           │   └── middleware.md
│           ├── database/
│           │   ├── INDEX.md
│           │   ├── schema/
│           │   │   ├── INDEX.md
│           │   │   ├── core-tables.md
│           │   │   └── analytics-tables.md
│           │   └── migrations.md
│           ├── integrations/
│           │   ├── INDEX.md
│           │   ├── auth.md
│           │   ├── ai-and-search.md
│           │   └── blockchain.md
│           └── workers/
│               ├── INDEX.md
│               ├── queues.md
│               └── schedules.md
└── _meta/
    └── docs-contract.md
```

兼容规则（仅在明确需要时启用）：

- 可额外生成 `docs/CODEMAPS/*` 作为镜像出口（例如历史链接兼容）。
- 但 Canonical 必须是分层路径（`docs/development/00-overview/codemaps/*`）。
- 若存在双份内容，必须保持同步，且在索引页标明 Canonical 路径。

## 大仓拆分规则（强制）

- 单文件超过 400 行或单主题超过 8 个子模块时，必须继续下钻拆分。
- `INDEX.md` 只做导航与摘要，不承载大段细节。
- 主题页只保留该主题边界，跨主题内容改为链接，不复制粘贴。
- 拆分优先级：`按领域(frontend/backend)` -> `按子系统(api/components/schema)` -> `按能力点`。
- 任何页面达到 700 行视为超限，必须拆为“总览 + 子页”。

## 命名与索引规范（强制）

- 所有 codemap 目录都必须有 `INDEX.md`，且仅承担导航摘要职责。
- 文件命名统一使用小写短横线：`<domain>-<topic>.md` 或 `<topic>.md`。
- 禁止使用 `final`、`new`、`temp`、`v2` 等语义不稳定命名。
- 领域层固定：`frontend`、`backend`、`database`、`integrations`、`workers`（按需增减）。
- 子系统层建议前缀：`api-*`、`component-*`、`schema-*`、`queue-*`，便于批量检索。

## 跨页组织规则（强制）

- 每个主题页开头必须包含：适用范围、入口文件、上游依赖、下游依赖。
- 详细流程必须拆到子页；主题页只保留 5-12 条关键信息与链接。
- 同一事实只能在一个 Canonical 页面维护，其他页面只引用不复制。
- 跨域引用统一走相对路径，并在 `INDEX.md` 中提供反向导航链接。

## 自动分片策略（建议默认启用）

当从代码生成 codemap 时，按以下策略自动切片，避免人工再拆：

1. 先按领域分组：`frontend/backend/database/integrations/workers`。
2. 每个领域再按子系统分组（如 `api`、`components`、`schema`、`queue`）。
3. 每个子系统按“能力点”生成叶子页，单页目标 150-350 行。
4. 任一叶子页超过 400 行，继续拆分为 `*-part-a.md` / `*-part-b.md` 或更语义化子页。
5. 自动回填索引导航：子系统 `INDEX.md` -> 领域 `INDEX.md` -> 根 `INDEX.md`。

## INDEX 模板（可直接复用）

### 1) 根索引 `codemaps/INDEX.md`

```md
# Codemaps Index

## Scope
- Canonical Root: `docs/development/00-overview/codemaps/`
- Last Updated: YYYY-MM-DD

## Domains
- [Frontend](./frontend/INDEX.md)
- [Backend](./backend/INDEX.md)
- [Database](./database/INDEX.md)
- [Integrations](./integrations/INDEX.md)
- [Workers](./workers/INDEX.md)

## Navigation Rules
- 事实以子页面为准，当前页仅做导航摘要。
```

### 2) 领域索引 `codemaps/<domain>/INDEX.md`

```md
# <Domain> Codemap

## Entry Points
- `path/to/entry-a`
- `path/to/entry-b`

## Subsystems
- [Subsystem A](./subsystem-a/INDEX.md)
- [Subsystem B](./subsystem-b/INDEX.md)

## Data Flow (Summary)
- Input -> Processing -> Output

## Related Domains
- [Backend](../backend/INDEX.md)
```

### 3) 子系统索引 `codemaps/<domain>/<subsystem>/INDEX.md`

```md
# <Subsystem> Codemap

## Responsibility
- What this subsystem owns

## Key Modules
- [module-a](./module-a.md)
- [module-b](./module-b.md)

## Upstream / Downstream
- Upstream:
- Downstream:

## Change Risk
- High:
- Medium:
- Low:
```

## 建议命令（有脚本时优先脚本）

```bash
# 生成 codemap（优先使用仓库脚本）
npx tsx .claude/skills/doc-updater/scripts/generate.ts

# 依赖图（可选）
npx madge --image graph.svg src/

# JSDoc 抽取（可选）
npx jsdoc2md src/**/*.ts
```

若仓库没有这些脚本或依赖，退化为“读取代码结构 + 增量更新文档”的方式，并在结果中标注“自动化能力缺失”。

## 输出格式（交给治理技能前）

```md
## 生成/刷新结果
- 已更新文件：
- 新增文件：

## 事实来源
- 代码路径：
- 配置/脚本路径：

## 未验证项
- ...

## 建议下一步
- 交由 documentation-maintainer 执行门禁校验
```

## 禁止事项

- 不得把推测当事实写入文档。
- 不得跳过路径/链接核对直接宣告完成。
- 不得覆盖 `documentation-maintainer` 的门禁结论。

## 与 documentation-maintainer 的衔接协议

执行完本技能后，必须补充以下交接信息：

- 本次扫描范围（目录、文件模式）。
- 生成文件列表（含新增/更新）。
- 关键结论与证据来源。
- 风险、假设、未验证项。

治理技能拿到交接信息后，再执行最终 DoD 判定。
