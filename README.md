# Kaven CLI

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/badge/version-0.2.0--alpha.1-orange.svg)](https://semver.org)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

The official command-line tool for the **Kaven** SaaS boilerplate ecosystem.
Bootstrap projects, manage modules, and interact with the Kaven Marketplace.

> **Alpha**: APIs and commands are subject to change before v1.0.0.

---

## Installation

```bash
npm install -g kaven-cli@alpha
# or
pnpm add -g kaven-cli@alpha
```

**Requirements:** Node.js >= 20, pnpm (for `kaven init`)

---

## Quick Start

Five commands to get productive with Kaven:

```bash
# 1. Bootstrap a new project
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
  --defaults       Skip interactive prompts and use default values
  --skip-install   Skip running pnpm install after setup
  --skip-git       Skip git init and initial commit
  --force          Overwrite existing directory

Examples:
  kaven init my-app
  kaven init my-app --defaults
  kaven init my-app --skip-git --skip-install
```

### `kaven auth`

Manage authentication and session tokens.

```
Commands:
  login    Start device code authentication flow (RFC 8628)
  logout   Clear the local authentication session
  whoami   Display info about the authenticated user
```

### `kaven marketplace`

Explore and install modules from the Kaven Marketplace.

```
Commands:
  list      List available modules
  install   Install a module
  browse    Interactive TUI module browser

Options for list:
  --category <cat>   Filter by category
  --sort <field>     Sort: newest (default), popular, name
  --page <n>         Page number
  --limit <n>        Results per page (max: 100)
  --json             Output raw JSON

Options for install:
  --version <ver>    Install specific version
  --force            Skip overwrite confirmation
  --skip-env         Skip .env injection
  --env-file <path>  Target .env file
```

### `kaven module`

Manage installed modules.

```
Commands:
  doctor    Run health checks on the project and modules
  add       Install a module from a local manifest
  remove    Remove an installed module
  publish   Publish a module to the marketplace

Options for doctor:
  --fix    Auto-fix detected issues (pnpm install, prisma generate, env vars)
  --json   Output machine-readable JSON

Exit codes for doctor:
  0   All checks passed
  1   One or more errors found
  2   Warnings only (no errors)

Options for publish:
  --dry-run          Validate and package without uploading
  --changelog <text> Release notes for this version
```

### `kaven upgrade`

Upgrade your Kaven license tier via Paddle checkout.

```
Options:
  --no-browser   Print checkout URL instead of opening browser

Behavior:
  - Opens a Paddle checkout in your browser
  - Polls for payment confirmation (every 5s, max 10 min)
  - Updates local license on success
```

### `kaven license`

Manage your Kaven license.

```
Commands:
  status   Show current license status and tier
```

### `kaven cache`

Manage the local API response cache (~/.kaven/cache, max 50 MB).

```
Commands:
  status   Show cache statistics (size, entries, age)
  clear    Delete all cached data

Cache TTLs:
  Module listings:   24 hours
  Module manifests:  7 days
  License status:    1 hour
```

### `kaven telemetry`

View observability and audit logs.

```
Commands:
  view   Display the most recent local telemetry events
         -l, --limit <n>   Number of events to show (default: 10)
```

---

## Configuration

Kaven CLI stores configuration in `~/.kaven/`:

```
~/.kaven/
  auth.json        Authentication tokens (chmod 600)
  config.json      CLI configuration (apiUrl override)
  license.json     License key and tier
  signing-key.json Module signing key pair (chmod 600)
  cache/           API response cache (max 50 MB)
  telemetry.log    Local telemetry events
```

### Overriding the API URL

Set `KAVEN_API_URL` environment variable or add to `~/.kaven/config.json`:

```json
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
KAVEN_OFFLINE=1 kaven marketplace list   # Uses cached data only
```

---

## Troubleshooting

### "Not authenticated" error

Run `kaven auth login` and complete the device code flow in your browser.

### "module.json not found" on publish

Run `kaven module publish` from inside the module directory
(the directory containing `module.json`).

### pnpm install fails on kaven init

Install pnpm globally: `npm install -g pnpm`
Or use `kaven init --skip-install` and run `pnpm install` manually.

### Prisma client out of sync

Run `kaven module doctor --fix` or manually: `npx prisma generate`

### Cache issues

Clear the cache: `kaven cache clear`

### Permission denied on ~/.kaven/

```bash
chmod 700 ~/.kaven
chmod 600 ~/.kaven/auth.json
```

---

## Development

```bash
git clone https://github.com/kaven-co/kaven-cli
cd kaven-cli
pnpm install          # or: npm install (with legacy-peer-deps)
pnpm test             # Run test suite
pnpm run typecheck    # TypeScript check
pnpm run lint         # ESLint
```

---

## License

Apache 2.0 — see [LICENSE](LICENSE)

---

Documentation: https://docs.kaven.sh/cli
GitHub: https://github.com/kaven-co/kaven-cli
