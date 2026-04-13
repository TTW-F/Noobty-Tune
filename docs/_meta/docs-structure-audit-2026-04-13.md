# Docs 结构合规审计（2026-04-13）

## 审计范围

- 路径：`docs/`
- 对照标准：`documentation-maintainer` skill 的分层、入口、校验与治理规则

## 总体结论

- 结论：**已基本符合（持续优化中）**
- 现状：核心分层目录已落地，主入口与链接治理机制已建立，进入持续巡检阶段

## 合规项（已满足）

- 存在 ADR 子目录（`docs/adr/`）
- 主入口已统一为 `docs/README.md`
- 兼容索引已迁移到 `_meta`（`docs/_meta/docs-index-legacy.md`）
- 主要文档间链接当前可达
- 已有链接索引基线（`docs/_meta/link-index.json`）
- 已建立归档目录（`docs/_backup/`）并执行旧文件归档

## 持续优化项

1. `docs/_meta/link-index.json` 当前覆盖深度有限，建议扩展为全量文档图谱
2. 归档目录应定期清理并记录保留周期
3. 建议增加自动化链接校验脚本并接入 CI

## 风险评估

- 立即重构目录会带来批量相对链接失效风险
- 在未建立“路径映射 + 全量校验”机制前，不建议直接移动文件

## 建议治理顺序（后续）

1. 扩展链接索引：从基线索引升级为全量索引
2. 自动化校验：将全量链接校验纳入常规检查
3. 归档治理：补充归档保留周期与清理策略

## 本次动作

- 新增并启用主入口：`docs/README.md`
- 迁移并收口索引：`docs/_meta/docs-index-legacy.md`
- 落地分层目录：`product-or-design/`、`development/`、`operations/`、`_meta/`
- 落地归档目录：`docs/_backup/2026-04-13/`
- 落地索引基线：`docs/_meta/link-index.json`
