# Working on rigseed

This repository is the source for Rigseed, a small open source CLI for reproducible coding-agent configuration.
The initial product supports only Codex. Do not add other providers, commands, background
services, telemetry or publication automation without an explicit requirement.

## Structure

- `src/cli.ts`: command-line arguments and entry point.
- `src/commands/`: target selection, previews and command orchestration.
- `src/providers/codex/`: Codex discovery, desired files and structural merge.
- `src/config/`: declarative intent, validation, model-selection wizard and metadata.
- `src/utils/`: managed Markdown, safe filesystem operations, state and backups.
- `templates/codex/`: instructions and agent definitions distributed by the CLI.
- `tests/`: unit, command integration and filesystem safety tests.
- `docs/`: architecture, confirmed Codex behavior and discovery evidence.

Keep desired configuration separate from installation mechanics. Prefer small,
readable modules over speculative provider frameworks.

## Safety

Never test setup, update or uninstall against the user's actual Codex directory.
Use temporary HOME, CODEX_HOME and XDG_STATE_HOME and temporary Git repositories.
Real-environment inspection may use diff or dry-run. Applying configuration to
the real environment requires an explicit user request.

Preserve unowned configuration and Markdown outside managed markers. Refuse
ambiguous markers and edited owned TOML values. Unowned conflicts require explicit
interactive adoption of the exact current value, with backup and original-value
restoration; otherwise refuse them. `--yes` must
never imply permission to overwrite conflicts. Dry-run and diff must not write
target configuration, ownership state or backups.

Do not read credentials, log configuration secrets, publish packages or change
shell profiles, global Git settings or system configuration during development.
Verify Codex model IDs, reasoning, paths and agent syntax from supported local
capabilities and official documentation. Distinguish file validation from live
runtime guarantees.

## Validation

Use pnpm; commit `pnpm-lock.yaml` and keep generated `dist/` and `node_modules/`
out of version control. Build the CLI before invoking `node dist/src/cli.js`.

For code changes, run the relevant checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

File-management changes need tests for preservation, conflicts, idempotence and
failure recovery. Keep README and provider documentation aligned with behavior.
Assign nonoverlapping file ownership when using subagents; serialize overlapping
edits and review the integrated result.

This file guides development of this repository. The files under `templates/`
are installation inputs; editing them does not apply configuration anywhere.
