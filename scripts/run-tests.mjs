#!/usr/bin/env node
// Node 20 compatible test runner — avoids glob in --test (only supported Node 22+)
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

function findTestFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTestFiles(full));
      } else if (entry.name.endsWith(".test.ts")) {
        files.push(full);
      }
    }
  } catch {
    // directory may not exist
  }
  return files;
}

const files = [...findTestFiles("src"), ...findTestFiles("tests")];
const proc = spawn("node", ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
proc.on("exit", (code) => process.exit(code ?? 0));
