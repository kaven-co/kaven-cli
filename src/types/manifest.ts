import { z } from "zod";

const DependencySchema = z.object({
  npm: z.array(z.string()).default([]),
  peerModules: z.array(z.string()).default([]),
  kavenVersion: z.string().default(">=0.1.0"),
});

const FileSetSchema = z.object({
  source: z.string(),
  dest: z.string(),
});

const FilesSchema = z.object({
  backend: z.array(FileSetSchema).default([]),
  frontend: z.array(FileSetSchema).default([]),
  database: z.array(FileSetSchema).default([]),
});

const InjectionSchema = z.object({
  file: z.string(),
  anchor: z.string(),
  code: z.string(),
  moduleName: z.string().optional(),
});

const ScriptsSchema = z.object({
  postInstall: z.string().nullable().default(null),
  preRemove: z.string().nullable().default(null),
});

const EnvVarSchema = z.object({
  key: z.string(),
  required: z.boolean().default(false),
  example: z.string().optional(),
});

export const ModuleManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  author: z.string().default("Kaven"),
  license: z.string().default("Proprietary"),

  dependencies: DependencySchema,
  files: FilesSchema,
  injections: z.array(InjectionSchema),
  scripts: ScriptsSchema,
  env: z.array(EnvVarSchema).default([]),
});

export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
