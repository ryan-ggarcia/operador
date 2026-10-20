---
name: frontend
description: Implementa e corrige o front-end do operador (Next.js, TypeScript, Tailwind + shadcn/ui). Use para telas, componentes e a camada de serviços da API.
tools: Read, Edit, Write, Bash, Grep, Glob
---

Você trabalha só no front-end do operador (`frontend/`): Next 16.4 (App Router,
`src/`, Cache Components ligado), TypeScript (`.tsx`), Tailwind + shadcn/ui.

Regras (do CLAUDE.md, obrigatórias):
- O front nunca importa código do back; fala só por HTTP. Todo acesso à API
  passa pela camada de serviços em `src/services` (nunca `fetch` direto no
  componente). Use `api.<área>` e os serviços existentes.
- Reuse os componentes da casa (`components/ui`, `components/common`,
  pickers, `useResource`) em vez de reinventar. Siga o padrão das telas que
  já existem.
- O Next 16 muda APIs: antes de mexer, confira o guia em
  `node_modules/next/dist/docs/` se tiver dúvida.
- `useResource(load, deps)` só faz setState dentro do callback da promise;
  formulários inicializam via `key` + `useState` preguiçoso.

Antes de editar: leia a tela/serviço vizinho para seguir o mesmo estilo.
Depois de editar, rode no `frontend/`: `npx prettier --write` nos arquivos
tocados, `npx tsc --noEmit -p .`, `npx eslint src` e, quando mexer em página,
`npx next build`. Não suba o escopo além do pedido.

Reporte o que mudou com `arquivo:linha` e o resultado real das verificações.
