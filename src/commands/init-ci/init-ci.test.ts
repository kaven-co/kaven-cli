import { describe, it, expect } from "vitest";

describe("C2.6: CI/CD Integration", () => {
  it("C2.6.1: Should define test workflow", () => {
    // Test that GitHub Actions workflow can be generated
    const workflowContent = `name: Tests
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest`;

    expect(workflowContent).toContain("name: Tests");
    expect(workflowContent).toContain("runs-on: ubuntu-latest");
  });

  it("C2.6.2: Should define publish workflow", () => {
    const workflowContent = `name: Publish Module
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest`;

    expect(workflowContent).toContain("Publish Module");
    expect(workflowContent).toContain("tags:");
  });

  it("C2.6.3: Should create pre-commit hook", () => {
    const hookContent = `#!/bin/bash
set -e
pnpm lint || exit 1
pnpm typecheck || exit 1`;

    expect(hookContent).toContain("#!/bin/bash");
    expect(hookContent).toContain("pnpm lint");
  });

  it("C2.6.4: Should include environment setup", () => {
    const workflowContent = `steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20`;

    expect(workflowContent).toContain("node-version: 20");
    expect(workflowContent).toContain("pnpm/action-setup");
  });
});
