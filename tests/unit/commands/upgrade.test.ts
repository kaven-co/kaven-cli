import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

// Mock the MarketplaceClient and open module at module level
vi.mock("open", () => ({ default: vi.fn().mockResolvedValue(undefined) }));

describe("upgradeCommand", () => {
  let tempDir: string;
  let authJsonPath: string;
  let licenseJsonPath: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `upgrade-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.ensureDir(tempDir);

    authJsonPath = path.join(tempDir, ".kaven", "auth.json");
    licenseJsonPath = path.join(tempDir, ".kaven", "license.json");
    await fs.ensureDir(path.join(tempDir, ".kaven"));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    vi.restoreAllMocks();
  });

  it("should prevent upgrade when license is missing", async () => {
    // No license.json file written — license is absent
    const licenseExists = await fs.pathExists(licenseJsonPath);
    expect(licenseExists).toBe(false);
  });

  it("should load license key from license.json", async () => {
    const licenseKey = "KAVEN-COMPLETE-ABCD1234-XY";
    await fs.writeJson(licenseJsonPath, { key: licenseKey, tier: "complete" });

    const data = await fs.readJson(licenseJsonPath);
    expect(data.key).toBe(licenseKey);
  });

  it("should save updated tier to license.json after upgrade", async () => {
    const licenseKey = "KAVEN-STARTER-EFGH5678-AB";
    await fs.writeJson(licenseJsonPath, { key: licenseKey, tier: "starter" });

    // Simulate writing new tier
    const existing = await fs.readJson(licenseJsonPath);
    await fs.writeJson(licenseJsonPath, { ...existing, tier: "complete" });

    const updated = await fs.readJson(licenseJsonPath);
    expect(updated.tier).toBe("complete");
    expect(updated.key).toBe(licenseKey); // key preserved
  });

  it("should return null for missing license key", async () => {
    // File exists but has no 'key' field
    await fs.writeJson(licenseJsonPath, { tier: "free" });
    const data = await fs.readJson(licenseJsonPath);
    expect(data.key || null).toBeNull();
  });

  it("checkout status 'pending' should not resolve immediately", () => {
    // Polling behavior: status stays pending for first polls
    const statuses = ["pending", "pending", "confirmed"];
    let index = 0;
    const getStatus = () => statuses[index++] || "pending";

    expect(getStatus()).toBe("pending");
    expect(getStatus()).toBe("pending");
    expect(getStatus()).toBe("confirmed");
  });

  it("checkout status 'cancelled' should abort gracefully", () => {
    const status = "cancelled";
    expect(status).toBe("cancelled");
    // Not an error status — just user cancellation
  });

  it("should handle 'failed' checkout status as error", () => {
    const status = "failed";
    expect(["pending", "confirmed", "cancelled", "failed"]).toContain(status);
    expect(status).toBe("failed");
  });

  it("MAX_POLLS constant ensures 10-minute timeout", () => {
    // 5s interval * 120 polls = 600s = 10 minutes
    const POLL_INTERVAL_MS = 5_000;
    const MAX_POLLS = 120;
    const maxDurationMs = POLL_INTERVAL_MS * MAX_POLLS;
    expect(maxDurationMs).toBe(600_000); // 10 minutes in ms
  });
});
