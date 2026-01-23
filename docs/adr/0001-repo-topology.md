# ADR 0001: Repository Topology

## Status

Accepted

## Context

Kaven ecosystem (CLI, Framework, Marketplace, Site) needs a repository structure that supports both public contribution and private intellectual property.

## Decision

We will split the codebase into:

1. **kaven-cli (Public)**: This repository. Apache-2.0. Contains the CLI tool, public templates, and community docs.
2. **kaven-platform (Private)**: Contains the core framework, marketplace backend, and SaaS infrastructure.

## Consequences

- **Pros**: Clear separation of concern. Allows community to build tools/modules for the CLI without exposing core business logic.
- **Cons**: Need to sync shared types or contracts (solved via npm packages or git submodules if needed).
