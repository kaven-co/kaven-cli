# Contributing to Kaven CLI

Thank you for your interest in contributing to Kaven CLI!

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. **Fork** the repository.
2. **Clone** your fork locally.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Create a new branch:
   ```bash
   git checkout -b feat/my-feature
   ```

## Workflow & Gates

All Pull Requests must pass the following checks before merging:

- **Lint**: `pnpm lint`
- **Typecheck**: `pnpm typecheck`
- **Tests**: `pnpm test`
- **Build**: `pnpm build`

Failed checks will block the merge.

## Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/).

Examples:

- `feat: add new module command`
- `fix: resolve crash on login`
- `docs: update README`

## Reporting Issues

Use the [Issue Templates](.github/ISSUE_TEMPLATE) to report bugs or request features.
