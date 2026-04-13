# Noobty Tune Docs Hub

本页是文档主入口（Canonical Index）。

当前仓库仍处于“平铺文档 + 渐进分层”的过渡阶段。为避免一次性迁移导致链接破坏，现阶段采用以下策略：

1. 保留现有文件路径不动。
2. 通过统一入口管理导航与分类。
3. 后续按增量方式迁移到分层目录。

## 当前分层视图（逻辑分层）

### 规划与设计（Plan / Design）

- [项目分析草案](./product-or-design/analysis-web-v1.md)
- [Web V1 PRD](./product-or-design/prd-web-v1.md)
- [Web V1 UI 规格](./product-or-design/ui-spec-web-v1.md)
- [Web V1 技术设计（现状基线 + 演进建议）](./development/technical-design-web-v1.md)
- [Web V1 WBS](./development/wbs-web-v1.md)
- [Web V1 里程碑](./development/milestones-web-v1.md)
- [M1 实现计划](./development/implementation-plan-m1.md)
- [M1 检查清单](./development/implementation-checklist-m1.md)

### 实现现状（Implementation Facts）

- [模块实现文档入口（代码事实）](./development/30-modules/README.md)
- [Tuner 当前实现文档](./development/30-modules/tuner-implementation-current.md)
- [Audio and Detection Current](./development/30-modules/audio-and-detection-current.md)
- [UI and Interaction Current](./development/30-modules/ui-and-interaction-current.md)
- [Type Contracts Current](./development/30-modules/type-contracts-current.md)

### 测试与验证（Test / Validation）

- [Web V1 测试计划（基于当前代码实现）](./development/test-plan-web-v1.md)

### Architecture Decision Records

- [ADR 0001](./adr/0001-web-v1-scope.md)
- [ADR 0002](./adr/0002-browser-audio-local-first.md)
- [ADR 0003](./adr/0003-audioworklet-preferred-architecture.md)
- [ADR 0004](./adr/0004-yin-as-default-pitch-detection-candidate.md)
- [ADR 0005](./adr/0005-auto-target-string-for-v1.md)

### 工程运维（Engineering / Operations）

- [GitHub 安全部署手册](./operations/deploy.md)
- [部署交接说明（当前状态）](./operations/handover-deployment-status.md)
- [Git 工具与提交提示文档](./operations/git.md)
- [当前阶段技能结论](./_meta/skills-for-this-stage.md)

### 元信息与治理（Meta / Governance）

- [文档索引（兼容入口）](./_meta/docs-index-legacy.md)
- [链接索引表（增量校验基线）](./_meta/link-index.json)
- [代码到文档映射表](./_meta/code-to-docs-map.md)
- [开发 Agent 文档契约](./_meta/docs-contract.md)
- 索引生成脚本：`scripts/generate_docs_link_index.py`
- [结构合规审计](./_meta/docs-structure-audit-2026-04-13.md)
- [路径映射与迁移计划](./_meta/docs-path-mapping-and-migration-plan-2026-04-13.md)
- [备份快照说明](./_backup/2026-04-13/README.md)

## 迁移约束（防破链）

- 未完成“路径映射 + 批量修链 + 校验”前，不得移动现有文档路径。
- 目录迁移采用分批策略，每批必须保证入口可用。
