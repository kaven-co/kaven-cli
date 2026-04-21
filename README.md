# Kaven CLI

> 📖 Versão em Português: [README.pt-BR.md](./README.pt-BR.md)

[![npm version](https://img.shields.io/npm/v/kaven-cli/alpha.svg)](https://www.npmjs.com/package/kaven-cli)
[![npm downloads](https://img.shields.io/npm/dm/kaven-cli.svg)](https://www.npmjs.com/package/kaven-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![CI](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml)

The official command-line tool for the [Kaven](https://kaven.site) SaaS boilerplate framework.
Bootstrap projects, manage modules, and orchestrate your application's schema and capabilities — all from your terminal.

> **Alpha:** APIs and commands may change before v1.0.0. This tool is now **Pure ESM**.

---

## Installation

```bash
npm install -g kaven-cli@alpha
# or
pnpm add -g kaven-cli@alpha
```

**Requirements:** Node.js >= 22 (Pure ESM support), pnpm (required by `kaven init`)

---

## Quick Start

```bash
# 1. Bootstrap a new Kaven project with AIOX agents
kaven init my-saas-app --with-squad

# 2. Authenticate with the marketplace
kaven auth login

# 3. Configure application capabilities (60+ flags)
kaven config features

# 4. Activate a module in your Prisma schema
kaven module activate billing

# 5. Check project health
kaven module doctor
```

---

## Command Reference

### `kaven init [project-name]`

Bootstrap a new Kaven project from the official template.

```
Options:
  --defaults       Skip interactive prompts, use defaults
  --skip-install   Skip pnpm install after setup
  --skip-git       Skip git init and initial commit
  --force          Overwrite existing directory
  --template <p>   Use a custom template path or Git URL
  --with-squad     Initialize AIOX squad (Kai, Dex, Quinn, Gage) in the project
```

---

### `kaven module` (The Core Engine)

Manage modules and orchestrate your Prisma schema.

```
Commands:
  list              List available schema modules and their activation status
  activate <name>   Uncomment module models in schema.extended.prisma
  deactivate <name> Comment out module models in schema.extended.prisma
  doctor            Run health checks on the project and installed modules
  add <path>        Install a module from a local manifest
  remove <name>     Uninstall an installed module
  publish           Publish a module to the marketplace

Options (doctor):
  --fix    Auto-fix detected issues (pnpm install, prisma generate, env patches)
```

**Schema Activation:** Kaven uses a unique "comment-based" activation system. When you run `kaven module activate`, the CLI programmatically uncomment blocks marked with `// [KAVEN_MODULE:BEGIN/END]` in your Prisma files, making them active for migrations.

---

### `kaven config features`

Kaven Framework supports **60+ capabilities** (feature flags). This command launches an interactive TUI to:
- Choose a tier (Starter, Complete, Pro, Enterprise).
- Customize individual boolean and numeric flags.
- Generate a `capabilities.seed.ts` for your database.

---

### `kaven auth`

Manage authentication with the Kaven Marketplace.

```
Commands:
  login    Start device code flow (RFC 8628) — opens browser to confirm
  logout   Clear the local session
  whoami   Display the authenticated user info
```

---

### `kaven marketplace`

Explore and install modules from the Kaven Marketplace.

```
Commands:
  list      List available modules
  install   Download and apply a module to the current project
  browse    Interactive TUI browser
```

---

## Architecture & Contributions

Kaven CLI is built with:
- **Runtime:** Node.js (Pure ESM)
- **Bundler:** `tsup` (esbuild based)
- **Testing:** `vitest` (318+ tests)
- **Logic:** `commander.js`, `inquirer`, `chalk`, `ora`

### Development

```bash
git clone https://github.com/kaven-co/kaven-cli
cd kaven-cli
pnpm install
pnpm test
pnpm run build
```

**Quality Gates:** We enforce 100% test pass rate, strict linting (no `any`), and type-checking before every commit.

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

Documentation: https://docs.kaven.site/cli
GitHub: https://github.com/kaven-co/kaven-cli
npm: https://www.npmjs.com/package/kaven-cli
