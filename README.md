# Kaven CLI 🚀

A ferramenta de linha de comando oficial para o ecossistema Kaven. Projetada para ser robusta, idempotente e extensível.

## 📦 Instalação

No momento, a CLI está em fase alpha. Você pode instalá-la globalmente usando npm ou pnpm:

```bash
npm install -g kaven-cli@alpha
# ou
pnpm add -g kaven-cli@alpha
```

## 🚀 Início Rápido

```bash
# 1. Autenticação
kaven auth login

# 2. Explorar Módulos
kaven marketplace list

# 3. Instalar um Módulo
kaven marketplace install stripe-payments

# 4. Verificar Saúde do Projeto
kaven module doctor

# 5. Ver Telemetria Local
kaven telemetry view
```

## 🛠️ Comandos

### Módulos (`module`, `m`)

Gerenciamento local de módulos e integridade do projeto.

- `kaven module add <manifest>`: Adiciona um módulo localmente via arquivo de manifest.
- `kaven module remove <name>`: Remove um módulo e limpa as injeções de código.
- `kaven module doctor`: Verifica a integridade dos markers, âncoras e dependências.

### Autenticação (`auth`)

Gerenciamento de sessão e tokens.

- `kaven auth login`: Inicia o fluxo de autenticação (Device Flow).
- `kaven auth logout`: Remove as credenciais locais.
- `kaven auth whoami`: Exibe informações do usuário atual.

### Marketplace (`marketplace`, `mkt`, `market`)

Descoberta e instalação de módulos oficiais.

- `kaven marketplace list`: Lista todos os módulos disponíveis na nuvem Kaven.
- `kaven marketplace install <id>`: Baixa e instala um módulo automaticamente.

### Telemetria (`telemetry`)

Observabilidade e auditoria local.

- `kaven telemetry view`: Exibe os últimos eventos registrados localmente.

## 🧪 Desenvolvimento

Consulte o guia [CONTRIBUTING.md](./CONTRIBUTING.md) para detalhes sobre como configurar o ambiente de desenvolvimento, rodar testes e contribuir com o projeto.

## 📄 Licença

Proprietário - Copyright © 2026 Kaven.
