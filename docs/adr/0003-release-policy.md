# ADR 0003: Release Policy

## Status

Accepted

## Context

We need to define how code moves from development to production (npm).

## Decision

1. **Main Branch**: Always deployable, contains the latest development code.
2. **Releases**: Triggered by git tags (e.g., `v0.1.0`).
   - Pushing a tag triggers the CI/CD pipeline to build and publish to npm.
3. **npm Tags**:
   - `latest`: Stable releases.
   - `next`: Alpha/Beta releases.

## Consequences

- No manual publishing from developer machines.
- Traceability between git tags and npm versions.
