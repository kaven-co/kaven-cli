import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { ProjectInitializer } from "../../../src/core/ProjectInitializer";

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
    vi.restoreAllMocks();
  });

  // Name validation tests
  describe("validateName", () => {
    it("rejects names with spaces", () => {
      const result = initializer.validateName("my project");
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/space/i);
    });

    it("rejects empty names", () => {
      const result = initializer.validateName("");
      expect(result.valid).toBe(false);
    });

    it("rejects names with uppercase letters", () => {
      const result = initializer.validateName("MyProject");
      expect(result.valid).toBe(false);
    });

    it("rejects names with special characters", () => {
      const result = initializer.validateName("my_project!");
      expect(result.valid).toBe(false);
    });

    it("accepts valid lowercase-hyphen names", () => {
      expect(initializer.validateName("my-project").valid).toBe(true);
      expect(initializer.validateName("myproject123").valid).toBe(true);
      expect(initializer.validateName("my-saas-app").valid).toBe(true);
    });

    it("rejects whitespace-only names", () => {
      const result = initializer.validateName("   ");
      expect(result.valid).toBe(false);
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
      expect(exists).toBe(false);
    });

    it("does not throw if .git does not exist", async () => {
      const projectDir = path.join(testDir, "no-git-dir");
      await fs.ensureDir(projectDir);

      await expect(initializer.removeGitDir(projectDir)).resolves.not.toThrow();
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
      expect(pkg.name).toBe("test-app");
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
      expect(content).toContain("postgresql://user:pass@localhost:5432/mydb");
      expect(content).not.toContain("{{DATABASE_URL}}");
    });

    it("skips files that do not exist", async () => {
      const projectDir = path.join(testDir, "empty-app");
      await fs.ensureDir(projectDir);

      // Should not throw even if no files exist
      await expect(
        initializer.replacePlaceholders(projectDir, {
          projectName: "empty-app",
          dbUrl: "postgresql://localhost/db",
          emailProvider: "smtp",
          locale: "en-US",
          currency: "USD",
        })
      ).resolves.not.toThrow();
    });
  });
});
