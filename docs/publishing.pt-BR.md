# Publicar versões do Rigseed

Guia para quem mantém o projeto, reutilizável depois do primeiro lançamento.
A publicação é manual; a CI verifica o código e não publica. Publicar ou instalar
um pacote não aplica configuração do Codex.

## 1. Preparar a versão

Trabalhe no [repositório oficial](https://github.com/aDDxD/rigseed). Mantenha os
READMEs em inglês e português alinhados e registre mudanças no CHANGELOG.md.
Para uma atualização, incremente a versão sem criar commit ou tag automaticamente:

```bash
npm version patch --no-git-tag-version
pnpm install --lockfile-only
```

Use `minor` para uma versão com novas funcionalidades e `major` quando apropriado
para mudanças incompatíveis. Revise compatibilidade com atenção enquanto o projeto
estiver em 0.x. No primeiro lançamento, mantenha a versão inicial já escolhida.

Leia a versão e o nome diretamente do pacote para os próximos comandos:

```bash
rigseed_version=$(node -p "require('./package.json').version")
rigseed_package=$(node -p "require('./package.json').name")
```

Prepare a entrada do changelog com a data do lançamento. Antes da primeira
publicação, prepare também os READMEs para remover o aviso de pacote indisponível
na versão que será distribuída. Não registre sucesso no checklist antes de o
registry confirmar a publicação.

## 2. Validar e inspecionar

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
npm publish --dry-run --access public
```

O último comando não publica, mas executa os scripts de preparação. Confira que
há código compilado, templates, exemplos e docs, sem credenciais, state, backups,
testes ou node_modules. MIT e acesso público já estão configurados.

## 3. Testar o pacote local

```bash
rigseed_pack_dir=$(mktemp -d)
pnpm pack --pack-destination "$rigseed_pack_dir"
rigseed_tarball=$(find "$rigseed_pack_dir" -maxdepth 1 -name '*.tgz' -print -quit)
tar -tzf "$rigseed_tarball"
npx --yes --package "$rigseed_tarball" rigseed --version
npx --yes --package "$rigseed_tarball" rigseed --help
```

Para testar o setup, use Codex compatível no PATH e um ambiente temporário:

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

Repita o setup com as mesmas variáveis e espere `No changes required.`. Também
verifique diff, update e uninstall nesse ambiente, preservando fixtures com
configuração e Markdown existentes. Nunca use sua configuração real para testes.

## 4. Revisar o commit e esperar a CI

```bash
git add .
git diff --cached --stat
git diff --cached
git diff --cached --check
git commit -m "Prepare Rigseed release"
git push origin main
```

Revise os arquivos e a identidade de autoria antes do commit. Se precisar de
login, execute `gh auth login`. O envio de alterações em workflows exige o
escopo `workflow`; se o GitHub rejeitar o push por esse motivo, use
`gh auth refresh -h github.com -s workflow` e tente novamente.

Espere a [CI do commit que será publicado](https://github.com/aDDxD/rigseed/actions)
ficar verde. Não continue com checks pendentes ou falhos. Se corrigir arquivos,
refaça o pacote e a validação afetada. Trabalhe com a árvore limpa na publicação.

## 5. Publicar manualmente no npm

Confirme que sua conta npm está acessível, com e-mail verificado, 2FA e meios de
recuperação. Não coloque tokens ou códigos no Git. Confira o nome, a versão e se
ela já existe:

```bash
npm whoami
npm view "$rigseed_package@$rigseed_version" version
git status --short
npm publish --dry-run --access public
```

E404 indica que o pacote/versão não foi encontrado ou não está acessível à conta
atual. Não confunda erros de conexão ou autenticação com disponibilidade. Uma
versão já publicada não pode ser substituída; incremente-a para uma correção.

Somente após a decisão explícita de publicação:

```bash
npm publish --access public
```

**Esse comando publica de verdade.** Complete a autenticação solicitada pelo npm.

## 6. Conferir e marcar o lançamento

```bash
npm view "$rigseed_package@$rigseed_version" version
npx "$rigseed_package@$rigseed_version" --version
npx "$rigseed_package@$rigseed_version" --help
```

Esses comandos não aplicam configuração. Repita o teste de setup/doctor com
HOME, CODEX_HOME e XDG_STATE_HOME temporários usando o pacote publicado.
Depois, marque o commit exato do pacote distribuído:

```bash
git tag -a "v$rigseed_version" -m "Rigseed $rigseed_version"
git push origin "v$rigseed_version"
```

Uma GitHub Release é opcional. No primeiro lançamento, conclua o
[checklist inicial](public-readiness.md), preservando-o como registro do resultado.
O changelog acompanha as versões seguintes; este guia acompanha o procedimento.

## Fontes

- [Pacotes públicos com namespace](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
- [Autenticação para publicação](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).
- [Enviar código local ao GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
