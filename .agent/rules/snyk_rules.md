---
trigger: model_decision
description: Aplicar esta regra quando houver mudanças de dependências, segurança, CI/CD ou quando realizar varreduras (Snyk/OSV). Exigir evidência de scan e correção sem gambiarra.
---

# Project security best practices

- Always run snyk_code_scan tool for new first party code that is generated in a Snyk-supported language.
- If any security issues are found based on newly introduced or modified code or dependencies, attempt to fix the issues using the results context from Snyk.
- Rescan the code after fixing the issues to ensure that the issues were fixed and that there are no newly introduced issues.
- Repeat this process until no new issues are found.
