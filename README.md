# Kaven CLI 🚀

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha.1-orange.svg)](https://semver.org)

A ferramenta de linha de comando oficial para o ecossistema **Kaven**. Projetada para ser robusta, idempotente e extensível.

> **Note**: Este projeto está em fase **Alpha**. APIs e comandos estão sujeitos a alterações.

---

## 📦 Instalação

A CLI pode ser instalada globalmente via npm ou pnpm:

```bash
npm install -g kaven-cli@alpha
# ou
pnpm add -g kaven-cli@alpha
```

## 🚀 Início Rápido

Consiga o seu projeto rodando em segundos:

```bash
# 1. Autenticação
kaven auth login

# 2. Explorar Módulos
kaven marketplace list

# 3. Instalar um Módulo
kaven marketplace install payments

# 4. Verificar Saúde do Projeto
kaven module doctor

# 5. Ver Telemetria Local
kaven telemetry view
```

## 🛠️ Comandos Principais

A Kaven CLI organiza suas funcionalidades em grupos lógicos para uma melhor experiência:

### 📦 Módulos (`module`, `m`)

Gerenciamento local de módulos e integridade do projeto.

- `kaven module add <path>`: Adiciona um módulo localmente via arquivo de manifest.
- `kaven module remove <name>`: Remove um módulo e limpa as injeções de código.
- `kaven module doctor`: Verifica a integridade dos markers, âncoras e dependências.

### 🔑 Autenticação (`auth`)

Gerenciamento de sessão e tokens.

- `kaven auth login`: Inicia o fluxo de autenticação (Device Flow).
- `kaven auth logout`: Remove as credenciais locais.
- `kaven auth whoami`: Exibe informações do usuário atual.

### 🏬 Marketplace (`marketplace`, `mkt`)

Descoberta e instalação de módulos oficiais.

- `kaven marketplace list`: Lista todos os módulos disponíveis na nuvem Kaven.
- `kaven marketplace install <id>`: Baixa e instala um módulo automaticamente.

### 📊 Telemetria (`telemetry`)

Observabilidade e auditoria local.

- `kaven telemetry view`: Exibe os últimos eventos registrados localmente.

---

## 🧪 Desenvolvimento

Nós valorizamos contribuições! Antes de começar, por favor leia nosso guia de contribuição:

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guia de setup e padrões.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) - Nosso compromisso com a comunidade.

## 📄 Licença

Este projeto é licenciado sob a **Apache-2.0 License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  Feito com ❤️ pela equipe Kaven
</p>
