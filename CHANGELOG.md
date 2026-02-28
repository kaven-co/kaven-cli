# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] - 2026-02-28

### Fixed

- Ed25519 signature verification now accepts base64 signatures from marketplace API
- Marketplace public endpoints no longer require authentication (list, search)
- Download token request body matches marketplace API schema (`moduleSlug`/`version`)
- Release info endpoint corrected to `/modules/:slug/versions/:version`
- Relative download URLs resolved to absolute before fetching artifacts
- Tier display normalized from uppercase `requiredTier` API field
- Pagination reads from `meta` object in API response
- `latestVersion` fallback to `releases[]` array when null
- CLI publish command sends base64 signatures for consistency

### Security

- Resolve 4 Dependabot vulnerabilities (esbuild, brace-expansion, minimatch)

### Added

- **Ed25519 signature verification** on module download (`--skip-verify` flag)
- **Public key registration** on module publish
- **`kaven config` command**: get/set/view/reset CLI configuration
- **`kaven init-ci`**: CI/CD setup scaffolding
- **ErrorRecovery** core module for graceful error handling and retries
- **RegistryResolver** core module for multi-registry resolution
- **ConfigManager** core module for layered configuration
- **Upgrade check utility**: notifies when a newer CLI version is available

---

## [0.2.0-alpha.1] - 2026-02-17

### Added

**Sprint C2 — 8 stories, 71 new tests (215 total)**

- **C2.1 `kaven init`**: Bootstrap new Kaven projects from the official template
  - Clone `kaven-co/kaven-template` with `--depth 1` via git
  - Interactive prompts for DB URL, email provider, locale, and currency
  - Replace placeholders in package.json, .env.example, prisma/schema.prisma
  - Flags: `--defaults`, `--skip-install`, `--skip-git`, `--force`
  - Auto-runs `pnpm install` and `git init && git add . && git commit`
  - `ProjectInitializer` core class with validation logic

- **C2.2 `kaven module publish`**: Publish modules to Kaven Marketplace
  - Validates `module.json` with Zod schema (name, slug, version, tier, etc.)
  - Creates `.tar.gz` archive (excludes node_modules, .git, dist, .env, *.log)
  - SHA-256 checksum and Ed25519 signing (key at ~/.kaven/signing-key.json)
  - Presigned S3 upload URL, streaming upload with progress indicator
  - Flags: `--dry-run`, `--changelog <text>`

- **C2.3 `kaven upgrade`**: Tier upgrade via Paddle checkout
  - Requires authentication and valid local license
  - Shows tier comparison table and allows tier selection
  - Creates Paddle checkout session and opens browser automatically
  - Polls checkout status every 5s (max 10 min = 120 polls)
  - Handles: confirmed, cancelled, failed, timeout states
  - Flag: `--no-browser`

- **C2.4 Enhanced `kaven module doctor`**: 5 new health checks
  - Schema merge integrity: validates Prisma schemas for merge conflicts
  - Env completeness: compares `.env.example` vs `.env` keys
  - License validity: reads `~/.kaven/license.json`, checks expiry
  - Framework version compatibility: validates `@kaven/core` semver
  - Prisma client sync: checks if schema was modified after client generation
  - New `--json` flag for machine-readable output
  - Exit codes: 0=pass, 1=errors, 2=warnings only
  - Auto-fixes: `pnpm install`, `npx prisma generate`, missing env vars append

- **C2.5 `kaven marketplace browse`**: Interactive TUI module browser
  - Category selection step using `@inquirer/prompts` select
  - Paginated module list (10 per page) with tier color badges
  - Module detail view with install count and description
  - Navigation: back to categories, next/prev page, install action

- **C2.6 `CacheManager` + `kaven cache` commands**:
  - File-based cache at `~/.kaven/cache/` with JSON index
  - `get<T>()`, `getStale<T>()`, `set<T>()` with TTL, `evict()`, `stats()`, `clear()`
  - Auto-eviction of oldest entries when over 50 MB limit
  - `kaven cache status` and `kaven cache clear` subcommands

- **C2.7 CLI Documentation**:
  - Updated `README.md` with full command reference, quick start (5 commands),
    configuration, troubleshooting, and offline/debug mode docs
  - Created `CHANGELOG.md` (this file) in Keep a Changelog format
  - Rich `.addHelpText('after', ...)` examples on all commands
  - Version bumped from 0.1.0-alpha.1 to 0.2.0-alpha.1

- **C2.8 Test Suite**: 71 new tests (215 total across 28 test files)
  - `ProjectInitializer.test.ts` — name validation, dir removal, placeholder replacement
  - `module-publish.test.ts` — Zod schema validation for all moduleJson fields
  - `upgrade.test.ts` — polling states, timeout math, license file handling
  - `ModuleDoctor-enhanced.test.ts` — all 5 new check methods
  - `CacheManager.test.ts` — TTL, stale reads, eviction, stats, clear
  - `cache.test.ts` — cache status and clear command logic
  - `help-text.test.ts` — all commands have descriptions and options
  - `browse.msw.test.ts` — MSW integration for categories and module listing

- **New `MarketplaceClient` methods**:
  - `getUploadUrl(slug, version, size)` — presigned S3 upload URL
  - `createRelease(data)` — create marketplace release record
  - `createCheckoutSession(tier, licenseKey)` — Paddle checkout session
  - `getCheckoutStatus(sessionId)` — poll checkout status
  - `getCategories()` — list available module categories

### Changed

- `kaven module doctor`: Enhanced output with `[ERROR]`, `[WARN]`, `[INFO]` prefixes
- `src/index.ts`: All 6 new commands/subcommands registered, version bumped
- `package.json`: Added `@inquirer/prompts` dependency (type declarations in typings/)
- `tsconfig.json`: Added `typings/` directory to includes

---

## [0.1.0-alpha.1] - 2026-02-17

### Added

**Sprint C1 — 9 stories, 144 tests**

- **C1.1 Device Code Flow (RFC 8628)**: Browser auto-open, exponential backoff,
  countdown spinner, secure token storage
- **C1.2 Real MarketplaceClient**: Native `fetch`, typed error hierarchy,
  3-retry exponential backoff, 30s timeout
- **C1.3 JWT Token Management**: Base64url decode, auto-refresh < 5 min to expiry
- **C1.4 `kaven marketplace list`**: Real API, cli-table3, color-coded tiers,
  `--category`, `--sort`, `--json` flags
- **C1.5 Module Install Pipeline**: auth → metadata → download token → stream
  → SHA-256 verify → tar.gz extract → cleanup
- **C1.6 License Verification**: 1-hour TTL cache, Luhn format check,
  API fallback, tier comparison table, `kaven license status`
- **C1.7 PostInstall/PreRemove Scripts**: ScriptRunner with SIGTERM, 60s timeout
- **C1.8 Env Vars Injection**: EnvManager with module markers, `--skip-env`/`--env-file`
- **C1.9 Test Suite**: MSW HTTP mocking, JWT helpers, 24 integration + auth flow tests

---

[0.3.0-alpha.1]: https://github.com/kaven-co/kaven-cli/compare/v0.2.0-alpha.1...v0.3.0-alpha.1
[0.2.0-alpha.1]: https://github.com/kaven-co/kaven-cli/compare/v0.1.0-alpha.1...v0.2.0-alpha.1
[0.1.0-alpha.1]: https://github.com/kaven-co/kaven-cli/releases/tag/v0.1.0-alpha.1
