# Docs Contract

面向开发 Agent 的最小文档契约（低污染）。

1. 主入口固定为 `docs/README.md`。
2. Canonical 目录：`docs/product-or-design/`、`docs/development/`、`docs/operations/`、`docs/_meta/`、`docs/adr/`。
3. `docs/_backup/` 仅用于归档，不作为默认引用目标。
4. 涉及文档路径变更时，必须先更新映射，再执行 `npm run docs:index`。
5. 提交前必须保证活跃文档链接可达（至少跑一次全量校验）。
6. 不确定是否应迁移路径时，先提交评估与映射，不直接移动文件。
