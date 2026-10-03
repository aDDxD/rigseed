// Intent only: concrete model identifiers and effort are resolved from Codex's catalog.
export const preset = {
  name: 'default',
  root: { family: 'astra', generation: '6', reasoning: 'medium' },
  agents: {
    sol_orchestrator: { family: 'sol', generation: '6.1', reasoning: 'medium', description: 'Technical lead for a scoped workstream; delegates bounded tasks to Luna.' },
    luna_worker: { family: 'luna', generation: '6', reasoning: 'highest', description: 'Bounded worker; never creates subagents.' },
  },
  maxConcurrentSubagents: 4, // One Sol plus approximately three Luna; session-wide, not per parent.
} as const;
