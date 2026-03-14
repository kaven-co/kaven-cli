# Kaven CLI

> 📖 English version: [README.md](./README.md)

[![npm version](https://img.shields.io/npm/v/kaven-cli/alpha.svg)](https://www.npmjs.com/package/kaven-cli)
[![npm downloads](https://img.shields.io/npm/dm/kaven-cli.svg)](https://www.npmjs.com/package/kaven-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![CI](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/kaven-co/kaven-cli/actions/workflows/ci.yml)

A CLI oficial do [Kaven](https://kaven.site) — boilerplate enterprise-grade para SaaS.
Bootstrap de projetos, gerenciamento de módulos e integração com o Kaven Marketplace diretamente pelo terminal.

O Kaven é um projeto brasileiro. O boilerplate comprime de 3-6 meses para dias o trabalho de infraestrutura base de um SaaS (auth, multi-tenancy, pagamentos, design system).

> **Alpha:** APIs e comandos podem mudar antes da v1.0.0.

---

## Instalação

```bash
npm install -g kaven-cli@alpha
# ou
pnpm add -g kaven-cli@alpha
```

**Requisitos:** Node.js >= 20, pnpm (necessário para o `kaven init`)

---

## Início Rápido

```bash
# 1. Bootstrap de um novo projeto
kaven init meu-saas

# 2. Autenticar com o marketplace
kaven auth login

# 3. Explorar módulos disponíveis
kaven marketplace browse

# 4. Instalar um módulo
kaven marketplace install payments

# 5. Verificar saúde do projeto
kaven module doctor
```

---

## Referência de Comandos

### `kaven init [nome-do-projeto]`

Cria um novo projeto Kaven a partir do template oficial.

```
Opções:
  --defaults       Pular prompts interativos, usar valores padrão
  --skip-install   Pular o pnpm install após o setup
  --skip-git       Pular git init e commit inicial
  --force          Sobrescrever diretório existente
  --with-squad     Inicializar squad AIOX no projeto

Exemplos:
  kaven init meu-app
  kaven init meu-app --defaults
  kaven init meu-app --skip-git --skip-install
```

---

### `kaven auth`

Gerenciar autenticação com o Kaven Marketplace.

```
Subcomandos:
  login    Iniciar fluxo de device code (RFC 8628) — abre o navegador para confirmar
  logout   Encerrar a sessão local
  whoami   Exibir informações do usuário autenticado
```

---

### `kaven marketplace`

Explorar e instalar módulos do Kaven Marketplace.

```
Subcomandos:
  list      Listar módulos disponíveis
  install   Baixar e aplicar um módulo no projeto atual
  browse    Navegador interativo (TUI)

Opções (list):
  --category <cat>   Filtrar por categoria
  --sort <campo>     newest (padrão) | popular | name
  --page <n>         Número da página
  --limit <n>        Resultados por página (máx 100)
  --json             Saída em JSON bruto

Opções (install):
  --version <ver>    Instalar uma versão específica
  --force            Pular confirmação de sobrescrita
  --skip-env         Pular injeção no .env
  --env-file <path>  Caminho do .env alvo
```

---

### `kaven module`

Gerenciar módulos instalados no projeto atual.

```
Subcomandos:
  doctor    Executar health checks no projeto e nos módulos instalados
  add       Instalar um módulo a partir de um manifest local
  remove    Desinstalar um módulo instalado
  publish   Publicar um módulo no marketplace

Opções (doctor):
  --fix    Corrigir problemas automaticamente (pnpm install, prisma generate, env vars)
  --json   Saída em JSON legível por máquina

Exit codes (doctor):
  0   Todos os checks passaram
  1   Um ou mais erros encontrados
  2   Apenas avisos (sem erros)

Opções (publish):
  --dry-run          Validar e empacotar sem fazer upload
  --changelog <msg>  Notas de release para esta versão
```

> `kaven doctor` é um alias para `kaven module doctor`.

---

### `kaven upgrade`

Fazer upgrade da licença via checkout Paddle.

```
Opções:
  --no-browser   Imprimir URL do checkout em vez de abrir o navegador

Comportamento:
  Abre o checkout Paddle no navegador → aguarda confirmação de pagamento (a cada 5s, máx 10 min)
  → atualiza a licença local em caso de sucesso
```

---

### `kaven license`

```
Subcomandos:
  status   Exibir tier e validade da licença atual
```

---

### `kaven cache`

Gerenciar o cache local de respostas da API (`~/.kaven/cache`, máx 50 MB).

```
Subcomandos:
  status   Exibir estatísticas do cache (tamanho, entradas, idade)
  clear    Apagar todos os dados em cache

TTLs do cache:
  Listagem de módulos    24 horas
  Manifests de módulos   7 dias
  Status da licença      1 hora
```

---

### `kaven telemetry`

```
Subcomandos:
  view   Exibir eventos de telemetria locais recentes
         -l, --limit <n>   Número de eventos (padrão: 10)
```

---

### `kaven config`

```
Subcomandos:
  set <chave> <valor>   Definir um valor de configuração
  get <chave>           Ler um valor de configuração
```

---

### `kaven init-ci`

Inicializa configuração de CI/CD no projeto atual. Gera workflows do GitHub Actions configurados para projetos Kaven.

---

## Configuração

Toda a configuração fica em `~/.kaven/`:

```
~/.kaven/
  auth.json         Tokens de autenticação        (chmod 600)
  config.json       Configuração da CLI
  license.json      Chave e tier da licença
  signing-key.json  Chave Ed25519 para módulos    (chmod 600)
  cache/            Cache de respostas da API      (máx 50 MB)
  telemetry.log     Eventos de telemetria locais
```

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `KAVEN_API_URL` | Sobrescrever a URL da API do marketplace |
| `KAVEN_DEBUG=1` | Ativar saída de debug detalhada |
| `KAVEN_OFFLINE=1` | Usar apenas dados em cache, sem requisições de rede |
| `KAVEN_TELEMETRY=0` | Desativar telemetria completamente |

### Sobrescrever a URL da API (config file)

```json
// ~/.kaven/config.json
{
  "apiUrl": "https://api.seu-kaven.com"
}
```

### Modo Debug

```bash
KAVEN_DEBUG=1 kaven marketplace list
```

### Modo Offline

```bash
KAVEN_OFFLINE=1 kaven marketplace list
```

---

## Troubleshooting

**Erro "Not authenticated"**
```bash
kaven auth login
```

**"module.json not found" ao publicar**

Execute `kaven module publish` de dentro do diretório do módulo (o que contém o `module.json`).

**pnpm install falha no `kaven init`**
```bash
npm install -g pnpm          # instalar pnpm globalmente
# ou pular e instalar depois:
kaven init meu-app --skip-install
cd meu-app && pnpm install
```

**Prisma client desatualizado**
```bash
kaven module doctor --fix
# ou manualmente:
npx prisma generate
```

**Problemas de cache**
```bash
kaven cache clear
```

**Permission denied em `~/.kaven/`**
```bash
chmod 700 ~/.kaven
chmod 600 ~/.kaven/auth.json ~/.kaven/signing-key.json
```

---

## Contribuindo

```bash
git clone https://github.com/kaven-co/kaven-cli
cd kaven-cli
pnpm install
pnpm test           # 310 testes
pnpm run typecheck
pnpm run lint
```

**Convenção de commits:** este repositório usa [Conventional Commits](https://www.conventionalcommits.org/).

```bash
feat: adicionar flag --with-squad ao kaven init
fix: corrigir corrupção de cache em escritas concorrentes
docs: atualizar seção de troubleshooting
```

**Fluxo de release:**
1. Abrir um PR contra `main`
2. CI deve estar verde (lint + typecheck + testes + build)
3. Merge → Semantic Release faz o bump de versão automaticamente e publica no npm (tag `@alpha`)

Tipos que disparam release: `feat` (minor), `fix` / `perf` / `refactor` (patch), `BREAKING CHANGE` (major).
Tipos que **não** disparam release: `chore`, `docs`, `test`, `style`, `ci`.

Consulte [`docs/releasing.md`](./docs/releasing.md) para a documentação completa do pipeline de release.

---

## Licença

Apache 2.0 — veja [LICENSE](LICENSE)

---

Documentação: https://docs.kaven.site/cli
GitHub: https://github.com/kaven-co/kaven-cli
npm: https://www.npmjs.com/package/kaven-cli
