# Security / Segurança

## Supported version

The initial 0.1.x line is the only supported rigseed line. Codex support currently
covers 0.160.x. Older or newer Codex versions are not claimed compatible.

## Report a vulnerability

Do not publish secrets, real configuration dumps, ownership state or backups in an
issue or pull request. Reports that concern accidental overwrites, unsafe paths,
credential exposure or bypassing ownership checks should be private.

On [GitHub Security](https://github.com/aDDxD/rigseed/security), use
**Report a vulnerability** if private vulnerability reporting is enabled.
Until a private channel is configured,
do not post exploit details publicly; ask the maintainer to enable one through a
public issue containing only the request for a private contact channel.

Include affected versions, a reproduction using synthetic files in a temporary
HOME, expected behavior and observed impact. There is no guaranteed response SLA.

## Safety boundaries

rigseed does not read credential files, send telemetry or install Codex. It reads
and updates configuration, so local configuration backups may still contain sensitive
settings. Keep backups private. `--yes` does not bypass ownership conflicts.

Atomic writes and rollback reduce accidental damage; they are not a transactional
filesystem or protection against a malicious process modifying files simultaneously.
File/catalog checks do not prove account access or agent behavior in live sessions.

## Português

Reporte vulnerabilidades de forma privada. Não envie tokens, configurações reais,
state ou backups. No GitHub, use **Security → Report a vulnerability**, quando
habilitado. Se ainda não houver canal privado, abra somente uma solicitação para
habilitar contato privado, sem detalhes do exploit. Use arquivos fictícios em HOME
temporário na reprodução. Não há SLA de resposta garantido.
