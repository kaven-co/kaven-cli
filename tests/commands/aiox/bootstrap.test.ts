import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEnvironmentBootstrap } from "../../../src/commands/init/aiox-bootstrap";
import * as fs from "node:fs";
import { execSync } from "node:child_process";

vi.mock("node:fs");
vi.mock("node:child_process");
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
}));

describe("C3.1 — AIOX Bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip bootstrap when .aiox-core is not present", async () => {
    (fs.existsSync as any).mockReturnValue(false);
    await runEnvironmentBootstrap("/project", {});
    expect(execSync).not.toHaveBeenCalled();
  });

  it("should call environment-bootstrap when .aiox-core is present", async () => {
    (fs.existsSync as any).mockReturnValue(true);
    await runEnvironmentBootstrap("/project", {});
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("devops environment-bootstrap"),
      expect.objectContaining({ cwd: "/project" })
    );
  });

  it("should respect --skip-aiox flag", async () => {
    await runEnvironmentBootstrap("/project", { skipAiox: true });
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it("should warn but not throw when execSync fails", async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (execSync as any).mockImplementationOnce(() => {
      throw new Error("Bootstrap failed");
    });
    await expect(runEnvironmentBootstrap("/project", {})).resolves.toBeUndefined();
  });
});
