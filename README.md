# Kaven CLI

> 📖 Versão em Português: [README.pt-BR.md](./README.pt-BR.md)

[![npm version](https://img.shields.io/npm/v/kaven-cli/alpha.svg)](https://www.npmjs.com/package/kaven-cli)
[![npm downloads](https://img.shields.io/npm/dm/kaven-cli.svg)](https://www.npmjs.com/package/kaven-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![CI](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml)

The official command-line tool for the [Kaven](https://kaven.site) SaaS boilerplate framework.
Bootstrap projects, manage modules, and interact with the Kaven Marketplace — all from your terminal.

> **Alpha:** APIs and commands may change before v1.0.0.

---

## Installation

```bash
npm install -g kaven-cli@alpha
# or
pnpm add -g kaven-cli@alpha
```

**Requirements:** Node.js >= 20, pnpm (required by `kaven init`)

---

## Quick Start

```bash
# 1. Bootstrap a new Kaven project
kaven init my-saas-app

# 2. Authenticate with the marketplace
kaven auth login

# 3. Browse available modules
kaven marketplace browse

# 4. Install a module
kaven marketplace install payments

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
  --with-squad     Initialize AIOX squad in the project

Examples:
  kaven init my-app
  kaven init my-app --defaults
  kaven init my-app --skip-git --skip-install
```

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

Options (list):
  --category <cat>   Filter by category
  --sort <field>     newest (default) | popular | name
  --page <n>         Page number
  --limit <n>        Results per page (max 100)
  --json             Raw JSON output

Options (install):
  --version <ver>    Install a specific version
  --force            Skip overwrite confirmation
  --skip-env         Skip .env injection
  --env-file <path>  Target .env file path
```

---

### `kaven module`

Manage modules installed in the current project.

```
Commands:
  doctor    Run health checks on the project and installed modules
  add       Install a module from a local manifest
  remove    Uninstall an installed module
  publish   Publish a module to the marketplace

Options (doctor):
  --fix    Auto-fix detected issues (runs pnpm install, prisma generate, patches env)
  --json   Machine-readable JSON output

Exit codes (doctor):
  0   All checks passed
  1   One or more errors
  2   Warnings only

Options (publish):
  --dry-run          Validate and package without uploading
  --changelog <msg>  Release notes for this version
```

> `kaven doctor` is an alias for `kaven module doctor`.

---

### `kaven upgrade`

Upgrade your license tier via Paddle checkout.

```
Options:
  --no-browser   Print checkout URL instead of opening browser

Behavior:
  Opens Paddle checkout in browser → polls for payment (every 5s, max 10 min)
  → updates local license on success
```

---

### `kaven license`

```
Commands:
  status   Show current license tier and expiry
```

---

### `kaven cache`

Manage the local API response cache (`~/.kaven/cache`, max 50 MB).

```
Commands:
  status   Show cache stats (size, entries, age)
  clear    Delete all cached data

Cache TTLs:
  Module listings    24 hours
  Module manifests   7 days
  License status     1 hour
```

---

### `kaven telemetry`

```
Commands:
  view   Show recent local telemetry events
         -l, --limit <n>   Number of events (default: 10)
```

---

### `kaven config`

```
Commands:
  set <key> <value>   Set a configuration value
  get <key>           Get a configuration value
```

---

### `kaven init-ci`

Initialize CI/CD configuration in the current project. Generates GitHub Actions workflows tailored for Kaven projects.

---

## Configuration

All configuration lives in `~/.kaven/`:

```
~/.kaven/
  auth.json         Authentication tokens         (chmod 600)
  config.json       CLI configuration
  license.json      License key and tier
  signing-key.json  Module Ed25519 signing key    (chmod 600)
  cache/            API response cache            (max 50 MB)
  telemetry.log     Local telemetry events
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `KAVEN_API_URL` | Override the marketplace API URL |
| `KAVEN_DEBUG=1` | Enable verbose debug output |
| `KAVEN_OFFLINE=1` | Use cached data only, no network requests |
| `KAVEN_TELEMETRY=0` | Disable telemetry entirely |

### API URL Override (config file)

```json
// ~/.kaven/config.json
{
  "apiUrl": "https://api.your-kaven-instance.com"
}
```

### Debug Mode

```bash
KAVEN_DEBUG=1 kaven marketplace list
```

### Offline Mode

```bash
KAVEN_OFFLINE=1 kaven marketplace list
```

---

## Troubleshooting

**"Not authenticated" error**
```bash
kaven auth login
```

**"module.json not found" on publish**

Run `kaven module publish` from inside the module directory (the one containing `module.json`).

**pnpm install fails on `kaven init`**
```bash
npm install -g pnpm          # install pnpm globally
# or skip it and install later:
kaven init my-app --skip-install
cd my-app && pnpm install
```

**Prisma client out of sync**
```bash
kaven module doctor --fix
# or manually:
npx prisma generate
```

**Cache issues**
```bash
kaven cache clear
```

**Permission denied on `~/.kaven/`**
```bash
chmod 700 ~/.kaven
chmod 600 ~/.kaven/auth.json ~/.kaven/signing-key.json
```

---

## Contributing

```bash
git clone https://github.com/kaven-co/kaven-cli
cd kaven-cli
pnpm install
pnpm test           # 310 tests
pnpm run typecheck
pnpm run lint
```

**Commit convention:** this repo uses [Conventional Commits](https://www.conventionalcommits.org/).

```bash
feat: add --with-squad flag to kaven init
fix: resolve cache corruption on concurrent writes
docs: update troubleshooting section
```

**Release flow:**
1. Open a PR against `main`
2. PR requires CI green (lint + typecheck + tests + build)
3. Merge → Semantic Release automatically bumps version and publishes to npm (`@alpha` tag)

Types that trigger a release: `feat` (minor), `fix` / `perf` / `refactor` (patch), `BREAKING CHANGE` (major).
Types that do **not** trigger a release: `chore`, `docs`, `test`, `style`, `ci`.

See [`docs/releasing.md`](./docs/releasing.md) for the full release pipeline documentation.

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

Documentation: https://docs.kaven.site/cli
GitHub: https://github.com/kaven-co/kaven-cli
npm: https://www.npmjs.com/package/kaven-cli
