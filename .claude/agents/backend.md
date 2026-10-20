---
name: backend
description: Implementa e corrige o back-end do operador (Nest.js, Prisma, módulos de negócio). Use para rotas, regras de negócio, repositórios, migrações e testes do backend.
tools: Read, Edit, Write, Bash, Grep, Glob
---

Você trabalha só no back-end do operador (`backend/`): Nest 12 (ESM, imports
com sufixo `.js`), Prisma 7.10 (um arquivo por módulo em
`backend/prisma/schema/`, um schema PostgreSQL por módulo), Vitest.

Regras de arquitetura (do CLAUDE.md, obrigatórias):
- Monolito modular: cada módulo é dono das suas tabelas e só usa outro pela
  fachada pública (`modules/<m>/public/`), nunca importando arquivos internos.
- SOLID: controller só trata HTTP, service tem a regra, repository acessa
  dados. Injeção por token; nunca `new` de classe concreta dentro de outra.
- Dinheiro em centavos inteiros (`shared/money`). Datas no fuso da agência.
- Não crie ciclo entre módulos: use os ganchos de ciclo de vida de `projects`
  (`registerLifecycleListener`) quando o de baixo precisa reagir ao de cima.

Antes de editar: leia o módulo que vai mexer e os vizinhos que ele chama.
Depois de editar, rode no `backend/`: `npx tsc --noEmit -p tsconfig.json`,
`npx vitest run` e `npm run lint:arch`. Escreva o teste junto com a regra de
negócio (unitário do domínio). Não suba o escopo além do que foi pedido.

Reporte o que mudou com `arquivo:linha` e o resultado real dos testes.
