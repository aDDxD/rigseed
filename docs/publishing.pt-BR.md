# Publicar o Rigseed

Guia para o mantenedor. A publicação é manual; a CI executa checks e não publica.
Instalar ou publicar o pacote não aplica configuração do Codex.

## Estado em 2026-10-03

- Repositório público criado: [aDDxD/rigseed](https://github.com/aDDxD/rigseed).
- Metadados do pacote, links e instruções de clone preenchidos.
- Login npm `addxd` confirmado; nome do pacote: `@addxd/rigseed`.
- O registry retornou E404; a versão 0.1.0 ainda não foi publicada.
- O remote local `origin` aponta para o repositório informado.
- Fonte revisada e primeiro commit preparados localmente, com validação do pacote.
- Primeiro push, CI hospedada, autenticação do GitHub CLI e configuração do
  canal privado de segurança ainda precisam ser concluídos.

## 1. Validar localmente

Na raiz do clone:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
npm publish --dry-run --access public
```

O último comando não publica, mas executa os scripts de preparação. Confira a
lista: código compilado, templates, exemplos e docs; sem credenciais, state,
backups, testes ou node_modules. MIT e acesso público já estão configurados.
Adicionar links ao package.json não exige alterar o lockfile. Se o nome ou as
dependências mudarem, atualize-o com `pnpm install --lockfile-only`.

## 2. Testar o pacote sem publicação

```bash
rigseed_pack_dir=$(mktemp -d)
pnpm pack --pack-destination "$rigseed_pack_dir"
rigseed_tarball="$rigseed_pack_dir/addxd-rigseed-0.1.0.tgz"
tar -tzf "$rigseed_tarball"
npx --yes --package "$rigseed_tarball" rigseed --help
```

Para testar setup sem atingir sua configuração real, use um diretório temporário
e Codex 0.160.x já instalado no PATH:

```bash
rigseed_test_dir=$(mktemp -d)
env HOME="$rigseed_test_dir/home" \
  CODEX_HOME="$rigseed_test_dir/home/.codex" \
  XDG_STATE_HOME="$rigseed_test_dir/state" \
  npx --yes --package "$rigseed_tarball" rigseed setup --yes

env HOME="$rigseed_test_dir/home" \
  CODEX_HOME="$rigseed_test_dir/home/.codex" \
  XDG_STATE_HOME="$rigseed_test_dir/state" \
  npx --yes --package "$rigseed_tarball" rigseed doctor --global
```

Repita o setup com as mesmas variáveis: espere `No changes required.`.
O `--yes` do npx aceita executar o pacote; o `--yes` do Rigseed aceita aplicar
o plano seguro. Nenhum deles autoriza sobrescrever conflitos.

## 3. Enviar o código ao GitHub

Autentique-se pelo fluxo do GitHub CLI, sem colocar tokens no repositório:

```bash
gh auth login
git add .
git diff --cached --stat
git diff --cached
```

Revise os arquivos e a identidade de autoria antes de confirmar o commit. Se
precisar ajustar a identidade, use configuração local do repositório; não é
necessário alterar o Git global. Depois:

```bash
git commit -m "Prepare Rigseed 0.1.0"
git push -u origin main
```

Se o primeiro commit já estiver preparado e `git status --short` estiver vazio,
não é necessário fazer outro commit: autentique-se e execute apenas o push.

O remote já está configurado. Espere a [CI](https://github.com/aDDxD/rigseed/actions)
ficar verde. Confira os READMEs no GitHub e habilite private vulnerability
reporting nas configurações de segurança, conforme SECURITY.md.

## 4. Preparar e publicar 0.1.0

Antes de gerar o pacote definitivo, prepare os dois READMEs com as instruções
de npm publicadas e ajuste o changelog para a versão/data do lançamento.
Repita a validação e teste esse pacote final. Commit e push dessas alterações;
publique somente depois de a CI correspondente passar.

Na conta npm, confirme e-mail, 2FA e meios de recuperação. Confira login, versão
e working tree limpa:

```bash
npm whoami
npm view @addxd/rigseed version
git status --short
npm publish --dry-run --access public
```

E404 significa que o registry não encontrou o pacote acessível à conta atual;
não trate erros de conexão ou autenticação como disponibilidade do nome.
Depois da decisão explícita de publicação:

```bash
npm publish --access public
```

**Esse comando publica de verdade.** Complete a autenticação solicitada.
Não guarde códigos, tokens ou configuração de autenticação no Git.

## 5. Conferir a distribuição

```bash
npm view @addxd/rigseed@0.1.0 version
npx @addxd/rigseed@0.1.0 --version
npx @addxd/rigseed@0.1.0 --help
```

Esses comandos não aplicam configuração. Para validar o setup publicado,
repita o teste com HOME/CODEX_HOME/XDG_STATE_HOME temporários, usando agora
`npx @addxd/rigseed@0.1.0` no lugar do tarball local.

Após confirmar sucesso, marque o commit exato publicado:

```bash
git tag -a v0.1.0 -m "Rigseed 0.1.0"
git push origin v0.1.0
```

Uma GitHub Release é opcional. Atualize o [checklist](public-readiness.md) com
os resultados reais. Versões npm publicadas não são sobrescritas: correções
exigem uma nova versão.

## Fontes

- [Publicar pacotes públicos com namespace](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
- [Autenticação para publicação](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).
- [Enviar código local ao GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
