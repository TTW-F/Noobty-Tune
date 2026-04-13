# Docs Contract

面向开发 Agent 的最小文档契约（低污染）。

1. 主入口固定为 `docs/README.md`。
2. Canonical 目录：`docs/product-or-design/`、`docs/development/`、`docs/operations/`、`docs/_meta/`、`docs/adr/`。
3. `docs/_backup/` 仅用于归档，不作为默认引用目标。
4. 涉及文档路径变更时，必须先更新映射，再执行 `npm run docs:index`。
5. 提交前必须保证活跃文档链接可达（至少跑一次全量校验）。
6. 不确定是否应迁移路径时，先提交评估与映射，不直接移动文件。
7. `doc-updater` 负责生成/刷新文档；`documentation-maintainer` 负责门禁与最终验收。
8. 建议顺序：先 `doc-updater`，后 `documentation-maintainer`；冲突时以后者规则为准。
9. Codemap 的 Canonical 路径采用分层目录 `docs/development/00-overview/codemaps/`，`docs/CODEMAPS/` 仅可作为兼容镜像。
10. Codemap 必须按多级目录分片；单页超过 700 行强制拆分，且每级目录必须提供 `INDEX.md` 导航页。
11. Codemap 生成默认启用自动分片：领域 -> 子系统 -> 能力点；叶子页建议 150-350 行，超过 400 行继续拆分。
