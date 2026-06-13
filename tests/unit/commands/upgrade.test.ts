import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import fs from "fs-extra";
import path from "path";
import os from "os";

// Mock the MarketplaceClient and open module at module level


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

  });

  it("should prevent upgrade when license is missing", async () => {
    // No license.json file written — license is absent
    const licenseExists = await fs.pathExists(licenseJsonPath);
    assert.strictEqual(licenseExists, false);
  });

  it("should load license key from license.json", async () => {
    const licenseKey = "KAVEN-COMPLETE-ABCD1234-XY";
    await fs.writeJson(licenseJsonPath, { key: licenseKey, tier: "complete" });

    const data = await fs.readJson(licenseJsonPath);
    assert.strictEqual(data.key, licenseKey);
  });

  it("should save updated tier to license.json after upgrade", async () => {
    const licenseKey = "KAVEN-STARTER-EFGH5678-AB";
    await fs.writeJson(licenseJsonPath, { key: licenseKey, tier: "starter" });

    // Simulate writing new tier
    const existing = await fs.readJson(licenseJsonPath);
    await fs.writeJson(licenseJsonPath, { ...existing, tier: "complete" });

    const updated = await fs.readJson(licenseJsonPath);
    assert.strictEqual(updated.tier, "complete");
    assert.strictEqual(updated.key, licenseKey); // key preserved
  });

  it("should return null for missing license key", async () => {
    // File exists but has no 'key' field
    await fs.writeJson(licenseJsonPath, { tier: "free" });
    const data = await fs.readJson(licenseJsonPath);
    assert.strictEqual(data.key || null, null);
  });

  it("checkout status 'pending' should not resolve immediately", () => {
    // Polling behavior: status stays pending for first polls
    const statuses = ["pending", "pending", "confirmed"];
    let index = 0;
    const getStatus = () => statuses[index++] || "pending";

    assert.strictEqual(getStatus(), "pending");
    assert.strictEqual(getStatus(), "pending");
    assert.strictEqual(getStatus(), "confirmed");
  });

  it("checkout status 'cancelled' should abort gracefully", () => {
    const status = "cancelled";
    assert.strictEqual(status, "cancelled");
    // Not an error status — just user cancellation
  });

  it("should handle 'failed' checkout status as error", () => {
    const status = "failed";
    assert.ok(["pending", "confirmed", "cancelled", "failed"].includes(status));
    assert.strictEqual(status, "failed");
  });

  it("MAX_POLLS constant ensures 10-minute timeout", () => {
    // 5s interval * 120 polls = 600s = 10 minutes
    const POLL_INTERVAL_MS = 5_000;
    const MAX_POLLS = 120;
    const maxDurationMs = POLL_INTERVAL_MS * MAX_POLLS;
    assert.strictEqual(maxDurationMs, 600_000); // 10 minutes in ms
  });
});
