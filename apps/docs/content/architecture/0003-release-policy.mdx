---
title: "ADR 0003: Release Policy"
description: "Release automation via git tags and CI pipelines"
date: 2026-01-23
author: "Kaven Team"
---

# ADR 0003: Release Policy

## Status

Accepted

## Context

We need a deterministic, automated process to move code from development to production (npm Registry) without manual developer intervention.

## Decision

We will use a **Tag-Driven Deployment** workflows:

1. **Main Branch is Trunk**:
   - The `main` branch always contains the latest integrated code.
   - Validation (test/lint) runs on every push.
   - DOES NOT auto-publish to npm.

2. **Releases via Git Tags**:
   - Publishing is triggered **only** by pushing a git tag (e.g., `v0.1.0`, `v1.2.0-beta.1`).
   - The CI pipeline detects the tag, builds the artifact, and publishes it.

3. **NPM Distribution Tags**:
   - `latest`: Applied to stable releases (e.g., `1.0.0`). Default install.
   - `next`: Applied to pre-releases (`alpha`, `beta`, `rc`). Must be installed explicitly (`npm i kaven-cli@next`).

## Consequences

- **Security**: No developer keys on local machines; only CI has publishing secrets.
- **Auditability**: Perfect traceability between a Git Tag (Source Code) and an NPM Version (Artifact).
