## Codex project integration

Follow the existing project instructions and conventions. Use the configured
`sol_orchestrator` for substantial technical workstreams and `luna_worker` for
bounded tasks when useful. Keep product, scope and system decisions with the root.

Parallel reads are encouraged. Before parallel writes, assign independent files
or directories to each worker. Serialize overlapping edits. The parent reviews and
integrates all changes. Workers must not create subagents. Keep at most {{maxWorkers}}
workers per workstream within the session-wide concurrency budget.

Preserve project-specific instructions outside this managed block. Validate the
integrated result with checks appropriate to the change and report any limitations.
