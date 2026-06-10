import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { runEnvironmentBootstrap, child_process, ui } from "../../../src/commands/init/aiox-bootstrap.js";
import fs from "fs-extra";



describe("C3.1 — AIOX Bootstrap", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const mockSpinner = {
    start: mock.fn(() => mockSpinner),
    stop: mock.fn(() => mockSpinner),
    fail: mock.fn(() => mockSpinner),
    succeed: mock.fn(() => mockSpinner),
    warn: mock.fn(() => mockSpinner),
    text: "",
  };

  beforeEach(() => {
    mock.method(ui, "ora", () => mockSpinner);
  });

  it("should skip bootstrap when .aiox-core is not present", async () => {
    mock.method(fs, 'existsSync', () => false);
    const execSyncMock = mock.method(child_process, 'execSync', () => Buffer.from(''));
    await runEnvironmentBootstrap("/project", {});
    assert.strictEqual(execSyncMock.mock.calls.length, 0);
  });

  it("should call environment-bootstrap when .aiox-core is present", async () => {
    mock.method(fs, 'existsSync', () => true);
    const execSyncMock = mock.method(child_process, 'execSync', () => Buffer.from(''));
    await runEnvironmentBootstrap("/project", {});
    assert.ok(execSyncMock.mock.calls.some(call => call.arguments[0].includes("devops environment-bootstrap") && call.arguments[1].cwd === "/project"));
  });

  it("should respect --skip-aiox flag", async () => {
    const existsSyncMock = mock.method(fs, 'existsSync', () => true);
    const execSyncMock = mock.method(child_process, 'execSync', () => Buffer.from(''));
    await runEnvironmentBootstrap("/project", { skipAiox: true });
    assert.strictEqual(existsSyncMock.mock.calls.length, 0);
  });

  it("should warn but not throw when execSync fails", async () => {
    mock.method(fs, 'existsSync', () => true);
    mock.method(child_process, 'execSync', () => {
      throw new Error("Bootstrap failed");
    });
    
    // Should NOT throw
    await runEnvironmentBootstrap("/project", {});
  });
});
