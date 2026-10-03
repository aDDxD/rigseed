# First release checklist / Checklist do primeiro lançamento

Historical record of the first release, completed on 2026-10-03. This checklist
is retained for reference; future versions follow the reusable release guide.

GitHub: [aDDxD/rigseed](https://github.com/aDDxD/rigseed).
npm: [@addxd/rigseed@0.1.0](https://www.npmjs.com/package/@addxd/rigseed), published
at 2026-10-03T18:59:42Z and confirmed accessible through the registry and npx.
The published tarball checksum and contents match commit `ed15b07`.
GitHub CI passed installation, lint, typecheck, 39 tests and build.
Private vulnerability reporting is enabled; description and topics are configured.

## Repository and user documentation

- [x] MIT license included; package declares the same license.
- [x] English README with linked Brazilian Portuguese translation.
- [x] Explain that package installation does not apply Codex configuration.
- [x] Explain global, regular-project and portable-project flows.
- [x] Document customization, declarative input and noninteractive safety.
- [x] Document supported versions, backups, TOML formatting loss and runtime limits.
- [x] Contribution guide, security policy, changelog and small issue/PR templates.
- [x] No fake repository links, download badges or claims of npm availability.
- [x] Review the integrated implementation and documentation for consistency.

## Product verification

- [x] Clean frozen-lockfile installation; lint, typecheck, tests and build pass.
- [x] Test packed CLI using a local tarball without npm publication.
- [x] Test interactive selection/reconfiguration and explicit conflict adoption.
- [x] Test JSON input, saved choices, unsupported values and unknown-field refusal.
- [x] Test temporary-HOME setup/doctor/repeat-setup idempotence.
- [x] Test existing user config, Markdown, portable clone, update and uninstall restoration.
- [x] Confirm dry-run/diff leave files, ownership state and backups unchanged.
- [x] Inspect package contents and tracked source for credentials, personal paths,
      local state, backups and unnecessary generated files.

## GitHub publication

- [x] Choose GitHub repository owner/name; create an empty public repository manually.
- [x] Review the initial source and history for sensitive data; local repository starts with a reviewed first commit.
- [x] Add real repository metadata/links after the URL exists.
- [x] Push the reviewed source and first commit to the public repository.
- [x] Enable GitHub private vulnerability reporting so SECURITY.md has a usable channel.
- [x] Run the existing CI on GitHub; it does not publish packages.

## npm publication

- [x] Confirm control of the npm scope `@addxd` or choose an owned package name.
- [x] Confirm the selected package is not present in the npm registry (E404; recheck before publishing).
- [x] Keep the confirmed package name consistent in metadata and both READMEs.
- [x] Inspect `pnpm pack` contents and perform a final local tarball smoke test (2026-10-03).
- [x] Complete interactive npm authentication and verify public package access.
- [x] Maintainer published 0.1.0 manually; no release automation or repository secrets.
- [x] After success, update the GitHub READMEs and changelog to reflect the release.
- [x] Verify published package commands in temporary HOME, preserving existing user files.
- [x] Push tag v0.1.0 pointing to the exact published commit ed15b07.

## Resumo em português

Primeiro lançamento concluído. Código público, CI verde e versão 0.1.0 disponível
no npm. O pacote distribuído foi testado com os seis comandos em HOME temporário,
incluindo init normal/portable, idempotência e preservação no uninstall.
O artefato corresponde ao commit `ed15b07`; a documentação atualizada está no GitHub.
O tarball npm é imutável e conserva os documentos do momento da publicação:
correções posteriores nesses documentos entram no pacote de uma versão futura.
A configuração real do usuário não foi alterada durante a validação.

Use [the reusable release guide](publishing.pt-BR.md) for future versions.
