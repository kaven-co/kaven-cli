import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { ProjectInitializer } from "../../../src/core/ProjectInitializer.js";
import fs from "fs-extra";
import * as path from "node:path";
import * as os from "node:os";

describe("D2.3 — Architecture Docs Initializer", () => {
  let tempDir: string;
  const initializer = new ProjectInitializer();

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), "kaven-init-test-" + Date.now());
    await fs.ensureDir(tempDir);
    
    // Mock project structure
    await fs.ensureDir(path.join(tempDir, "docs/architecture"));
    await fs.writeFile(path.join(tempDir, "docs/architecture/tech-stack.md"), "# Tech Stack — {{PROJECT_NAME}}");
    await fs.writeFile(path.join(tempDir, "docs/architecture/source-tree.md"), "# Source Tree — {{PROJECT_NAME}}");
    await fs.writeFile(path.join(tempDir, "docs/architecture/coding-standards.md"), "# Coding Standards — {{PROJECT_NAME}}");
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("should replace {{PROJECT_NAME}} in all architecture docs", async () => {
    await initializer.replacePlaceholders(tempDir, {
      projectName: "my-awesome-saas",
      dbUrl: "postgresql://localhost",
      locale: "en-US",
      currency: "USD",
    });

    const techStack = await fs.readFile(path.join(tempDir, "docs/architecture/tech-stack.md"), "utf-8");
    const sourceTree = await fs.readFile(path.join(tempDir, "docs/architecture/source-tree.md"), "utf-8");
    const codingStandards = await fs.readFile(path.join(tempDir, "docs/architecture/coding-standards.md"), "utf-8");

    assert.ok(techStack.includes("Tech Stack — my-awesome-saas"));
    assert.ok(sourceTree.includes("Source Tree — my-awesome-saas"));
    assert.ok(codingStandards.includes("Coding Standards — my-awesome-saas"));
  });
});
