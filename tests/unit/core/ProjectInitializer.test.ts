import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "path";
import os from "os";
import { ProjectInitializer } from "../../../src/core/ProjectInitializer.js";

describe("ProjectInitializer", () => {
  let testDir: string;
  let initializer: ProjectInitializer;

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(testDir);
    initializer = new ProjectInitializer();
  });

  afterEach(async () => {
    await fs.remove(testDir);

  });

  // Name validation tests
  describe("validateName", () => {
    it("rejects names with spaces", () => {
      const result = initializer.validateName("my project");
      assert.strictEqual(result.valid, false);
      assert.match(result.reason, /space/i);
    });

    it("rejects empty names", () => {
      const result = initializer.validateName("");
      assert.strictEqual(result.valid, false);
    });

    it("rejects names with uppercase letters", () => {
      const result = initializer.validateName("MyProject");
      assert.strictEqual(result.valid, false);
    });

    it("rejects names with special characters", () => {
      const result = initializer.validateName("my_project!");
      assert.strictEqual(result.valid, false);
    });

    it("accepts valid lowercase-hyphen names", () => {
      assert.strictEqual(initializer.validateName("my-project").valid, true);
      assert.strictEqual(initializer.validateName("myproject123").valid, true);
      assert.strictEqual(initializer.validateName("my-saas-app").valid, true);
    });

    it("rejects whitespace-only names", () => {
      const result = initializer.validateName("   ");
      assert.strictEqual(result.valid, false);
    });
  });

  // removeGitDir tests
  describe("removeGitDir", () => {
    it("removes .git directory if it exists", async () => {
      const projectDir = path.join(testDir, "my-app");
      await fs.ensureDir(path.join(projectDir, ".git"));
      await fs.writeFile(path.join(projectDir, ".git", "config"), "test");

      await initializer.removeGitDir(projectDir);

      const exists = await fs.pathExists(path.join(projectDir, ".git"));
      assert.strictEqual(exists, false);
    });

    it("does not throw if .git does not exist", async () => {
      const projectDir = path.join(testDir, "no-git-dir");
      await fs.ensureDir(projectDir);

      await assert.doesNotReject(async () => { await initializer.removeGitDir(projectDir); });
    });
  });

  // replacePlaceholders tests
  describe("replacePlaceholders", () => {
    it("replaces all placeholders in package.json", async () => {
      const projectDir = path.join(testDir, "my-app");
      await fs.ensureDir(projectDir);
      await fs.writeFile(
        path.join(projectDir, "package.json"),
        JSON.stringify({ name: "{{PROJECT_NAME}}", version: "1.0.0" })
      );

      await initializer.replacePlaceholders(projectDir, {
        projectName: "test-app",
        dbUrl: "postgresql://localhost:5432/testdb",
        emailProvider: "postmark",
        locale: "en-US",
        currency: "USD",
      });

      const pkg = await fs.readJson(path.join(projectDir, "package.json"));
      assert.strictEqual(pkg.name, "test-app");
    });

    it("replaces DATABASE_URL in .env.example", async () => {
      const projectDir = path.join(testDir, "my-app");
      await fs.ensureDir(projectDir);
      await fs.writeFile(
        path.join(projectDir, ".env.example"),
        "DATABASE_URL={{DATABASE_URL}}\n"
      );

      await initializer.replacePlaceholders(projectDir, {
        projectName: "test-app",
        dbUrl: "postgresql://user:pass@localhost:5432/mydb",
        emailProvider: "postmark",
        locale: "pt-BR",
        currency: "BRL",
      });

      const content = await fs.readFile(
        path.join(projectDir, ".env.example"),
        "utf-8"
      );
      assert.ok(content.includes("postgresql://user:pass@localhost:5432/mydb"));
      assert.ok(!content.includes("{{DATABASE_URL}}"));
    });

    it("skips files that do not exist", async () => {
      const projectDir = path.join(testDir, "empty-app");
      await fs.ensureDir(projectDir);

      // Should not throw even if no files exist
      await assert.doesNotReject(async () => { await 
        initializer.replacePlaceholders(projectDir, {
          projectName: "empty-app",
          dbUrl: "postgresql://localhost/db",
          emailProvider: "smtp",
          locale: "en-US",
          currency: "USD",
        })
      ; });
    });
  });
});
