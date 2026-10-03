# Rigseed

[Português (Brasil)](README.pt-BR.md)

[npm](https://www.npmjs.com/package/@addxd/rigseed) · [Source](https://github.com/aDDxD/rigseed) · [Issues](https://github.com/aDDxD/rigseed/issues) · [Contributing](CONTRIBUTING.md)

A small TypeScript CLI for reproducible **Codex CLI** configuration. Keep agent
roles and policies versioned, choose models and reasoning efforts, and apply only
the parts that rigseed owns. No other providers are implemented.

**Status:** version 0.1.0 is published as `@addxd/rigseed`. There is no automatic publication, telemetry, daemon or
installation hook.

## What it changes

Installing the package does **not** configure Codex or create project files.
You explicitly choose an operation:

| Command | Purpose |
| --- | --- |
| `setup` | Configure the user's Codex directory and global agents. |
| `init` | Add a managed policy block to the current Git project's `AGENTS.md`. |
| `init --portable` | Include project-local configuration and agent definitions. |
| `doctor` | Check installed files, model catalog, managed markers and drift. |
| `diff` | Show managed differences without writing anything. |
| `update` | Update managed policies/configuration using saved choices. |
| `uninstall` | Remove owned content; preserve everything else. |

A project's own `AGENTS.md` rules stay outside the managed block. You may also
use only global `setup` and maintain project instructions yourself, without `init`.

## Requirements and quick start

- Node.js 24 or later; development uses pnpm 12.8.1.
- Codex CLI **0.160.x** installed on `PATH`; rigseed does not install Codex.
- Git for project commands.

Run the published version without a global installation:

```bash
npx @addxd/rigseed@0.1.0 setup --dry-run
npx @addxd/rigseed@0.1.0 setup
npx @addxd/rigseed@0.1.0 doctor --global
# Inside a Git repository, optionally:
npx @addxd/rigseed@0.1.0 init
```

For development or direct use of the source, clone the repository:

```bash
git clone https://github.com/aDDxD/rigseed.git
cd rigseed
pnpm install --frozen-lockfile
pnpm run build
node dist/src/cli.js --help
node dist/src/cli.js setup --dry-run
node dist/src/cli.js setup
node dist/src/cli.js doctor --global
```

`setup` changes your user configuration. Preview first. First-time setup in a
terminal offers model and effort choices, then a plan and confirmation. Noninteractive
runs require `--yes`; it never authorizes overwriting conflicting user settings.

To exercise the packaged binary locally without publishing:

```bash
package_dir=$(mktemp -d)
pnpm pack --pack-destination "$package_dir"
npx --package "$package_dir/addxd-rigseed-0.1.0.tgz" rigseed --help
```

`rigseed` below means the installed binary; with the clone, use
`node /path/to/rigseed/dist/src/cli.js` instead. A global npm installation is
optional and independent of global Codex configuration.

## Choose your models

The default role policy is:

```text
Astra / medium                     global supervisor
  └── Sol / medium                 technical lead for one workstream
       ├── Luna / highest          bounded worker
       ├── Luna / highest          independent worker
       └── Luna / highest          independent worker
```

For the supported catalog: root `gpt-6-astra`, orchestrator `gpt-6.1-sol`, worker
`gpt-6-luna`; Luna's highest supported effort is `max`. These are defaults, not
requirements: choose other catalog models and supported efforts during setup.
The role names `sol_orchestrator` and `luna_worker` remain stable even if you
choose different models.

```bash
rigseed setup                      # First setup: interactive choices in a TTY
rigseed setup --interactive        # Explicitly revise saved choices
rigseed setup --config examples/rigseed.json --dry-run
rigseed setup --config examples/rigseed.json --yes
rigseed update --config examples/rigseed.json --dry-run
```

[The JSON example](examples/rigseed.json) and [JSON Schema](docs/config.schema.json) is a declarative input, not a Codex
configuration file. It contains only models, efforts and a session-wide subagent
limit. Unknown fields and unsupported choices are rejected; do not put tokens or
MCP settings in it. Choices are saved in local target state so `update`, `diff`
and `doctor` use your configuration rather than resetting to defaults.

`--yes` skips the wizard and uses supplied JSON, saved choices or defaults.
For unowned conflicts, interactive setup can offer an explicit replacement with
backup and original-value restoration on uninstall, or cancellation. `--yes`
never makes that decision. Edited owned TOML values still require reconciliation
before update/uninstall. `--preset default` is the only bundled preset.

## Global and project use

```bash
rigseed setup --dry-run
rigseed setup
cd /path/to/my-project
rigseed init --dry-run
rigseed init
```

```text
$CODEX_HOME/                       default: ~/.codex
  config.toml                     structural managed merge
  AGENTS.md                       managed policy block
  agents/*.toml                   global agent definitions

my-project/                       regular init
  AGENTS.md                       project rules + managed block
```

Regular `init` requires a valid global setup. It does not copy global agents or
create an empty `.codex/config.toml`. It detects the Git root even from a subdirectory.

For a project that carries its configuration:

```bash
rigseed init --portable --config /path/to/rigseed.json --dry-run
rigseed init --portable --config /path/to/rigseed.json
```

```text
my-project/
  AGENTS.md
  .codex/
    config.toml
    agents/
      sol_orchestrator.toml
      luna_worker.toml
```

Version these files to share the setup. A clone needs compatible Codex and project
trust; rigseed does not change trust settings. Ownership state stays local to
the machine: version the safe Rigseed JSON alongside a customized portable
setup, then run `init --portable --config ./rigseed.json` to register a clone.
For the unchanged default preset, `init --portable --yes` is sufficient. Existing matching TOML
values are not claimed. To change regular/portable mode, uninstall the project
target first, then initialize it again.

## Inspect, update and remove

```bash
rigseed diff --global
rigseed doctor --project
rigseed update --dry-run
rigseed update --yes
rigseed uninstall --project --dry-run
rigseed uninstall --project --yes
```

`update`, `diff`, `doctor` and `uninstall` inspect the global target and registered
current Git project. Use `--global` or `--project` to narrow the scope. They do not
scan other projects. Regular projects inherit global choices; `update --project
--config` is refused for them. Change global choices or use portable mode for
independent project settings. `diff` can show the proposed global setup before installation.

`setup`, `init`, `update` and `uninstall` support `--dry-run`: no target files,
ownership state or backups are written. `--help` and `--version` need no Codex.

Doctor distinguishes file/catalog checks (`✓`), runtime limits or manual review
(`!`) and problems (`✗`, exit code 1). It does not run inference or verify that your
account can access a model. A bundled model catalog is **not** account entitlement.

## Safety and backups

Markdown updates affect only this block:

```markdown
<!-- rigseed:start codex-orchestration -->
managed policy
<!-- rigseed:end codex-orchestration -->
```

Unpaired, duplicate or inconsistent markers cause refusal. TOML is parsed and
merged structurally; unowned settings such as MCPs, approvals, sandbox and profiles
are preserved. **A structural TOML change loses comments and formatting**, while
preserving values. An unchanged file remains byte-for-byte unchanged.

The CLI plans before writing, rejects symlink paths, uses a local lock, atomic
writes and rollback on partial failure. State and timestamped private backups live
under `$XDG_STATE_HOME/rigseed` (default `~/.local/state/rigseed`). State records
ownership and model choices; it does not copy the whole Codex configuration.
Backups of modified configuration can contain sensitive settings: keep them local.
Credential files are never read or copied.

Each backup has a `manifest.json` mapping copies to their original destinations.
For manual recovery, inspect that manifest and restore the relevant files/state.
`file: null` means the operation created a file; remove it only after checking for
later edits. There is no automatic restore command. Uninstall never deletes the
Codex directory, and without ownership state it does not guess what to remove.

## Known limits

- Only Codex 0.160.x is supported; newer versions require capability review.
- Multi-agent V1 uses depth 2 and a **session-wide** subagent budget (default 4,
  configurable from 2 to 8). This is not three reserved workers per orchestrator.
- Role instructions encourage routing; they do not guarantee it at runtime.
  Luna disables delegation controls and is instructed never to create subagents.
- Parallel writes require nonoverlapping ownership; parents integrate the result.
- File validation cannot establish live model access or effective delegation.

See [Codex details](docs/codex.md) and [architecture](docs/architecture.md).

## Development and contributing

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Tests use temporary HOME, CODEX_HOME, XDG state and Git repositories. Never test
installation against your actual user configuration. Read [CONTRIBUTING.md](CONTRIBUTING.md)
and [SECURITY.md](SECURITY.md) before submitting changes or reports.

## License and release readiness

[MIT](LICENSE): you can use, adapt and redistribute the project under the license
terms; keep its copyright and permission notice. The software is provided without
warranty. This does not grant access to OpenAI services or models.

The repository contains portable source/templates, not the author's home paths,
credentials or machine state. Public source and npm publication are separate
steps. The [public readiness checklist](docs/public-readiness.md) tracks the manual
work still needed before the first public release. No package or repository is
published automatically.
