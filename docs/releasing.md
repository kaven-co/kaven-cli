# Pipeline de Release — kaven-cli

> Documento interno. Última atualização: 2026-03-14.

---

## Visão Geral

O kaven-cli usa **Semantic Release** para automatizar 100% do processo de versionamento e publicação no npm. Cada merge em `main` com commits no formato conventional dispara:

1. Análise dos commits desde o último release
2. Determinação do tipo de bump (patch / minor / major)
3. Geração do CHANGELOG.md
4. Bump de versão no `package.json`
5. Publicação no npm (canal `alpha`)
6. Criação do GitHub Release com release notes
7. Commit do `package.json` e `CHANGELOG.md` de volta ao repo

Nenhum token NPM é armazenado no repositório. A autenticação com o npm usa **OIDC Trusted Publishing**.

---

## Por que OIDC Trusted Publishing

O npm removeu suporte a tokens clássicos (Classic Tokens) em novembro de 2025. A alternativa padrão são os **Granular Access Tokens**, mas eles expiram e precisam ser rotacionados manualmente — fragilidade inaceitável para CI/CD.

**OIDC Trusted Publishing** resolve isso:

- O GitHub Actions obtém um token OIDC temporário direto do GitHub
- O npm verifica a identidade do publisher via esse token (sem segredo armazenado)
- Zero expiração, zero rotação manual
- Rastreabilidade completa: cada publish tem provenance attestation (`NPM_CONFIG_PROVENANCE=true`)

**Como foi configurado:**
1. Acesse npmjs.com → pacote `kaven-cli` → Settings → Trusted Publishers
2. Adicione um publisher com:
   - **Package name:** `kaven-cli`
   - **Repository owner:** `kaven-co`
   - **Repository name:** `kaven-cli`
   - **Workflow:** `release.yml`
3. Nenhum segredo NPM\_TOKEN precisa ser adicionado ao repositório GitHub

---

## Arquivo `release.config.mjs`

```mjs
export default {
  branches: [
    {
      name: 'main',
      prerelease: 'alpha',
      channel: 'alpha',
    },
  ],
  plugins: [ /* ... */ ],
};
```

### Estratégia de branches

| Branch | Canal npm | Tag dist | Formato de versão |
|--------|-----------|----------|-------------------|
| `main` | `alpha` | `alpha` | `0.4.0-alpha.1` |
| (futuro) `stable` | `latest` | `latest` | `1.0.0` |

A propriedade `prerelease: 'alpha'` faz o Semantic Release gerar versões no formato `MAJOR.MINOR.PATCH-alpha.N`. O `channel: 'alpha'` instrui o plugin npm a publicar com `--tag alpha` em vez de `latest`.

### Plugins (em ordem de execução)

#### 1. `@semantic-release/commit-analyzer`

Lê todos os commits desde o último release e determina o tipo de bump:

| Tipo de commit | Release gerado |
|----------------|----------------|
| `feat:` | minor |
| `fix:`, `perf:`, `refactor:`, `revert:` | patch |
| `BREAKING CHANGE` (qualquer tipo) | major |
| `chore:`, `docs:`, `test:`, `style:`, `ci:` | **nenhum release** |

Usa o preset `angular` (o mais comum para conventional commits).

#### 2. `@semantic-release/release-notes-generator`

Gera o conteúdo das release notes no formato Markdown, agrupando commits por seção:

- `feat` → **Features**
- `fix` → **Bug Fixes**
- `perf` → **Performance**
- `refactor` → **Refactoring**
- `revert` → **Reverts**

#### 3. `@semantic-release/changelog`

Prepend as release notes geradas no arquivo `CHANGELOG.md`. Se o arquivo não existir, cria do zero. O arquivo é depois comitado pelo plugin `@semantic-release/github`.

#### 4. `@semantic-release/npm`

Publica no npm. Não requer `NPM_TOKEN` — a autenticação vem do OIDC via `NODE_AUTH_TOKEN` configurado no step de setup do Node.js no workflow.

A tag dist é derivada do `channel` configurado na branch (`alpha`), então o comando equivalente seria:

```bash
npm publish --tag alpha --provenance
```

#### 5. `@semantic-release/github`

- Cria o GitHub Release com as release notes
- Faz o commit do `package.json` (versão bumpeada) e `CHANGELOG.md` de volta ao repo
- O commit gerado tem a mensagem `chore(release): vX.Y.Z-alpha.N` — esse padrão é detectado pelo `if:` no workflow para evitar loop infinito de releases

---

## Arquivo `.github/workflows/release.yml`

### Permissões necessárias

```yaml
permissions:
  contents: write       # commit version bump + CHANGELOG, criar GitHub release
  issues: write         # comentar em issues quando liberado
  pull-requests: write  # comentar em PRs quando liberado
  id-token: write       # OIDC — obrigatório para Trusted Publishing
```

A permissão `id-token: write` é o que autoriza o GitHub a emitir o token OIDC que o npm usa para verificar a identidade do publisher.

### Step a step

#### `if: "!contains(github.event.head_commit.message, 'chore(release)')"`

Evita loop infinito: quando o Semantic Release comita o `package.json` bumpeado, esse commit não deve disparar outro release.

#### `Checkout` com `fetch-depth: 0`

O Semantic Release precisa de todo o histórico de commits para determinar quais são novos desde o último release. `fetch-depth: 0` garante clone completo (sem shallow).

`persist-credentials: false` é segurança básica — o token do checkout não fica disponível para outros processos.

#### `Setup Node.js` com `registry-url`

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
    registry-url: 'https://registry.npmjs.org'
```

O parâmetro `registry-url` é obrigatório para o OIDC funcionar. Ele configura o `.npmrc` com `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`, que é populado pelo token OIDC temporário no step seguinte.

#### `Install dependencies` com `--ignore-scripts`

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

`--ignore-scripts` impede que scripts de lifecycle de dependências executem durante a instalação no CI — boa prática de segurança.

#### `Release`

```yaml
- run: npx semantic-release
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NPM_CONFIG_PROVENANCE: 'true'
```

- `GITHUB_TOKEN`: token automático do GitHub Actions, usado pelo plugin `@semantic-release/github`
- `NODE_AUTH_TOKEN`: preenchido com o token OIDC temporário via `setup-node` + Trusted Publisher — **não é o `GITHUB_TOKEN`** em runtime, mas sim o token emitido pelo provedor OIDC do npm
- `NPM_CONFIG_PROVENANCE: 'true'`: adiciona attestation de provenance ao pacote publicado (verifiable no npmjs.com)

---

## Regras de Versionamento

### Formato alpha

```
MAJOR.MINOR.PATCH-alpha.N
```

O `N` é um contador incremental por release dentro do mesmo MAJOR.MINOR.PATCH. Exemplo:

```
0.4.0-alpha.1   ← primeiro release alpha do 0.4.0
0.4.0-alpha.2   ← segundo commit feat: nessa série
0.5.0-alpha.1   ← feat: que bump minor
```

### Exemplos de commits e seus efeitos

```bash
# Gera patch release (ex: 0.4.0-alpha.2 → 0.4.0-alpha.3)
fix: resolve cache corruption on concurrent writes
perf: reduce startup time by lazy-loading marketplace client
refactor: extract auth token refresh into standalone helper

# Gera minor release (ex: 0.4.0-alpha.3 → 0.5.0-alpha.1)
feat: add --with-squad flag to kaven init
feat(marketplace): add --category filter to list command

# Gera major release (ex: 0.5.0-alpha.1 → 1.0.0-alpha.1)
feat!: rename kaven marketplace install to kaven module install

BREAKING CHANGE: o subcomando foi movido para o grupo `module`

# Sem release
chore: update dependencies
docs: add troubleshooting section to README
test: add edge case for offline mode
ci: pin action versions to SHA
style: fix trailing whitespace
```

---

## Como Promover de Alpha para Stable

Quando o produto atingir v1.0.0 e estiver pronto para `latest`:

1. Atualizar `release.config.mjs` — remover `prerelease` e `channel` da branch `main`:

```mjs
// Antes (alpha)
branches: [{ name: 'main', prerelease: 'alpha', channel: 'alpha' }]

// Depois (stable)
branches: ['main']
```

2. O próximo merge em `main` com `feat:` ou `fix:` vai publicar como `latest` (ex: `1.0.0`)

3. Opcionalmente, criar branch `next` para continuar recebendo pre-releases enquanto `main` vira stable:

```mjs
branches: [
  'main',
  { name: 'next', prerelease: 'next', channel: 'next' },
]
```

---

## Troubleshooting

### Release não foi disparado após merge

**Causa mais comum:** o commit não segue conventional commits ou é do tipo que não gera release (`chore`, `docs`, `test`, `style`, `ci`).

**Verificação:**

```bash
# Ver o que o semantic-release faria sem publicar
npx semantic-release --dry-run
```

### Erro de autenticação npm no CI

```
Error: ENEEDAUTH
```

**Passos:**
1. Verificar se o Trusted Publisher está configurado no npmjs.com para o workflow `release.yml`
2. Verificar se `id-token: write` está nas permissões do job
3. Verificar se `registry-url: 'https://registry.npmjs.org'` está no step `setup-node`

### "No commits found since last release"

O Semantic Release analisa commits desde a última tag git. Se não há commits elegíveis (somente `chore:`, `docs:`, etc.), nenhuma versão é gerada — comportamento correto.

Para forçar um release manual em situações excepcionais:

```bash
# APENAS se realmente necessário e com consciência do impacto
npx semantic-release --no-ci
```

### Commit de bump voltou como "chore(release)" mas o loop não parou

Verificar se a condição `if:` no workflow está correta:

```yaml
if: "!contains(github.event.head_commit.message, 'chore(release)')"
```

### Versão no `package.json` está desatualizada localmente

O Semantic Release faz o bump e commita direto no GitHub. Para sincronizar localmente:

```bash
git pull origin main
```

---

## Testando Localmente

```bash
# Dry run — simula o release sem publicar nada
npx semantic-release --dry-run

# Com variáveis de ambiente necessárias
GITHUB_TOKEN=<seu-token> npx semantic-release --dry-run

# Ver quais commits seriam incluídos
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

O dry run mostra exatamente qual versão seria gerada e quais commits seriam incluídos no changelog, sem fazer nenhuma alteração.

---

## Referências

- [Semantic Release Docs](https://semantic-release.gitbook.io/semantic-release/)
- [npm OIDC Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Commit Convention](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
