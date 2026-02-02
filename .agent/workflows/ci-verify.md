---
description: Quality gates do projeto usando config local.
---

1. Carregue config
   // turbo
   ```bash
   source .agent/config/quality.env 2>/dev/null && echo "Config carregada"
   ```

2. Execute gates
   ```bash
   source .agent/config/quality.env
   $AG_LINT_CMD && $AG_TYPECHECK_CMD && $AG_TEST_CMD
   ```

3. Evidência
   // turbo
   ```bash
   git diff --stat
   ```
