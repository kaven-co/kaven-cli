# Contribuindo para a Kaven CLI

Obrigado por se interessar em contribuir para a Kaven CLI! Este documento contém as diretrizes necessárias para manter a qualidade e consistência do projeto.

## 🏗️ Estrutura do Projeto

- `src/commands/`: Implementação dos comandos CLI (Commander.js).
- `src/core/`: Lógica de negócio principal (Services, Instaladores, Parsers).
- `src/infrastructure/`: Integrações externas e utilitários (Container, FS Transacional, Telemetry).
- `src/types/`: Definições de tipos TypeScript e schemas Zod.
- `tests/`: Suíte de testes (Vitest).

## 🛠️ Setup de Desenvolvimento

```bash
# Clone o repositório
git clone https://github.com/KavenCompany/kaven-cli.git

# Instale as dependências
pnpm install

# Build em modo watch
pnpm run build --watch
```

## 🧪 Qualidade e Testes

Antes de enviar qualquer alteração, garanta que ela passe em todos os Quality Gates:

```bash
pnpm run quality
```

Este comando executa:

1. **Lint**: Padrões de código ESLint.
2. **Typecheck**: Validação de tipos TypeScript.
3. **Tests**: Suíte completa de testes unitários e de integração.

## 📝 Convenção de Commits

Utilizamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Novos comandos ou funcionalidades.
- `fix:` Correções de bugs.
- `docs:` Alterações em documentação.
- `test:` Adição ou correção de testes.
- `refactor:` Melhorias no código sem alterar comportamento.

## 🚀 Fluxo de Pull Request

1. Crie uma branch a partir da `main`.
2. Implemente sua mudança com os testes correspondentes.
3. Garanta 100% de sucesso no `pnpm run quality`.
4. Gere o bundle de evidências: `pnpm run evidence`.
5. Abra o PR anexando as evidências geradas em `.agent/artifacts/evidence/`.
