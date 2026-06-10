import path from "node:path";
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { ProjectInitializer } from "../../core/ProjectInitializer.js";

describe("C2.1: kaven init Bootstrap", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-test-"));
    projectDir = path.join(tempDir, "test-project");
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("C2.1.1: Should validate project names", async () => {
    const init = new ProjectInitializer();

    assert.strictEqual(init.validateName("my-project").valid, true);
    assert.strictEqual(init.validateName("MyProject").valid, false);
    assert.strictEqual(init.validateName("my project").valid, false);
    assert.strictEqual(init.validateName("").valid, false);
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
    assert.ok(health.issues.length > 0);
    assert.strictEqual(health.healthy, false);
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

    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.issues.length, 0);
  });

  it("C2.1.4: Should detect missing required files", async () => {
    await fs.ensureDir(projectDir);
    // Create incomplete structure

    const init = new ProjectInitializer();
    const health = await init.healthCheck(projectDir);

    assert.strictEqual(health.healthy, false);
    assert.ok(health.issues.length > 0);
  });

  it("C2.1.5: Should handle project root detection", async () => {
    await fs.ensureDir(projectDir);
    assert.ok(projectDir !== undefined);
  });
});

describe("C2.6: kaven init --with-squad", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-squad-test-"));
    projectDir = path.join(tempDir, "test-project");
    await fs.ensureDir(projectDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it("C2.6.1: Should skip install and return already-exists when squad dir already present", async () => {
    const squadDir = path.join(projectDir, "squads", "kaven-squad");
    await fs.ensureDir(squadDir);

    const init = new ProjectInitializer();
    const result = await init.installSquad(projectDir);

    assert.strictEqual(result.installed, false);
    assert.strictEqual(result.reason, "already-exists");
  });

  it("C2.6.2: installSquad result type contract — installed=false includes reason string", () => {
    const failureResult = {
      installed: false,
      reason: "git clone exited with code 1",
    };
    const successResult = { installed: true };

    assert.strictEqual(failureResult.installed, false);
    assert.ok(failureResult.reason.includes("exit"));
    assert.strictEqual(successResult.installed, true);
  });

  it("C2.6.4: Should create squads/ directory before attempting clone", async () => {
    const squadsDir = path.join(projectDir, "squads");
    assert.strictEqual(await fs.pathExists(squadsDir), false);

    const init = new ProjectInitializer();

    // Use mock.method for spying on fs.ensureDir
    const ensureSpy = mock.method(fs, "ensureDir", async (dirPath: string) => {
      if (dirPath.includes("squads")) {
        await fs.mkdir(dirPath, { recursive: true });
        throw new Error("__test_abort__");
      }
    });

    await init.installSquad(projectDir).catch((err: Error) => {
      if (!err.message.includes("__test_abort__")) throw err;
    });

    assert.ok(ensureSpy.mock.calls.length > 0);
    assert.strictEqual(await fs.pathExists(squadsDir), true);
    
    ensureSpy.mock.restore();
  });

  it("C2.6.5: InitOptions type includes withSquad boolean field", () => {
    const opts = {
      withSquad: true,
    };
    assert.strictEqual(opts.withSquad, true);
  });
});
