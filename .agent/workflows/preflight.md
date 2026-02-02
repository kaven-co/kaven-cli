---
description: Pré-voo do projeto. Verifica configs locais antes de implementar.
---

1. Execute preflight global
   Use `/g-preflight` primeiro.

2. Verifique config do projeto
   // turbo
   ```bash
   cat .agent/config/quality.env
   ```

3. Verifique .env
   // turbo
   ```bash
   test -f .env && echo "✅ .env existe" || echo "⚠️ Copie .env.example para .env"
   ```

4. Prossiga com implementação
