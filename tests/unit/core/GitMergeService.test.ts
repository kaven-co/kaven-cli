import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { GitMergeService } from "../../../src/core/GitMergeService.js";

describe("GitMergeService", () => {
  let tempDir: string;
  let mergeService: GitMergeService;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kaven-merge-test-"));
    mergeService = new GitMergeService();
  });
  afterEach(async () => {
    await fs.remove(tempDir);
  });
  test("should merge clean changes without conflicts", async () => {
    const baseFile = path.join(tempDir, "base.txt");
    const oursFile = path.join(tempDir, "ours.txt");
    const theirsFile = path.join(tempDir, "theirs.txt");
    const baseContent = "line 1\nline 2\nline 3\nline 4\nline 5\n";
    const oursContent = "line 1 modified\nline 2\nline 3\nline 4\nline 5\n";
    const theirsContent = "line 1\nline 2\nline 3\nline 4\nline 5 modified\n";
    await fs.writeFile(baseFile, baseContent);
    await fs.writeFile(oursFile, oursContent);
    await fs.writeFile(theirsFile, theirsContent);
    const result = await mergeService.performMerge(oursFile, baseFile, theirsFile);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.conflicts, false);
    const mergedContent = await fs.readFile(oursFile, "utf8");
    assert.strictEqual(mergedContent, "line 1 modified\nline 2\nline 3\nline 4\nline 5 modified\n");
  });
  test("should detect conflicts when same line is modified differently", async () => {
    const baseFile = path.join(tempDir, "base.txt");
    const oursFile = path.join(tempDir, "ours.txt");
    const theirsFile = path.join(tempDir, "theirs.txt");
    const baseContent = "line 1\nline 2\nline 3\n";
    const oursContent = "line 1\nours modification\nline 3\n";
    const theirsContent = "line 1\ntheirs modification\nline 3\n";
    await fs.writeFile(baseFile, baseContent);
    await fs.writeFile(oursFile, oursContent);
    await fs.writeFile(theirsFile, theirsContent);
    const result = await mergeService.performMerge(oursFile, baseFile, theirsFile);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.conflicts, true);
    const mergedContent = await fs.readFile(oursFile, "utf8");
    assert.ok(mergedContent.includes("<<<<<<<"));
    assert.ok(mergedContent.includes("======="));
    assert.ok(mergedContent.includes(">>>>>>>"));
  });
  test("should throw error if base file is missing", async () => {
    const baseFile = path.join(tempDir, "missing.txt");
    const oursFile = path.join(tempDir, "ours.txt");
    const theirsFile = path.join(tempDir, "theirs.txt");
    await fs.writeFile(oursFile, "test");
    await fs.writeFile(theirsFile, "test");
    await assert.rejects(() => mergeService.performMerge(oursFile, baseFile, theirsFile), /Baseline cache file missing/);
  });
});
