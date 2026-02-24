import chalk from "chalk";
import ora from "ora";
import path from "path";
import fs from "fs-extra";

export interface InitCiOptions {
  dryRun?: boolean;
}

const GITHUB_WORKFLOW_TEST = `name: Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
`;

const GITHUB_WORKFLOW_PUBLISH = `name: Publish Module
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - name: Publish to Kaven Marketplace
        env:
          KAVEN_LICENSE_KEY: \${{ secrets.KAVEN_LICENSE_KEY }}
        run: kaven module publish
`;

const PRE_COMMIT_HOOK = `#!/bin/bash
# Pre-commit hook for Kaven projects
set -e

echo "🔍 Running pre-commit checks..."

# Lint
echo "  Linting..."
pnpm lint || exit 1

# Type check
echo "  Type checking..."
pnpm typecheck || exit 1

# Format check
if command -v pnpm format &> /dev/null; then
  echo "  Format checking..."
  pnpm format || exit 1
fi

echo "✅ All pre-commit checks passed"
`;

/**
 * C2.6: Initialize CI/CD templates
 */
export async function initCi(options: InitCiOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if it's a Kaven project
  const packageJsonPath = path.join(cwd, "package.json");
  if (!(await fs.pathExists(packageJsonPath))) {
    console.error(chalk.red("Error: package.json not found. Run this in a Kaven project root."));
    process.exit(1);
  }

  const spinner = ora("Setting up CI/CD configuration...").start();

  try {
    // Create .github/workflows directory
    const workflowDir = path.join(cwd, ".github", "workflows");
    await fs.ensureDir(workflowDir);

    // Create test workflow
    const testWorkflowPath = path.join(workflowDir, "test.yml");
    if (!options.dryRun) {
      await fs.writeFile(testWorkflowPath, GITHUB_WORKFLOW_TEST);
    }
    spinner.text = `Creating ${chalk.cyan(".github/workflows/test.yml")}...`;

    // Create publish workflow
    const publishWorkflowPath = path.join(workflowDir, "publish.yml");
    if (!options.dryRun) {
      await fs.writeFile(publishWorkflowPath, GITHUB_WORKFLOW_PUBLISH);
    }
    spinner.text = `Creating ${chalk.cyan(".github/workflows/publish.yml")}...`;

    // Create pre-commit hook
    const hookDir = path.join(cwd, ".husky");
    await fs.ensureDir(hookDir);

    const preCommitHookPath = path.join(hookDir, "pre-commit");
    if (!options.dryRun) {
      await fs.writeFile(preCommitHookPath, PRE_COMMIT_HOOK);
      await fs.chmod(preCommitHookPath, 0o755);
    }
    spinner.text = `Creating ${chalk.cyan(".husky/pre-commit")}...`;

    spinner.succeed("CI/CD configuration created");

    console.log();
    console.log(chalk.bold("Files created:"));
    console.log(`  ${chalk.cyan(".github/workflows/test.yml")} - Run tests on push/PR`);
    console.log(`  ${chalk.cyan(".github/workflows/publish.yml")} - Publish on git tags`);
    console.log(`  ${chalk.cyan(".husky/pre-commit")} - Local pre-commit validation`);

    console.log();
    console.log(chalk.bold("Next steps:"));
    console.log(chalk.gray("  1. Install husky: pnpm husky install"));
    console.log(chalk.gray("  2. Add GitHub secrets: KAVEN_LICENSE_KEY"));
    console.log(
      chalk.gray("  3. Push to GitHub and watch workflows run")
    );

    if (options.dryRun) {
      console.log();
      console.log(chalk.yellow("(Dry-run: No files were actually created)"));
    }
  } catch (error) {
    spinner.fail("Failed to create CI/CD configuration");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}
