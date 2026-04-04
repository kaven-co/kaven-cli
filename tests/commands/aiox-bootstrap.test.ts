import { describe, it, expect, vi, beforeEach } from "vitest";
import { runEnvironmentBootstrap } from "../../src/commands/init/aiox-bootstrap";
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

describe("AIOX Environment Bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should skip if skipAiox is true", async () => {
    await runEnvironmentBootstrap("/tmp/project", { skipAiox: true });
    expect(execSync).not.toHaveBeenCalled();
  });

  it("should execute bootstrap if AIOX core is found", async () => {
    (fs.existsSync as any).mockReturnValue(true);
    await runEnvironmentBootstrap("/tmp/project");
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("devops environment-bootstrap"),
      expect.any(Object)
    );
  });

  it("should not throw if bootstrap fails", async () => {
    (fs.existsSync as any).mockReturnValue(true);
    (execSync as any).mockImplementation(() => {
      throw new Error("Bootstrap failed");
    });
    
    await expect(runEnvironmentBootstrap("/tmp/project")).resolves.not.toThrow();
  });
});
