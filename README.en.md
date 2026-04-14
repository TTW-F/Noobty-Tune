# Noobty Tune (English)

<p align="center">
  <a href="./README.md">README Gateway</a> ·
  <a href="./README.zh-CN.md">中文</a>
</p>

Noobty Tune is a local-first, browser-based tuner focused on low-latency pitch feedback and maintainable engineering practices.

## TL;DR

- **What it is**: A web tuner for fast tuning workflows and Web Audio experimentation
- **Current stage**: Web V1 (actively iterating)
- **Core strengths**: local processing, real-time feedback, ADR/Codemap-backed documentation
- **Tech stack**: React, TypeScript, Vite, Web Audio API

## Highlights

- **Local-first audio pipeline**: process audio in browser when possible
- **Fast feedback loop**: optimized for practical tuning interaction
- **Engineering-ready docs**: ADRs, codemaps, and implementation notes
- **Incremental evolution**: architecture and docs evolve with code facts

## Quick Start

### Requirements

- Node.js 18+ (LTS recommended)
- npm 9+
- A modern browser with Web Audio API support

### Install and Run

```bash
npm install
npm run dev
```

Open the local Vite URL, allow microphone access, and start tuning.

### Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Useful Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run test:typecheck
npm run lint
npm run docs:index
npm run docs:codemap
npm run docs:codemap:legacy
npm run docs:sync
```

## Documentation

- Docs Hub: [`docs/README.md`](./docs/README.md)
- Codemap (canonical): [`docs/development/00-overview/codemaps/INDEX.md`](./docs/development/00-overview/codemaps/INDEX.md)
- ADRs: [`docs/adr/`](./docs/adr/)
- Module implementation docs: [`docs/development/30-modules/README.md`](./docs/development/30-modules/README.md)

## Feedback and Contribution

- Suggest features via Issues
- Report bugs with browser/device info and reproduction steps
- For architecture-related changes, update ADRs accordingly

## Maintenance Boundary

This file is for GitHub presentation and is not part of daily internal documentation governance.  
Daily documentation maintenance and gates are managed under the `docs/` tree.
