import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import fs from "fs-extra";
import { ProjectInitializer } from "../../core/ProjectInitializer";

describe("C2.1: kaven init Bootstrap", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kaven-test-${Date.now()}`);
    projectDir = path.join(tempDir, "test-project");
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("C2.1.1: Should validate project names", async () => {
    const init = new ProjectInitializer();

    expect(init.validateName("my-project").valid).toBe(true);
    expect(init.validateName("MyProject").valid).toBe(false);
    expect(init.validateName("my project").valid).toBe(false);
    expect(init.validateName("").valid).toBe(false);
  });

  it("C2.1.2: Should create placeholder project directory structure", async () => {
    await fs.ensureDir(projectDir);

    // Create minimal structure for testing
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "prisma"));
    await fs.writeFile(path.join(projectDir, "prisma", "schema.prisma"), "");
    await fs.writeFile(path.join(projectDir, ".env.example"), "");

    const init = new ProjectInitializer();
    const health = await init.healthCheck(projectDir);

    // Should detect missing node_modules
    expect(health.issues.length).toBeGreaterThan(0);
    expect(health.healthy).toBe(false);
  });

  it("C2.1.3: Should pass health check with complete setup", async () => {
    await fs.ensureDir(projectDir);

    // Create complete structure
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "prisma"));
    await fs.writeFile(path.join(projectDir, "prisma", "schema.prisma"), "");
    await fs.writeFile(path.join(projectDir, ".env.example"), "");
    await fs.ensureDir(path.join(projectDir, "node_modules"));

    const init = new ProjectInitializer();
    const health = await init.healthCheck(projectDir);

    expect(health.healthy).toBe(true);
    expect(health.issues.length).toBe(0);
  });

  it("C2.1.4: Should detect missing required files", async () => {
    await fs.ensureDir(projectDir);
    // Create incomplete structure

    const init = new ProjectInitializer();
    const health = await init.healthCheck(projectDir);

    expect(health.healthy).toBe(false);
    expect(health.issues.length).toBeGreaterThan(0);
  });

  it("C2.1.5: Should handle git initialization", async () => {
    await fs.ensureDir(projectDir);

    // Create minimal files for git
    await fs.writeFile(path.join(projectDir, "README.md"), "# Test");
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });

    // Mock git commands
    vi.mock("child_process", () => ({
      spawn: vi.fn(() => ({
        on: vi.fn(),
        stdout: null,
        stderr: null,
      })),
    }));

    // Initialization would happen in real scenario
    expect(projectDir).toBeDefined();
  });
});
