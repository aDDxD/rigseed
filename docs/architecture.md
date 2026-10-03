# Architecture

The CLI parses six commands, discovers targets and prints a complete plan before
confirmation. `src/commands/run.ts` coordinates operations; provider-specific
knowledge lives in `src/providers/codex`. There is one real provider and no generic
framework. A future provider can add discovery, desired files and validation next
to Codex, then route command orchestration to that implementation.

`src/config/preset.ts` describes intent separately from installation. Model IDs and
efforts are checked against the installed Codex bundled catalog. Templates live
outside executable code and are included in the npm package. Root config values
are constructed declaratively; agent TOML and instruction Markdown are templates.

The provider builds desired files. Managed Markdown has one stable, validated block;
only its body changes. TOML uses a real parser and structural leaf-key ownership.
Unknown user values survive. Differing unowned values and edits to owned values
are conflicts. Diff can inspect these conflicts without making them writable.
TOML serialization changes formatting/comments when structural changes occur;
unchanged input is returned verbatim. Existing equal keys remain unowned.

State is one JSON file per normalized target path under XDG state, recording only
ownership metadata and owned values. Global and project targets are distinct.
There is no repository search, account state, secrets store or cloud synchronization.
Loss of state reduces what uninstall can safely remove; it never guesses ownership.
Records and permitted file/key paths are validated before mutations.

Application preflights every file, acquires an exclusive local lock, checks that
files have not changed since planning, creates private timestamped backups, and
uses sibling temporary files plus atomic rename. Failure rolls back applied files
unless a concurrent edit would be overwritten. The backup manifest includes state
and original destination paths; absent originals are explicitly recorded. No-op
operations do not write state or create backups. Symlinks are refused. Multi-file
atomicity across crashes is not guaranteed: backups provide manual recovery.

`setup` owns the global defaults and agents. Normal `init` adds only a project
Markdown block and requires a healthy global setup. Portable `init` creates local
config/agents and does not depend on global definitions. Git detects project roots;
Codex trust and precedence are respected rather than modified by this tool.
Update/diff/uninstall operate on the global and current registered project by default;
selectors can limit the target. No daemon or auto-update is involved.

Unit tests cover merge safety. Command integration tests execute the packaged CLI
logic with temporary HOME/CODEX_HOME/XDG state and a controlled model catalog.
Real-Codex integration uses a temporary HOME and never starts model inference.

## User choices

`src/config/user.ts` validates strict, versioned JSON input (see
`config.schema.json` and `examples/rigseed.json`). `wizard.ts` offers only listed
catalog models and each selected model's supported efforts. There is no new
provider, preset marketplace or generic configuration engine.

Resolved choices are persisted in target state, separate from ownership. The
first setup in a terminal runs the wizard; `--interactive` revisits choices.
`--yes` selects supplied JSON, saved choices or defaults without asking.
Update resolves saved choices for each global/portable target. Regular projects
inherit the global target's settings. A missing recommended default model does
not prevent use of explicit supported choices.

An unowned scalar TOML conflict can be adopted only after an explicit terminal
confirmation. Consent includes the exact original value and file; planning
rechecks it, the transaction backs it up, and ownership stores the original for
uninstall restoration. Tables, arrays and unusual value types cannot be adopted
through this shortcut. `--yes` and dry-run never provide adoption consent.
Edited owned TOML values remain protected even during interactive setup.
