# Noobty Tune

<p align="center">
  <strong>Browser-based, local-first tuner for fast and clear pitch feedback.</strong>
</p>

<p align="center">
  <a href="https://github.com/TTW-F/Noobty-Tune/actions/workflows/deploy.yml">
    <img alt="CI" src="https://github.com/TTW-F/Noobty-Tune/actions/workflows/deploy.yml/badge.svg">
  </a>
  <a href="https://github.com/TTW-F/Noobty-Tune/releases">
    <img alt="Release" src="https://img.shields.io/github/v/release/TTW-F/Noobty-Tune?display_name=tag">
  </a>
  <a href="https://github.com/TTW-F/Noobty-Tune/commits/main/">
    <img alt="Last Commit" src="https://img.shields.io/github/last-commit/TTW-F/Noobty-Tune/main">
  </a>
  <a href="https://github.com/TTW-F/Noobty-Tune/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/TTW-F/Noobty-Tune">
  </a>
  <a href="https://github.com/TTW-F/Noobty-Tune/stargazers">
    <img alt="Stars" src="https://img.shields.io/github/stars/TTW-F/Noobty-Tune?style=social">
  </a>
</p>

<p align="center">
  <a href="https://tune.noobty.top"><strong>Live Demo</strong></a> ·
  <a href="./docs/README.md"><strong>Docs Hub</strong></a> ·
  <a href="https://github.com/TTW-F/Noobty-Tune/issues"><strong>Report Issue</strong></a>
</p>

Noobty Tune 是一个面向浏览器的调音器项目，专注于：
- 低延迟音高检测反馈
- 本地优先音频处理
- 可演进的工程结构与文档体系

---

## TL;DR

- **定位**：一个本地优先的 Web 调音器工程项目
- **目标用户**：需要快速调音的普通用户 + 关注 Web Audio 的开发者
- **当前阶段**：Web V1（持续迭代）
- **核心承诺**：低延迟反馈、可追踪文档、可演进架构

## English Summary

Noobty Tune is a local-first, browser-based tuner focused on low-latency pitch feedback and maintainable engineering practices.

- **What it is**: A Web tuner for fast tuning workflows and Web Audio experimentation
- **Current stage**: Web V1 (actively iterating)
- **Core strengths**: local processing, real-time feedback, ADR/Codemap-backed documentation
- **Tech stack**: React, TypeScript, Vite, Web Audio API

### Quick Start (EN)

```bash
npm install
npm run dev
```

Open the local Vite URL, allow microphone access, and start tuning.

### Key Links (EN)

- Live Demo: <https://tune.noobty.top>
- Docs Hub: <https://github.com/TTW-F/Noobty-Tune/tree/main/docs>
- ADRs: <https://github.com/TTW-F/Noobty-Tune/tree/main/docs/adr>
- Issues: <https://github.com/TTW-F/Noobty-Tune/issues>

## 目录

- [核心亮点](#核心亮点)
- [TL;DR](#tldr)
- [60 秒快速体验](#60-秒快速体验)
- [项目状态](#项目状态)
- [体验路径（首次访问建议）](#体验路径首次访问建议)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [文档导航](#文档导航)
- [FAQ](#faq)
- [路线图（Roadmap）](#路线图roadmap)
- [Contributing](#contributing)
- [维护边界（重要）](#维护边界重要)

## 核心亮点

- **打开即用**：浏览器内运行，无需安装本地客户端
- **本地优先**：音频处理尽量在本机完成，降低网络依赖
- **实时反馈**：围绕调音场景优化检测链路与交互反馈
- **工程化文档**：ADR + Codemap + 模块实现文档，便于协作和长期维护

## 60 秒快速体验

```bash
npm install && npm run dev
```

1. 打开本地开发地址（Vite 输出的 URL）
2. 允许浏览器使用麦克风
3. 发出稳定单音（建议安静环境）
4. 观察调音反馈并调整音高

## 项目状态

- 当前阶段：**Web V1（持续迭代中）**
- 可用范围：开发与验证环境可用，适合功能验证与体验改进
- 说明：API 与交互细节可能随迭代调整，以 `docs/` 文档和提交记录为准

## 体验路径（首次访问建议）

1. 先点顶部 `Live Demo` 快速感受交互
2. 想看实现依据：进入 `Docs Hub`
3. 想参与改进：通过 `Report Issue` 提交问题或建议

## 在线演示与截图

当前仓库未内置公开演示地址与正式截图资源。  
可先按下方步骤本地运行，后续可在 `public/` 补充 `screenshot.png` 或 `demo.gif` 进行展示。

## 快速开始

### 环境要求

- Node.js 18+（建议 LTS）
- npm 9+
- 支持 Web Audio API 的现代浏览器（Chrome/Edge/Firefox/Safari 新版本）

### 安装与启动

```bash
npm install
npm run dev
```

启动后按 Vite 控制台提示打开本地地址即可体验。

### 质量检查

```bash
npm run lint
npm run test
npm run build
```

## 常用命令

```bash
npm run dev                 # 启动开发环境
npm run build               # 构建生产版本
npm run preview             # 本地预览构建产物
npm run test                # 运行测试
npm run test:typecheck      # 测试类型检查
npm run lint                # ESLint 检查
npm run docs:index          # 生成文档链接索引
npm run docs:codemap        # 生成分层 codemap
npm run docs:codemap:legacy # 生成 legacy codemap 镜像
npm run docs:sync           # 文档同步
```

## 文档导航

- 文档总入口：[`docs/README.md`](./docs/README.md)
- Codemap（Canonical）：[`docs/development/00-overview/codemaps/INDEX.md`](./docs/development/00-overview/codemaps/INDEX.md)
- ADR（架构决策）：[`docs/adr/`](./docs/adr/)
- 模块实现现状：[`docs/development/30-modules/README.md`](./docs/development/30-modules/README.md)

## 项目结构（概览）

```text
.
├─ src/        # 应用源码（UI、音频处理、类型与业务逻辑）
├─ docs/       # 项目文档体系（设计、实现、治理、ADR）
├─ scripts/    # 自动化脚本（文档索引、同步等）
├─ public/     # 静态资源
└─ dist/       # 构建产物
```

## 适用场景

- 个人日常调音（吉他/弦乐基础场景）
- Web Audio API 学习与实验项目
- 调音器交互与音高检测算法的工程化验证基线

## FAQ

### 1) 为什么没有声音输入？

- 请确认浏览器已授予麦克风权限
- 请检查系统层面的输入设备是否正确
- 请使用 HTTPS 或 `localhost` 环境进行本地开发测试

### 2) 为什么反馈有延迟或抖动？

- 录音环境噪声会影响检测稳定性
- 输入音量过低或过高都会降低识别质量
- 不同浏览器/设备在 Web Audio 实现上存在差异

### 3) 这和 `docs/` 下文档是什么关系？

- 根目录 `README.md`：GitHub 首页门面（对外展示）
- `docs/`：项目内部文档体系（事实维护、治理、追踪）

## 路线图（Roadmap）

- 提升音高检测稳定性与噪声环境适应性
- 扩展更多调音模式与目标音策略
- 增强关键链路自动化验证与测试覆盖
- 持续完善代码事实到文档的增量同步机制

## 支持与反馈

- 功能建议：创建 Issue 描述使用场景与预期行为
- 问题反馈：附上浏览器版本、设备信息、复现步骤、控制台日志
- 架构讨论：建议关联对应 ADR 或新增 ADR 草案

## Contributing

欢迎通过 Issue / PR 参与贡献。提交前建议执行：

```bash
npm run lint
npm run test
npm run build
```

如改动涉及架构、模块边界或行为语义，请同步更新 ADR 或对应实现文档。

## 维护边界（重要）

本 `README.md` 仅用于 GitHub 仓库首页展示，不纳入项目日常文档维护治理流程。  
项目日常文档维护、增量同步与门禁验收以 `docs/` 目录文档体系为准。
