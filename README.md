# Kaven CLI

> 📖 Portuguese Version: [README.pt-BR.md](./README.pt-BR.md)

[![npm version](https://img.shields.io/npm/v/kaven-cli/alpha.svg)](https://www.npmjs.com/package/kaven-cli)
[![npm downloads](https://img.shields.io/npm/dm/kaven-cli.svg)](https://www.npmjs.com/package/kaven-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![Build Status](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml)
[![Pure ESM](https://img.shields.io/badge/module-Pure%20ESM-yellow.svg)](https://nodejs.org/api/esm.html)

**Kaven CLI** is the central orchestrator for the [Kaven Framework](https://kaven.site). It automates the entire lifecycle of a high-performance SaaS boilerplate, from initial scaffolding and Prisma schema orchestration to marketplace module installation and advanced capability management.

Built for precision and speed, it is now a **Pure ESM** tool optimized for modern Node.js environments.

---

## Table of Contents

- [Core Principles](#core-principles)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Command Reference](#command-reference)
  - [Project Initialization (`init`)](#project-initialization-init)
  - [Schema Activation Engine (`module`)](#schema-activation-engine-module)
  - [Feature Flags & Capabilities (`config features`)](#feature-flags--capabilities-config-features)
  - [Marketplace Integration](#marketplace-integration)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [Schema Activation Logic](#schema-activation-logic)
  - [AIOX Squad Integration](#aiox-squad-integration)
- [Configuration & Environment](#configuration--environment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Core Principles

- **Pristine Scaffolding**: No more cluttered boilerplates. Kaven starts lean and grows as you add modules.
- **Transactional Integrity**: The CLI uses a `TransactionalFileSystem` to ensure that failed installations or migrations never leave your project in a broken state.
- **Agent-Ready**: Native support for **AIOX Squads**, providing a team of specialized AI agents to help build your product.
- **Type Safety**: Built with strict TypeScript, providing a reliable developer experience.

---

## Installation

### Global Install (Recommended)

```bash
npm install -g kaven-cli@alpha
# or
pnpm add -g kaven-cli@alpha
```

### Requirements
- **Node.js**: >= 22.0.0 (Pure ESM support required)
- **PackageManager**: `pnpm` is highly recommended and required for certain internal tasks.
- **Git**: Installed and configured.

---

## Quick Start

```bash
# 1. Bootstrap a new project with AI Squad support
kaven init my-unicorn-startup --with-squad

# 2. Login to Kaven Marketplace
kaven auth login

# 3. Choose your SaaS tier and features (Interactive TUI)
kaven config features

# 4. Activate the Billing module in your schema
kaven module activate billing

# 5. Verify project health
kaven module doctor
```

---

## Command Reference

### Project Initialization (`init`)

The `init` command clones the official [Kaven Template](https://github.com/kaven-co/kaven-template) and prepares the project environment.

```bash
kaven init [project-name] [options]
```

**Options:**
- `--with-squad`: Bootstraps the AIOX agent infrastructure in `squads/kaven-squad/`.
- `--template <path|url>`: Use a custom local directory or Git repository as the source.
- `--force`: Overwrite existing directory if it exists.
- `--skip-install`: Skip the automatic `pnpm install`.
- `--skip-git`: Skip `git init` and initial commit.

---

### Schema Activation Engine (`module`)

Kaven's **Schema Activation Engine** solves the "Boilerplate Bloat" problem. Instead of having dozens of inactive tables in your database, Kaven keeps modules commented out in your Prisma schema until you need them.

```bash
# List all available modules and their status
kaven module list

# Activate a module (uncomments Prisma models)
kaven module activate billing

# Deactivate a module (comments Prisma models)
kaven module deactivate billing

# Verify module integrity and database sync
kaven module doctor --fix
```

---

### Feature Flags & Capabilities (`config features`)

Kaven Framework supports over **60+ granular capabilities** (feature flags) that control everything from UI visibility to API limits.

```bash
kaven config features [options]
```

This command launches an **Interactive TUI** where you can:
- Select a **Tier Preset** (Starter, Complete, Pro, Enterprise).
- Customize individual flags (e.g., `TENANCY_CUSTOM_DOMAINS`, `MAX_PROJECTS`).
- Automatically generate the `packages/database/prisma/seeds/capabilities.seed.ts` file.

---

### Marketplace Integration

The `marketplace` command set allows you to extend your SaaS with official and community modules.

```bash
# Browse modules in a visual TUI
kaven marketplace browse

# Install a specific module
kaven marketplace install auth-google

# List available categories
kaven marketplace list --category auth
```

---

## Architecture Deep Dive

### Schema Activation Logic

The `SchemaActivator` core targets the `packages/database/prisma/schema.extended.prisma` file. It uses a robust marker system:

```prisma
// [KAVEN_MODULE:BILLING BEGIN]
// model Invoice {
//   id        String   @id @default(cuid())
//   ...
// }
// [KAVEN_MODULE:BILLING END]
```

When `activate billing` is called, the CLI:
1. Validates **Marker Pairing** (BEGIN/END integrity).
2. Performs a **Regex-based uncommenting** that preserves your code's indentation.
3. Notifies the developer to run `pnpm db:generate && pnpm db:migrate`.

### AIOX Squad Integration

By passing `--with-squad` during `init`, the CLI:
1. Injects the `.gemini/` and `.antigravity/` configurations.
2. Sets up the specialized agents: **Kai** (Orchestrator), **Dex** (Developer), **Quinn** (QA), and **Gage** (DevOps).
3. Configures the repository for an AI-native development workflow.

---

## Configuration & Environment

All CLI state and cached marketplace data reside in `~/.kaven/`:

- `auth.json`: JWT tokens for marketplace access.
- `config.json`: CLI preferences (e.g., `apiUrl`, `serviceToken`).
- `license.json`: Local cache of your framework license.
- `cache/`: Cached API responses to speed up browsing.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `KAVEN_API_URL` | Override the production marketplace URL. |
| `KAVEN_DEBUG=1` | Enable detailed logging of HTTP and FS operations. |
| `KAVEN_SERVICE_TOKEN` | Token for automated CI/CD or Agent-to-Service auth. |
| `KAVEN_OFFLINE=1` | Force the CLI to use local cache only. |

---

## Troubleshooting

### "ReferenceError: module is not defined"
Kaven CLI is **Pure ESM**. If you are trying to extend the CLI or run it in an environment that expects CommonJS, ensure your `package.json` contains `"type": "module"` and you are using Node.js 22+.

### "Marker Pairing Failed"
This error occurs if you manually edited the Prisma file and deleted or duplicated a `// [KAVEN_MODULE:...]` marker. Run `kaven module doctor` to identify the broken section.

### "Not Authenticated"
Run `kaven auth login`. If you are in a CI/CD environment, provide a `KAVEN_SERVICE_TOKEN` via environment variables.

---

## Contributing

We welcome contributions! Kaven CLI is a high-integrity project with strict quality gates.

### Development Setup

```bash
# 1. Clone and install
git clone https://github.com/kaven-co/kaven-cli
cd kaven-cli
pnpm install

# 2. Run the full test suite (318+ tests)
pnpm test

# 3. Run linting and type-checking
pnpm run lint
pnpm run typecheck

# 4. Build the Pure ESM bundle
pnpm run build
```

### Commit Guidelines
We use **Conventional Commits**. Every commit must be prefixed with `feat:`, `fix:`, `docs:`, etc. Breaking changes must be flagged.

### Quality Gates
- **Tests**: 100% pass rate required.
- **Lint**: No `any` allowed in core modules.
- **ESM**: All relative imports must include the `.js` extension.

---

## Credits & Attribution

Kaven CLI is built with support from the **AIOX Framework**, an agentic development ecosystem by [SynkraAI](https://github.com/synkra). 

Special thanks to the **Kaven Squad** of autonomous agents who helped architect, develop, and validate this tool:
- **Kai** (Orchestrator)
- **Dex** (Developer)
- **Quinn** (QA)
- **Gage** (DevOps)

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

**Documentation**: [docs.kaven.site/cli](https://docs.kaven.site/cli)  
**GitHub**: [github.com/kaven-co/kaven-cli](https://github.com/kaven-co/kaven-cli)  
**NPM**: [npmjs.com/package/kaven-cli](https://www.npmjs.com/package/kaven-cli)
