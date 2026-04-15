import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectInitializer } from "../../../src/core/ProjectInitializer";
import * as fs from "fs-extra";
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

    expect(techStack).toContain("Tech Stack — my-awesome-saas");
    expect(sourceTree).toContain("Source Tree — my-awesome-saas");
    expect(codingStandards).toContain("Coding Standards — my-awesome-saas");
  });
});
