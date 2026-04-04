# 🛡️ Kaven CLI

> **Status:** `v0.4.1-alpha` — *Sessão de Auditoria e Estabilização de Infraestrutura (2026-04-04)*
> 📖 Versão em Português: [README.pt-BR.md](./README.pt-BR.md)

[![npm version](https://img.shields.io/npm/v/kaven-cli/alpha.svg)](https://www.npmjs.com/package/kaven-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

**Kaven CLI** é a interface de comando oficial para o ecossistema [Kaven](https://kaven.site). Projetado para desenvolvedores que exigem velocidade, segurança e inteligência artificial nativa (AIOX).

---

## ⚡ Quick Start (Elite Flow)

```bash
# 1. Instalação Global
npm install -g kaven-cli@alpha

# 2. Autenticação Segura (Handshake RFC 8628)
kaven auth login

# 3. Bootstrap com Squad de Agentes (AIOX Bridge)
kaven init meu-projeto --with-squad
```

---

## 🔐 Authentication (The New Handshake)

A partir da **v0.4.1-alpha**, o Kaven CLI implementa o **Device Authorization Grant**. 

### `kaven auth login`
1. O CLI solicita um par de códigos ao Marketplace.
2. O navegador abre automaticamente em `http://localhost:8000/api/auth/activate` (Ambiente Dev).
3. **Founder Mode:** Em ambiente de desenvolvimento, utilize o link **"Bypass Local"** para autenticação instantânea como administrador.
4. O CLI detecta a verificação via polling seguro e armazena os tokens JWT em `~/.kaven/auth.json`.

---

## 🤖 AIOX Bridge (Elite Squads)

O Kaven CLI é a ponte entre seu código e a inteligência do **AIOX v5**.

### `kaven init --with-squad`
Ao utilizar esta flag, o CLI:
- Clona o boilerplate do framework.
- Injeta o `kaven-squad` em `squads/`.
- Configura as âncoras de injeção (`[KAVEN_MODULE_IMPORTS]`) para permitir que agentes instalem módulos automaticamente.

> **Note:** Como o AIOX v5 ainda não está no NPM público, o CLI realiza o link dinâmico com o `.aiox-core` local durante a fase de desenvolvimento.

---

## 📂 Command Architecture

### 🛠️ Core Commands
- `init [name]`: Inicialização de projetos (Suporta `--with-squad`).
- `auth [login|logout|whoami]`: Gestão de identidade e segurança.
- `doctor`: Auditoria de saúde do projeto (Dogfooding engine).

### 📦 Marketplace & Modules
- `marketplace [browse|list|install]`: Exploração do ecossistema de módulos.
- `module [add|remove|publish]`: Gestão do ciclo de vida de módulos privados e públicos.

### ⚙️ System & Config
- `cache [status|clear]`: Gestão de cache local (Máximo 50MB).
- `telemetry [view]`: Auditoria de eventos locais.
- `config [set|get]`: Overrides de API e ambiente.

---

## 🌐 Environment Variables

| Variável | Função |
|----------|-------------|
| `KAVEN_API_URL` | Override da URL do Marketplace (Ex: `http://localhost:8000`) |
| `KAVEN_DEBUG=1` | Ativa logs forenses no terminal |
| `KAVEN_OFFLINE=1` | Modo avião (Usa apenas dados cacheados) |

---

## 🛡️ License

Apache 2.0. Construído para ser a base de SaaS de classe mundial.

---
**Documentation:** [docs.kaven.site](https://docs.kaven.site/cli) | **GitHub:** [kaven-co/kaven-cli](https://github.com/kaven-co/kaven-cli)
