<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Anarchitecture Bricks Overlay

- Apply the Bricks README-First Overlay first.
- Prioritize public package contracts from `@anarchitects/*` and avoid internal path imports.
- Keep Angular layering strict: `ui <- feature -> state -> data-access` with `config` and `util` shared.
- Keep Nest layering strict: `presentation -> application <- infrastructure` with `config` and `util` shared.
- Favor root facade entry points for quick starts, then use secondary entry points for advanced composition.
- Keep OpenAPI/Storybook/docs generation flows aligned with package changes.

## Angular Packages Overlay

- Apply the Bricks README-First Overlay first for every `@anarchitects/*-angular` package you import.
- Compose features using published Angular packages such as `@anarchitects/forms-angular` and `@anarchitects/auth-angular`.
- Keep state explicit via provider helpers; avoid implicit global singletons for domain stores.
- Use generated or typed domain contracts from `@anarchitects/*` TS libraries for request/response boundaries.
- Keep presentational concerns in UI packages and orchestration in feature/state layers.

## Nest Packages Overlay

- Apply the Bricks README-First Overlay first for every `@anarchitects/*-nest` package you import.
- Start with facade modules from packages such as `@anarchitects/forms-nest` or `@anarchitects/auth-nest`.
- Use secondary entry points only when explicit overrides are needed.
- Keep route schemas sourced from shared DTO packages and avoid inline schema drift.
- Preserve infrastructure boundaries and keep cross-domain persistence relations scalar at runtime.
