---
name: cerrar-issue
description: Flujo para cerrar un issue ya implementado: verificar, commitear y abrir PR delegando en subagentes baratos.
disable-model-invocation: true
argument-hint: <n° de issue>
---

Issue: $ARGUMENTS

1. Si tocó interfaz, confirma que el mockup fue aprobado y que se probó en el navegador (`pnpm build && pnpm start`).
2. Delega en el subagente `verificador` (haiku). Si falla algo, corrige tú y repite.
3. Opcional si el cambio es grande: subagente `revisor` (sonnet) y aplica lo que valga.
4. Delega en el subagente `git-pr` (haiku) con: número de issue, resumen del porqué y lo verificado.
5. Pide a Erick que mergee con `! gh pr merge <n> --rebase`, y después actualiza `docs/estado.md` si el cambio es relevante.
