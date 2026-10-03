# First release checklist / Checklist do primeiro lançamento

The source is being prepared for public use. This checklist does not publish a
repository or a package. Version 0.1.0 is still unreleased.

GitHub: [aDDxD/rigseed](https://github.com/aDDxD/rigseed), public repository created.
Package: `@addxd/rigseed`; npm login `addxd` verified on 2026-10-03.
The npm registry returned E404 for the package on that date. The GitHub
repository is currently empty; the first push and hosted CI are still pending.
GitHub login is configured, but the first push was rejected because OAuth lacks
the workflow scope. Refresh that scope before retrying. Private vulnerability
reporting is enabled; repository description and topics are configured.

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
- [ ] Push the reviewed source and first commit to the public repository.
- [x] Enable GitHub private vulnerability reporting so SECURITY.md has a usable channel.
- [ ] Run the existing CI on GitHub; it does not publish packages.

## Before publishing npm manually

- [x] Confirm control of the npm scope `@addxd` or choose an owned package name.
- [x] Confirm the selected package is not present in the npm registry (E404; recheck before publishing).
- [x] Keep the confirmed package name consistent in metadata and both READMEs.
- [x] Inspect `pnpm pack` contents and perform a final local tarball smoke test (2026-10-03).
- [ ] Review npm account security, package access and the manual publication command.
- [ ] Publish only after an explicit maintainer decision; no release automation or secrets.
- [ ] After success, update the unpublished notice and changelog to reflect the actual release.

## Resumo em português

O repositório público `aDDxD/rigseed` foi criado e os links foram preenchidos.
O login npm `addxd` foi confirmado; o pacote ainda não foi publicado. Faltam o
primeiro push e a CI no GitHub. Reports privados de segurança foram habilitados.
O push exige conceder o escopo workflow ao login do GitHub.
Antes do npm, revise a segurança da conta, valide o tarball e publique somente
por decisão explícita. A verificação local integrada está em `discovery.md`.

Use [the reusable release guide](publishing.pt-BR.md) for publication and future versions.
