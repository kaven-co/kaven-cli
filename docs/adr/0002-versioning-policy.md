# ADR 0002: Versioning Policy

## Status

Accepted

## Context

We need a consistent way to version the CLI tool to manage compatibility and expectations.

## Decision

We will adhere to [Semantic Versioning 2.0.0](https://semver.org/).

- **Major (X.y.z)**: Breaking changes to CLI commands or configuration formats.
- **Minor (x.Y.z)**: New features (backward compatible).
- **Patch (x.y.Z)**: Bug fixes.

### Pre-release

We will use `alpha` and `beta` tags for pre-releases.

- `0.1.0-alpha.0` -> First alpha.

## Consequences

- Users can rely on version numbers to know when to upgrade.
- CI pipelines can automatically publish pre-releases.
