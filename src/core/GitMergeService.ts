import { spawn } from "node:child_process";
import * as fs from "fs-extra";

export interface MergeResult {
  success: boolean;
  conflicts: boolean;
  output: string;
}

export class GitMergeService {
  public async performMerge(
    targetFile: string,
    baseFile: string,
    updateFile: string
  ): Promise<MergeResult> {
    if (!(await fs.pathExists(baseFile))) {
      throw new Error("Baseline cache file missing: " + baseFile + ". Cannot perform safe merge.");
    }
    if (!(await fs.pathExists(targetFile))) {
        await fs.copy(updateFile, targetFile);
        return { success: true, conflicts: false, output: "New file copied" };
    }
    return new Promise((resolve, reject) => {
      const proc = spawn("git", [
        "merge-file",
        "-L", "Your Modifications (OURS)",
        "-L", "Original Version (BASE)",
        "-L", "Kaven Update (THEIRS)",
        targetFile,
        baseFile,
        updateFile
      ]);
      let output = "";
      proc.stdout.on("data", (data) => { output += data.toString(); });
      proc.stderr.on("data", (data) => { output += data.toString(); });
      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, conflicts: false, output });
        } else if (code !== null && code > 0) {
          resolve({ success: true, conflicts: true, output });
        } else {
          reject(new Error("Git merge-file failed critically: " + output));
        }
      });
    });
  }
}
