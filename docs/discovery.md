# Discovery decisions

Inspected on 2026-10-02. The Codex executable reports `codex-cli 0.160.0`.
Its local help exposes `debug models --bundled` and `doctor --json`; the
app-server protocol is experimental and is not an installer dependency.

## Evidence used

- The bundled model catalog contains `gpt-6-astra` and `gpt-6.1-sol` with
  `medium`, and `gpt-6-luna` with `max` as its highest advertised effort.
  The existing model cache agrees. Only model metadata was inspected;
  credentials and session histories were not read.
- Official current documentation describes standalone global and project
  agent TOML files, required agent fields, model/effort precedence and
  `agents.max_concurrent_threads_per_session`.
- The official schema confirms that `agents.max_depth` is V1-only and
  `features.multi_agent_v2` can take precedence over `agents.enabled`.
  Thus a leaf agent disables both settings and also prohibits spawning in
  its instructions. The preset explicitly selects V1 and configures depth 2;
  a live hierarchy guarantee is not claimed.
- No configuration schema file was found in the installed package.
  The published schema is useful evidence, but not a version-pinned runtime
  validator. The MVP therefore limits support to 0.160.x and reads the
  installed model catalog rather than assuming model aliases or effort enums.

## Isolated Codex experiments

Experiments used temporary HOME and CODEX_HOME, no credentials, and an empty
working directory. Global user files were not changed.

`codex doctor --json` returns `schemaVersion: 1` and a checks map.
`checks["config.load"]` has `status`, `summary` and `details`. Valid config
loads with status `ok`; invalid TOML fails; unknown top-level keys and malformed
agent definitions produce startup warnings. Exit status may still be nonzero
because authentication is absent, independently of configuration validity.

`--strict-config` is accepted by doctor but does not reject an arbitrary
nonempty reasoning string. Catalog checking is necessary. The flag is rejected
by `features` and `debug`. Doctor also probes authentication and network
reachability, so it is not used as a routine no-credentials configuration
parser against the real home. The isolated valid agent test included
`agents.enabled = false` and `features.multi_agent_v2 = false`; config loading
reported no warnings. A second test included root and Sol with V1, enabled
delegation, depth 2, concurrency 4, and Luna with disabled delegation. Both
standalone files loaded without warnings. No inference was started.

For current provider details and primary sources, see [codex.md](codex.md).

## Stack and repository

The directory initially had no files or Git repository; a local Git repository
was initialized. Node 24.18.0 (LTS), npm 11.16.0 and Codex 0.160.0 were available.
The user installed pnpm 12.8.1 during development; it is now the package manager
and pnpm-lock.yaml is the only lockfile. TypeScript 6.0.3 was chosen because the
current typescript-eslint 8.71.0 supports TypeScript below 6.1; TypeScript 7 was
not forced past that peer constraint. Commander, smol-toml and diff are the only
runtime dependencies. Node's stable test runner and readline provide testing and
confirmation without extra runtime libraries.

A real-HOME setup dry-run detected an existing conflicting model and refused to
write. Hashes of the managed destination files remained unchanged. The actual
user setup was not installed or migrated.

ESLint 10.11.0 was retained instead of the just-published 10.12.0 to comply
with pnpm's active minimum-release-age policy. A frozen-lockfile installation
was verified after resolving the lockfile with pnpm.

## Validation results

- A clean source copy installed with `pnpm install --frozen-lockfile`; lint,
  typecheck, build and all **39 tests** passed after customization was integrated.
- `pnpm pack` included templates, bilingual READMEs, example JSON and JSON Schema;
  tests, node_modules, backups and state were excluded. The local tarball ran
  version, setup, doctor, repeated setup and uninstall using the real Codex in a
  temporary HOME. Nothing was published or installed globally.
- A real pseudo-terminal exercised first setup, catalog model/effort selection,
  explicit conflict adoption, saved choices, interactive reconfiguration and
  cancellation. Uninstall restored the adopted original model and preserved
  unrelated user settings and Markdown.
- Generated files with valid existing user profiles loaded through native Codex
  `--strict-config doctor --json` with `config.load: ok`. A separate unknown-key
  fixture loaded with a warning, as expected. No billable inference was started.
- A customized portable project was cloned into an independent temporary
  environment, registered with the same JSON input and passed doctor without
  changing the versioned project files or requiring global setup.
- Hash snapshots confirmed diff and dry-run left target files, state and backups
  unchanged. Unit tests cover unsafe markers, ownership corruption, conflicts,
  preservation, backup permissions, locking and partial-failure rollback.
- A real-HOME setup dry-run refused the existing conflicting model. Managed
  destination/state/backup snapshots stayed unchanged. No real-HOME setup occurred.
- Local Markdown links were checked. Source and packed contents were inspected
  for machine home paths, credential patterns and unintended generated files;
  no findings. This inspection is not a formal security audit.
