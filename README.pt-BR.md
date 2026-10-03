# Rigseed

[English](README.md)

[npm](https://www.npmjs.com/package/@addxd/rigseed) · [Código](https://github.com/aDDxD/rigseed) · [Issues](https://github.com/aDDxD/rigseed/issues) · [Como contribuir](CONTRIBUTING.md)

CLI pequena em TypeScript para configuração reproduzível do **Codex CLI**.
Versione papéis e políticas, escolha modelos e reasoning efforts e aplique somente
as partes pertencentes ao rigseed. Nenhum outro provider está implementado.

**Estado:** versão 0.1.0 publicada como `@addxd/rigseed`.
Não há publicação automática, telemetria, daemon ou hook de instalação.

## O que muda

Instalar o pacote **não** configura o Codex nem cria arquivos no projeto.
Você escolhe explicitamente a operação:

| Comando | Finalidade |
| --- | --- |
| `setup` | Configurar o Codex do usuário e os agents globais. |
| `init` | Adicionar um bloco de política ao `AGENTS.md` do projeto Git atual. |
| `init --portable` | Incluir configuração e definições de agents locais. |
| `doctor` | Verificar arquivos, catálogo, markers e drift. |
| `diff` | Mostrar diferenças gerenciadas sem escrever. |
| `update` | Atualizar políticas/configuração usando as escolhas salvas. |
| `uninstall` | Remover conteúdo de ownership comprovado e preservar o restante. |

Cada projeto mantém suas próprias regras no `AGENTS.md`, fora do bloco gerenciado.
Você também pode usar somente `setup` e escrever as instruções dos projetos
manualmente, sem executar `init`.

## Requisitos e início rápido

- Node.js 24 ou superior; desenvolvimento com pnpm 12.8.1.
- Codex CLI **0.160.x** no `PATH`; rigseed não instala o Codex.
- Git para comandos de projeto.

Execute a versão publicada sem instalação global:

```bash
npx @addxd/rigseed@0.1.0 setup --dry-run
npx @addxd/rigseed@0.1.0 setup
npx @addxd/rigseed@0.1.0 doctor --global
# Dentro de um repositório Git, opcionalmente:
npx @addxd/rigseed@0.1.0 init
```

Para desenvolver ou usar o código diretamente, clone o repositório:

```bash
git clone https://github.com/aDDxD/rigseed.git
cd rigseed
pnpm install --frozen-lockfile
pnpm run build
node dist/src/cli.js --help
node dist/src/cli.js setup --dry-run
node dist/src/cli.js setup
node dist/src/cli.js doctor --global
```

Dentro do checkout do próprio Rigseed, use `node dist/src/cli.js` após o build.
`npx @addxd/rigseed@0.1.0` pode escolher o pacote local correspondente em vez
do registry e falhar com `rigseed: command not found`, porque o checkout não
tem o próprio binário instalado. Execute o npx em outra pasta para testar o
pacote publicado; não é necessário instalar globalmente.

`setup` altera a configuração do seu usuário. Revise o dry-run primeiro.
A primeira instalação em um terminal oferece seleção de modelos e efforts,
seguida de plano e confirmação. Sem interação, use `--yes`; isso nunca autoriza
sobrescrever configurações conflitantes do usuário.

Para experimentar o pacote via npx sem publicar:

```bash
package_dir=$(mktemp -d)
pnpm pack --pack-destination "$package_dir"
npx --package "$package_dir/addxd-rigseed-0.1.0.tgz" rigseed --help
```

Nos exemplos seguintes, `rigseed` é o binário instalado; usando o clone,
substitua por `node /caminho/rigseed/dist/src/cli.js`. A instalação global do
pacote npm é opcional e independente da configuração global do Codex.

## Escolher modelos

A política padrão é:

```text
Astra / medium                     supervisor global
  └── Sol / medium                 líder técnico de um workstream
       ├── Luna / highest          tarefa delimitada
       ├── Luna / highest          tarefa independente
       └── Luna / highest          tarefa independente
```

No catálogo suportado: root `gpt-6-astra`, orchestrator `gpt-6.1-sol`, worker
`gpt-6-luna`; o maior esforço de Luna é `max`. São defaults, não requisitos:
selecione outros modelos e esforços suportados no instalador. Os nomes dos papéis
`sol_orchestrator` e `luna_worker` permanecem mesmo ao escolher outros modelos.

```bash
rigseed setup                      # Primeira instalação: escolhas no terminal
rigseed setup --interactive        # Revisar explicitamente escolhas salvas
rigseed setup --config examples/rigseed.json --dry-run
rigseed setup --config examples/rigseed.json --yes
rigseed update --config examples/rigseed.json --dry-run
```

[O exemplo JSON](examples/rigseed.json), com [JSON Schema](docs/config.schema.json), é uma entrada declarativa, não um arquivo
Codex. Contém apenas modelos, esforços e limite de subagents por sessão. Campos
desconhecidos e escolhas não suportadas são rejeitados; não inclua tokens ou MCPs.
As escolhas ficam no state local do alvo: `update`, `diff` e `doctor` usam sua
configuração em vez de voltar aos defaults.

`--yes` pula o assistente e usa JSON informado, escolhas salvas ou defaults.
Em conflitos de valores sem ownership, o setup interativo pode oferecer substituição
explícita com backup e restauração do original no uninstall, ou cancelamento.
`--yes` nunca toma essa decisão. Valores TOML gerenciados e editados manualmente
continuam exigindo reconciliação antes de update/uninstall. Só existe o preset
`--preset default`.

## Global e projeto

```bash
rigseed setup --dry-run
rigseed setup
cd /caminho/meu-projeto
rigseed init --dry-run
rigseed init
```

```text
$CODEX_HOME/                       default: ~/.codex
  config.toml                     merge estrutural gerenciado
  AGENTS.md                       bloco gerenciado
  agents/*.toml                   agents globais

meu-projeto/                      init normal
  AGENTS.md                       regras locais + bloco gerenciado
```

O `init` normal exige setup global válido. Não copia agents globais nem cria um
`.codex/config.toml` vazio. Detecta a raiz Git mesmo a partir de um subdiretório.

Para um projeto que carrega a própria configuração:

```bash
rigseed init --portable --config /caminho/rigseed.json --dry-run
rigseed init --portable --config /caminho/rigseed.json
```

```text
meu-projeto/
  AGENTS.md
  .codex/
    config.toml
    agents/
      sol_orchestrator.toml
      luna_worker.toml
```

Versione esses arquivos para compartilhar o setup. O clone precisa de Codex
compatível e confiança no projeto; o CLI não altera trust. Ownership fica local à
máquina: execute `init --portable` para registrar o clone. Valores TOML existentes
que já coincidem não são reivindicados. Para trocar entre normal e portable,
desinstale o alvo do projeto e inicialize novamente.

Projetos portables personalizados: versione também o JSON seguro do Rigseed e
registre um clone com `init --portable --config ./rigseed.json`. O state da
máquina original não acompanha o clone. Projetos regulares herdam as escolhas
globais; `update --project --config` é recusado nesse modo.

## Inspecionar, atualizar e remover

```bash
rigseed diff --global
rigseed doctor --project
rigseed update --dry-run
rigseed update --yes
rigseed uninstall --project --dry-run
rigseed uninstall --project --yes
```

`update`, `diff`, `doctor` e `uninstall` consideram o global e o projeto Git atual
registrado. `--global` ou `--project` limita o alvo. Não há varredura de outros
projetos. `diff` pode mostrar o setup global proposto antes de instalar.

`setup`, `init`, `update` e `uninstall` aceitam `--dry-run`: não escrevem arquivos,
state ou backups. `--help` e `--version` dispensam Codex.

Doctor distingue verificações de arquivos/catálogo (`✓`), limitações de runtime ou
revisão manual (`!`) e problemas (`✗`, exit code 1). Não executa inferência nem
confirma acesso da conta aos modelos. Catálogo bundled **não** comprova entitlement.

## Segurança e backups

Markdown é alterado apenas neste bloco:

```markdown
<!-- rigseed:start codex-orchestration -->
política gerenciada
<!-- rigseed:end codex-orchestration -->
```

Markers incompletos, duplicados ou inconsistentes causam recusa. TOML é parseado e
mesclado estruturalmente: MCPs, approvals, sandbox, profiles e outras configurações
sem ownership são preservadas. **Uma mudança estrutural perde comentários e
formatação do TOML**, preservando valores. Sem mudança, o arquivo permanece idêntico.

O CLI planeja antes de escrever, recusa symlinks, usa lock local, escrita atômica
e rollback em falha parcial. State e backups privados timestamped ficam em
`$XDG_STATE_HOME/rigseed` (default `~/.local/state/rigseed`). State registra
ownership e modelos, sem copiar toda a configuração. Backups de configuração
podem conter dados sensíveis: mantenha-os locais. Credenciais nunca são lidas ou copiadas.

Cada backup contém `manifest.json` com destinos originais. Para recuperação manual,
revise o manifest e restaure os arquivos/state correspondentes. `file: null` indica
arquivo criado pela operação: remova-o somente após verificar edições posteriores.
Não existe comando de restauração automática. Uninstall nunca remove o diretório
Codex e não adivinha o que remover quando o state falta.

## Limitações conhecidas

- Somente Codex 0.160.x; versões novas exigem revisão de capacidades.
- Multi-agent V1 com profundidade 2 e limite **compartilhado pela sessão** (default 4,
  configurável entre 2 e 8). Não são três workers reservados por orchestrator.
- As instruções orientam delegação, sem garantir roteamento em runtime. Luna
  desabilita controles de delegação e recebe instrução de nunca criar subagents.
- Escritas paralelas exigem ownership independente; o parent integra resultados.
- Validação de arquivos não comprova acesso real a modelos nem delegação efetiva.

Veja [detalhes do Codex](docs/codex.md) e [arquitetura](docs/architecture.md).

## Desenvolvimento e contribuições

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Testes usam HOME, CODEX_HOME, XDG e repositórios Git temporários. Nunca teste o
instalador na sua configuração real. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e
[SECURITY.md](SECURITY.md) antes de contribuir ou reportar problemas.

## Licença e preparação pública

[MIT](LICENSE): permite usar, adaptar e redistribuir conforme seus termos, mantendo
o aviso de copyright e permissão. O software não tem garantia. A licença não
concede acesso a serviços ou modelos da OpenAI.

O repositório contém código/templates portáteis, sem paths pessoais, credenciais
ou state de máquina. Publicar o código e publicar o pacote são passos separados.
O [checklist inicial](docs/public-readiness.md) registra as verificações concluídas;
o [guia de releases](docs/publishing.pt-BR.md) orienta as próximas versões.
Não há publicação automática.
