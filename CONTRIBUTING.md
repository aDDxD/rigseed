# Contributing / Contribuindo

Contributions and reports in English or Portuguese are welcome. Start with the
[README](README.md) / [README em português](README.pt-BR.md) and [architecture](docs/architecture.md).

## Scope

Keep the CLI small, readable and safe. Codex is the only implemented provider.
Discuss changes to supported providers, commands or ownership behavior before
building them. Do not add publication automation, telemetry or background services.

## Local workflow

Use Node.js 24+ and pnpm 12.8.1:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Use temporary HOME, CODEX_HOME, XDG_STATE_HOME and Git repositories for installer
tests. Never test setup, update or uninstall against your actual configuration.
See existing command tests for fixtures. Use `diff` or `--dry-run` for real-environment
inspection; do not post their output without reviewing it for sensitive details.

For file-management changes, cover preservation, conflicts, idempotence and failure
recovery. Check unsupported models/efforts and noninteractive behavior when changing
configuration selection. Verify Codex capabilities from local supported discovery
or official documentation; do not infer model IDs or config syntax.

Keep templates separate from mechanics. Preserve unknown user settings and Markdown
outside managed markers. Update both README languages when user-visible behavior
changes; English technical documentation is acceptable for smaller internal details.

## Reports and pull requests

Use the repository's [issues](https://github.com/aDDxD/rigseed/issues) for bug
reports and feature proposals, and [pull requests](https://github.com/aDDxD/rigseed/pulls)
for contributions. Security reports follow the private process below.

Use a minimal reproduction with fake configuration, the rigseed/Node/Codex versions,
and expected/actual behavior. Do not include tokens, real config dumps, state or backups.
A pull request should explain the problem, resulting behavior and validation run.
Keep changes focused; no need to pursue a coverage percentage or introduce frameworks.

Contributions are made under the repository's [MIT license](LICENSE). For security
reports, follow [SECURITY.md](SECURITY.md) instead of a public issue.

## Resumo em português

Use pnpm e rode lint, typecheck, testes e build. Teste sempre em diretórios temporários,
nunca no seu Codex real. Preserve configurações e instruções sem ownership. Mantenha
os dois READMEs alinhados. Reports precisam de reprodução mínima sem dados sensíveis;
PRs devem explicar problema, comportamento final e validação. Para vulnerabilidades,
leia SECURITY.md antes de abrir uma issue pública.
