# Codex provider

This MVP supports Codex CLI **0.160.x**. Discovery was performed with 0.160.0
on 2026-10-02. Other versions fail closed until their configuration behavior is
reviewed. No Codex installation, authentication, or inference is performed.

```text
gpt-6-astra / medium       Root: objective, system decisions, final integration
  └── gpt-6.1-sol / medium sol_orchestrator: technical workstream lead
       ├── gpt-6-luna / max luna_worker: bounded task
       ├── gpt-6-luna / max luna_worker: bounded task
       └── gpt-6-luna / max luna_worker: bounded task
```

The identifiers and reasoning levels above were present in the installed
binary's `codex debug models --bundled` catalog. The CLI resolves the preset
against that catalog on each run. A catalog entry proves client support,
**not** availability to the signed-in account or successful inference.

Astra maintains the overall objective and delegates substantial technical
work to Sol. Sol owns its assigned workstream, reviews and integrates worker
results, and escalates changes to global architecture or scope. Luna executes
specified tasks and reports ambiguities instead of deciding broad architecture.

The preset explicitly selects the V1 backend (`features.multi_agent_v2 = false`)
and sets `agents.max_depth = 2`, allowing the two intended delegation edges.
An existing conflicting V2 selection is a conflict, not silently overwritten.
The default configured limit is four concurrently open spawned threads, excluding the
primary: a budget intended for one Sol plus three Luna workers. This is a
session budget, not a separate allowance for every Sol. The three-worker rule
and role hierarchy are also explicit instructions; they are not a scheduler.
Parallel reads are encouraged. Parents assign exclusive file ownership for
parallel writes; overlapping writes are serialized and the parent integrates.

## Files and precedence

Global configuration uses `$CODEX_HOME`, or `~/.codex` when unset. Standalone
agent TOML files contain `name`, `description`, `developer_instructions`, `model`
and `model_reasoning_effort`. Agent definitions are discovered in `agents/`;
there is no need to duplicate role registrations in `config.toml`.

`setup` manages the global root defaults, agent definitions and AGENTS policy.
`init` adds only a managed project AGENTS block and relies on global agents.
`init --portable` additionally creates `.codex/config.toml` and local agent
definitions. Project configuration requires Codex to trust the repository.
The tool does not modify that trust decision. CLI overrides, selected profiles,
and administrator policies can affect the effective behavior.

Custom agent files explicitly set both model and effort; Codex applies those
values after resolving spawn arguments, agent defaults and parent settings.

## Limits of verification

- Luna disables `agents.enabled` and `features.multi_agent_v2`, and its
  instructions prohibit delegation. The latter feature can override the former
  when enabled; both settings matter. This configuration is checked, but a live
  Luna tool surface is not exercised by the installer.
- `agents.max_depth` applies only to the selected V1 backend; V2 ignores it.
  Role selection and the exact Astra → Sol → Luna chain remain instructions,
  rather than a hard-coded runtime routing graph.
- Existing V2 feature overrides can change concurrency or delegation behavior.
  The doctor distinguishes configured policy from runtime guarantees.
- Doctor verifies managed fields and TOML syntax, not every unmanaged setting
  through the complete Codex runtime loader. Administrator policies, profile
  selections and CLI overrides require runtime review.
- No billable sessions are launched to test nested delegation, account access
  or model reasoning. Installed files and supported values are verifiable;
  end-to-end Astra → Sol → Luna execution remains a user session check.

Sources: [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference),
[configuration schema](https://learn.chatgpt.com/docs/config-schema.json),
[precedence](https://learn.chatgpt.com/docs/config-file/config-basic#configuration-precedence).

## Customization

Rigseed offers models and efforts from the installed bundled catalog. The table
above is the recommended preset, not a requirement. `setup --interactive` or a
strict JSON file can choose different models for the root, `sol_orchestrator`
and `luna_worker`. Role names remain stable for delegation; template instructions
refer to roles and do not pretend that a selected model is Astra, Sol or Luna.

The session-wide budget is configurable from 2 to 8; the default remains 4.
Templates derive the worker budget from the selected limit (one technical lead
plus up to limit-minus-one workers). This is policy, not a per-parent scheduler.
Saved concrete reasoning values are reused by update. An explicit JSON value
`highest` is resolved against known ordered reasoning names in the local catalog;
unfamiliar names require explicit selection instead of guessing their rank.

Portable Codex files can be used directly after cloning, subject to project trust.
To register a customized clone with Rigseed, supply the same JSON choices again
or select matching values interactively. State is local, so Rigseed does not
infer a custom desired setup from arbitrary existing Codex files.
