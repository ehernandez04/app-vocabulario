---
name: retomar
description: Retoma el trabajo tras /clear o /compact. Muestra rama, PRs abiertos y el siguiente issue por etapa, en pocas líneas.
---

Ejecuta en paralelo y resume en menos de 12 líneas (sin releer CLAUDE.md completo):

1. `git status -sb` y `git branch --show-current`
2. `gh pr list`
3. `gh issue list --state open --json number,title,milestone --jq '.[] | "\(.number) \(.milestone.title // "sin etapa") \(.title)"'`

Luego indica: si hay rama o PR sin mergear (no pisarlos), y cuál es el siguiente issue según la regla «por etapa, y dentro por número». Pregunta si lo tomamos.
