# Design Documentation

This folder is the implementation blueprint for the civic issue reporting platform.

Each document owns a different part of the system:

- [`api-design.yml`](./api-design.yml): source of truth for the external HTTP contract
- [`dbDesign.md`](./dbDesign.md): source of truth for the relational data model and cross-table relationships
- [`userflow.md`](./userflow.md): source of truth for citizen, institution, and async worker journeys
- [`constraints.md`](./constraints.md): non-functional rules covering privacy, moderation, ranking, AI, and operations
- [`features.md`](./features.md): scope split into v1, later, and aspirational capabilities
- [`databaseFeatures.md`](./databaseFeatures.md): inventory of what is persisted, derived, and considered sensitive

## How To Use These Docs

- Start with `features.md` to understand product scope.
- Use `userflow.md` to map the end-to-end experience for each actor.
- Implement HTTP routes from `api-design.yml`.
- Implement tables, views, and policies from `dbDesign.md` and `databaseFeatures.md`.
- Validate technical decisions against `constraints.md` before changing privacy, ranking, or AI behavior.

## Rendering Notes

Some files use Mermaid diagrams. To preview them locally, install Mermaid support in your editor or add Mermaid as a dev dependency.

```bash
pnpm install mermaid --save-dev
```
