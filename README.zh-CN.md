# Noobty Tune（中文）

<p align="center">
  <a href="./README.md">README 入口</a> ·
  <a href="./README.en.md">English</a>
</p>

Noobty Tune 是一个面向浏览器的本地优先调音器（Web Tuner），专注低延迟音高检测反馈与可持续工程化演进。

## TL;DR

- **定位**：本地优先（Local-first）的 Web 调音器工程项目
- **当前阶段**：Web V1（持续迭代）
- **核心价值**：低延迟反馈、可追踪文档、可演进架构
- **适合人群**：调音用户、Web Audio 学习者、前端工程实践者

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

## FAQ

### 为什么没有声音输入？

- 请确认浏览器已授予麦克风权限
- 请检查系统层面的输入设备是否正确
- 请使用 HTTPS 或 `localhost` 环境进行本地开发测试

### 为什么反馈有延迟或抖动？

- 录音环境噪声会影响检测稳定性
- 输入音量过低或过高都会降低识别质量
- 不同浏览器/设备在 Web Audio 实现上存在差异

## 支持与反馈

- 功能建议：创建 Issue 描述使用场景与预期行为
- 问题反馈：附上浏览器版本、设备信息、复现步骤、控制台日志
- 架构讨论：建议关联对应 ADR 或新增 ADR 草案

## 维护边界（重要）

本文件用于 GitHub 展示，不纳入项目日常文档治理流程。  
项目日常文档维护、增量同步与门禁验收以 `docs/` 目录文档体系为准。
