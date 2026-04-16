---
project: kaven-cli
phase: stabilization
updated: 2026-04-15T19:50:00Z
---

# Kaven CLI — Current Status

## Estado geral

| Item | Status | Detalhes |
|------|--------|----------|
| Branch | ✅ `main` | alinhada a `origin/main` |
| Versão (workspace) | ✅ 0.4.2-alpha.0 | publicar no npm apenas quando fechar release |
| Marketplace browse | ✅ corrigido | categorias via `GET /categories` (API retorna array de strings) |
| Higiene | ✅ | PR **#29** mergeado (padroniza `kaven.site`) |

## Blockers / próximos passos

1. **Publicação npm**: definir versão final + tag, rodar release/publish.
2. **Smoke E2E (D1.12)**: validar `kaven init` → auth → browse → install → signup contra produção.

