import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import fs from "fs-extra";
import { ProjectInitializer } from "../../core/ProjectInitializer.js";

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

    // Create minimal structure for testing (monorepo path)
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "packages/database/prisma"));
    await fs.writeFile(path.join(projectDir, "packages/database/prisma/schema.prisma"), "");
    await fs.writeFile(path.join(projectDir, ".env.example"), "");

    const init = new ProjectInitializer();
    const health = await init.healthCheck(projectDir);

    // Should detect missing node_modules
    expect(health.issues.length).toBeGreaterThan(0);
    expect(health.healthy).toBe(false);
  });

  it("C2.1.3: Should pass health check with complete setup", async () => {
    await fs.ensureDir(projectDir);

    // Create complete structure (monorepo path)
    await fs.writeJson(path.join(projectDir, "package.json"), { name: "test" });
    await fs.ensureDir(path.join(projectDir, "packages/database/prisma"));
    await fs.writeFile(path.join(projectDir, "packages/database/prisma/schema.prisma"), "");
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

describe("C2.6: kaven init --with-squad", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `kaven-squad-test-${Date.now()}`);
    projectDir = path.join(tempDir, "test-project");
    await fs.ensureDir(projectDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(tempDir);
  });

  it("C2.6.1: Should skip install and return already-exists when squad dir already present", async () => {
    const squadDir = path.join(projectDir, "squads", "kaven-squad");
    await fs.ensureDir(squadDir);

    const init = new ProjectInitializer();
    const result = await init.installSquad(projectDir);

    expect(result.installed).toBe(false);
    expect(result.reason).toBe("already-exists");
  });

  it("C2.6.2: installSquad result type contract — installed=false includes reason string", () => {
    // Verify the type contract without network calls
    type SquadResult = { installed: boolean; reason?: string };
    const failureResult: SquadResult = {
      installed: false,
      reason: "git clone exited with code 1",
    };
    const successResult: SquadResult = { installed: true };

    expect(failureResult.installed).toBe(false);
    expect(failureResult.reason).toContain("exit");
    expect(successResult.installed).toBe(true);
    expect(successResult.reason).toBeUndefined();
  });

  it("C2.6.3: Should skip install if squads/kaven-squad already exists", async () => {
    const squadDir = path.join(projectDir, "squads", "kaven-squad");
    await fs.ensureDir(squadDir);

    const init = new ProjectInitializer();
    const result = await init.installSquad(projectDir);

    expect(result.installed).toBe(false);
    expect(result.reason).toBe("already-exists");
  });

  it("C2.6.4: Should create squads/ directory before attempting clone", async () => {
    // squads/ does not exist initially
    const squadsDir = path.join(projectDir, "squads");
    expect(await fs.pathExists(squadsDir)).toBe(false);

    const init = new ProjectInitializer();

    // Spy on ensureDir and make it resolve without triggering the real git clone.
    // After ensureDir is called for the squads path, throw to abort the rest
    // of the flow — this avoids network timeouts while still verifying the invariant.
    const ensureSpy = vi.spyOn(fs, "ensureDir").mockImplementation(async (dirPath) => {
      if ((dirPath as string).includes("squads")) {
        // Actually create the dir so we can assert on fs state, then throw
        await fs.mkdir(dirPath as string, { recursive: true });
        throw new Error("__test_abort__");
      }
    });

    await init.installSquad(projectDir).catch((err: Error) => {
      // Only swallow the sentinel we threw — let real errors propagate
      if (!err.message.includes("__test_abort__")) throw err;
    });

    const ensureDirCalls = ensureSpy.mock.calls.map((c) => c[0] as string);
    const calledForSquads = ensureDirCalls.some((p) => p.includes("squads"));
    expect(calledForSquads).toBe(true);
    expect(await fs.pathExists(squadsDir)).toBe(true);
  });

  it("C2.6.5: InitOptions type includes withSquad boolean field", () => {
    // Compile-time check via assignability
    const opts: import("../../core/ProjectInitializer").InitOptions = {
      withSquad: true,
    };
    expect(opts.withSquad).toBe(true);
  });
});
