import fs from "fs-extra";
import path from "path";
import type { InitPromptAnswers } from "./ProjectInitializer.js";

export type InitStep =
  | "clone"
  | "configure"
  | "install"
  | "git"
  | "squad"
  | "aiox-core"
  | "env-bootstrap";

export type StepStatus = "pending" | "done" | "failed" | "skipped";

export interface InitState {
  version: "1";
  projectName: string;
  answers: InitPromptAnswers & { projectName: string };
  options: {
    withSquad?: boolean;
    skipInstall?: boolean;
    skipGit?: boolean;
    skipAiox?: boolean;
    template?: string;
  };
  steps: Record<InitStep, StepStatus>;
  startedAt: string;
  updatedAt: string;
}

const STATE_FILE = ".kaven/init-state.json";

const STEP_ORDER: InitStep[] = [
  "clone",
  "configure",
  "install",
  "git",
  "squad",
  "aiox-core",
  "env-bootstrap",
];

export class InitStateManager {
  private statePath: string;
  private state: InitState | null = null;

  constructor(private projectDir: string) {
    this.statePath = path.join(projectDir, STATE_FILE);
  }

  static async findIncomplete(projectDir: string): Promise<InitStateManager | null> {
    const manager = new InitStateManager(projectDir);
    if (!(await fs.pathExists(manager.statePath))) return null;
    await manager.load();
    if (manager.isComplete()) return null;
    return manager;
  }

  async load(): Promise<InitState> {
    this.state = await fs.readJson(this.statePath);
    return this.state!;
  }

  async create(
    projectName: string,
    answers: InitPromptAnswers & { projectName: string },
    options: InitState["options"]
  ): Promise<void> {
    const steps: Record<InitStep, StepStatus> = {
      clone: "pending",
      configure: "pending",
      install: "pending",
      git: "pending",
      squad: "pending",
      "aiox-core": "pending",
      "env-bootstrap": "pending",
    };

    if (options.skipInstall) steps.install = "skipped";
    if (options.skipGit) steps.git = "skipped";
    if (!options.withSquad) {
      steps.squad = "skipped";
      steps["aiox-core"] = "skipped";
    }
    if (options.skipAiox) steps["env-bootstrap"] = "skipped";

    this.state = {
      version: "1",
      projectName,
      answers,
      options,
      steps,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.ensureDir(path.dirname(this.statePath));
    await this.persist();
  }

  async markStep(step: InitStep, status: Exclude<StepStatus, "pending">): Promise<void> {
    if (!this.state) throw new Error("State not initialized");
    this.state.steps[step] = status;
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
  }

  getState(): InitState {
    if (!this.state) throw new Error("State not loaded");
    return this.state;
  }

  /** Returns the first step that is pending or failed — i.e., where to resume. */
  getResumePoint(): InitStep | null {
    if (!this.state) return null;
    return STEP_ORDER.find(
      (s) => this.state!.steps[s] === "pending" || this.state!.steps[s] === "failed"
    ) ?? null;
  }

  isComplete(): boolean {
    if (!this.state) return false;
    return STEP_ORDER.every(
      (s) => this.state!.steps[s] === "done" || this.state!.steps[s] === "skipped"
    );
  }

  /** Remove the state file after successful completion. */
  async cleanup(): Promise<void> {
    if (await fs.pathExists(this.statePath)) {
      await fs.remove(this.statePath);
    }
  }

  private async persist(): Promise<void> {
    await fs.writeJson(this.statePath, this.state, { spaces: 2 });
  }
}
