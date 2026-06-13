# Story C4.1 — `kaven module update <slug>`

## Status
Ready for Review

## Story
**Como** desenvolvedor usando o Kaven CLI,
**quero** executar `kaven module update <slug>` para atualizar um módulo instalado para a versão mais recente,
**para que** eu receba as melhorias e correções do módulo sem perder minhas customizações locais.

## Acceptance Criteria

- [ ] AC1: `kaven module update payments` busca a versão mais recente do marketplace e inicia o update
- [ ] AC2: Se o módulo já está na versão mais recente, exibe mensagem e sai sem erros
- [ ] AC3: Se o módulo não está instalado no registry local, exibe erro claro e sai
- [ ] AC4: Arquivos declarados em `mergeable[]` no `module.json` passam por 3-way merge via `GitMergeService`
- [ ] AC5: Arquivos declarados em `copyOnly[]` são sobrescritos diretamente (sem merge)
- [ ] AC6: Se há conflitos de merge: grava `.kaven/conflicts.json`, mantém registry na versão antiga, reporta lista de conflitos ao usuário
- [ ] AC7: Se update limpo (sem conflitos): atualiza `version` no registry, remove cache baseline antigo
- [ ] AC8: O cache da nova versão é criado ANTES do merge; o registry só atualiza APÓS sucesso total
- [ ] AC9: Re-run seguro: se `.kaven/conflicts.json` existe, detecta estado pendente e pergunta ao usuário
- [ ] AC10: TUI usa `@clack/prompts` + `picocolors` (padrão do projeto)
- [ ] AC11: `kaven module update` sem slug lista módulos instalados e pede seleção interativa
- [ ] AC12: Registrado como sub-comando em `kaven module` (junto com `activate`, `add`, `doctor`)

## Dev Notes

### Decisões Arquiteturais (Atlas — 2026-06-13)
- **Conflitos**: Continue + markers git `<<<<<<<` / `=======` / `>>>>>>>` + `.kaven/conflicts.json` (não abortar atomicamente)
- **Idempotência**: Cache novo criado primeiro; registry atualiza só no fim com sucesso total
- **Escopo**: `mergeable[]` + `copyOnly[]` declarados no `module.json`. `module.json` = somente leitura (nunca mergeado)
- **Naming**: `kaven module update <slug>` (sub-namespace consistente com `activate`, `add`, `doctor`)

### Infra existente a reutilizar
- `src/core/GitMergeService.ts` — `performMerge(target, base, update)` → `{success, conflicts, output}`
- `cacheBaseline(slug, version, extractedPath, projectRoot)` em `src/commands/marketplace/install.ts` — extrair para util compartilhado
- `MarketplaceClient.getModule(slug)` — fetch módulo com versão mais recente
- Download + extração de tarball — reutilizar padrão de `install.ts` (tar.x, tempDir)
- `ConfigManager` — registry `.kaven/kaven.json` com `modules[].{name, version, installed}`

### Schema `.kaven/conflicts.json`
```json
{
  "module": "payments",
  "fromVersion": "1.0.1",
  "toVersion": "1.0.2",
  "timestamp": "2026-06-13T14:00:00Z",
  "conflicts": [
    "apps/api/src/modules/billing/routes.ts"
  ]
}
```

### Gap a resolver na implementação
- `slug` não está no registry entry (só `name`). Tratar `name === slug` como fallback.
- `mergeable[]` e `copyOnly[]` são campos novos no `module.json` — usar array vazio como default se ausentes (backward compat).

## Tasks

- [x] T1: Extrair `cacheBaseline()` de `install.ts` para `src/core/ModuleCache.ts` (util compartilhado)
- [x] T2: Implementar `src/commands/module/update.ts` com fluxo completo
- [x] T3: Registrar sub-comando `update` no index do módulo CLI
- [x] T4: Implementar `tests/unit/commands/module/update.test.ts` (4 cenários mínimos)
- [x] T5: Validar `npm test` passa 317+ testes

## Testing

### Cenários de teste obrigatórios
1. **Update limpo**: mock marketplace retorna v1.0.2, merge sem conflitos → registry atualizado, cache antigo removido
2. **Update com conflito**: merge retorna `conflicts: true` → conflicts.json gravado, registry mantém v1.0.1
3. **Já na última versão**: marketplace retorna mesma versão → sai com mensagem, sem efeitos colaterais
4. **Módulo não instalado**: registry não tem o slug → erro claro, process.exit(1)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes
- T1: `cacheBaseline` extraída de `install.ts` para `src/core/ModuleCache.ts` (também adicionadas `getInstalledVersion`, `getBaselineCachePath`, `removeBaselineCache`)
- T2: `update.ts` implementa todos os 12 ACs — fluxo completo com 3-way merge, conflicts.json, idempotência de cache, seleção interativa
- T3: Sub-comando `kaven module update [slug]` registrado em `src/index.ts`
- T4: 4 cenários de teste cobrindo AC2, AC3, AC6, AC7
- T5: 321 testes passando (era 317)

### File List
- `src/core/ModuleCache.ts` — novo (extraído + expandido)
- `src/commands/module/update.ts` — novo
- `src/commands/marketplace/install.ts` — modificado (usa ModuleCache.cacheBaseline)
- `src/index.ts` — modificado (registra `update` sub-command)
- `tests/unit/commands/module/update.test.ts` — novo

### Change Log
- 2026-06-13: Story criada por Orion (aiox-master) após design decision com Atlas (kaven-architect)
- 2026-06-13: Implementado por Dex (dev) — 321 testes, 0 falhas, TypeScript limpo
- 2026-06-13: QA review por Quinn — P1 (slug collision), P2 (import order), P3 (cobertura), P4 (semver sort) identificados
- 2026-06-13: Fixes aplicados por Dex — `getInstalledVersion` reescrito com exact match + semver sort; imports reordenados; 4 cenários adicionados (AC4, AC5, AC9, AC11) — 325 testes, 0 falhas
- 2026-06-13: QA re-validação por Quinn — PASS. Tech debts identificados: TD1 (Ed25519 no update), TD2 (path traversal)
- 2026-06-13: TDs resolvidos por Dex — `verifyDownload` + `skipVerify` option adicionados; `sanitizePaths()` bloqueia traversal; 3 testes TD1/TD2 adicionados — 327 testes, 0 falhas na story
