# Amdox ERP

Amdox ERP is a production-grade, highly scalable enterprise resource planning (ERP) system constructed on a lightweight, modular monorepo architecture. This repository contains the core foundation of the application, prioritizing strict development disciplines, zero-overhead setups, and high-performance development workflows.

## Architecture & Design

The project uses a **Modular Monorepo** design orchestrated by **Turborepo** and **pnpm workspaces**. It decouples application layers and configuration setups to enable autonomous development of backend and frontend components.

### Folder Structure
```text
amdox-erp/
├── apps/
│   ├── web/          # Next.js 16 (App Router, Tailwind CSS v4, TypeScript)
│   └── backend/      # NestJS 11 (Strict mode TypeScript backend)
├── packages/
│   └── config/       # Centralized TypeScript and ESLint base configs
├── docs/             # High-level system architecture and module specifications
├── scripts/          # Workspace automation utilities and maintenance scripts
├── package.json      # Monorepo task pipelines and shared tools
├── pnpm-workspace.yaml# pnpm packages definition and script execution permissions
├── turbo.json        # Turborepo caching pipeline configuration
├── .gitignore        # Version control exclude patterns
├── .editorconfig     # Development formatting environment settings
└── README.md         # Foundation guide and startup instructions
```

## Workspace Explanation

- **`apps/web`**: A modern server-side rendered frontend using **Next.js** with App Router. The UI utilizes native CSS variables and **Tailwind CSS v4** without deprecated configurations.
- **`apps/backend`**: A scalable API server built with **NestJS**. The setup removes default placeholder controllers and services to expose a clean module startup structure.
- **`packages/config`**: Houses reusable build, styling, and compiler settings (such as base `tsconfig.json` and ESLint flat-file presets) to guarantee code-style compliance.

---

## Installation & Setup

Ensure you have [Node.js v24+](https://nodejs.org/) and [pnpm v11+](https://pnpm.io/) installed.

### Clone and Install Dependencies
To clone the repository and install all workspace packages:
```bash
# Install dependencies
pnpm install
```

---

## Workspace Commands

All developer lifecycle scripts are run from the monorepo root directory using `pnpm`.

### Run Development Servers
Starts Next.js and NestJS servers concurrently using Turborepo:
```bash
pnpm dev
```
- Next.js Web: `http://localhost:3000`
- NestJS API: `http://localhost:3001`

### Build Workspace
Compiles all apps and configuration packages inside the workspace:
```bash
pnpm build
```

### Code Quality (Linting)
Runs ESLint check across all workspace projects:
```bash
pnpm lint
```

### Code Formatting
Checks and formats code consistency using Prettier:
```bash
# Check code formatting status
pnpm format:check

# Format files inside the workspace
pnpm format
```
