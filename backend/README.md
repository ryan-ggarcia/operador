# operador — back-end

API do operador: um app Nest.js 12 (monolito modular), Prisma 7 e PostgreSQL
com um schema por módulo. Visão geral e regras em `../CLAUDE.md`; tabelas em
`../docs/modelo-de-dados.md`.

## Rodar localmente

Na raiz do repositório (npm workspaces, uma `node_modules` só):

```bash
npm install
cp backend/.env.example backend/.env   # preencher DATABASE_URL, JWT_SECRET e o dono da conta
npm run db:migrate --workspace backend # aplica prisma/migrations
npm run db:seed --workspace backend    # perfis, status, jornada, formas de pagamento, dono
npm run dev:backend                    # http://localhost:3001
```

O dono da conta vem de `OWNER_EMAIL`, `OWNER_NAME` e `OWNER_PASSWORD`. A senha
é provisória: no primeiro acesso o sistema pede a troca. O seed pode rodar mais
de uma vez (só cria o que falta).

## Verificações

```bash
npm test                                  # na raiz: unitários + e2e + arquitetura
npm run test --workspace backend          # unitários (Vitest)
npm run test:e2e --workspace backend      # sobe o app sem banco
npm run lint:arch --workspace backend     # dependency-cruiser
```

O teste de arquitetura (`.dependency-cruiser.cjs`) quebra se um módulo
importar arquivos internos de outro (só a pasta `public/` vale), se `src/shared`
importar um módulo ou se dois módulos dependerem um do outro.

## Organização de um módulo

```
src/modules/<modulo>/
  public/          fachada (interface + token), tipos e o Module: única porta para os outros módulos
  domain/          regras de negócio puras, com testes (*.spec.ts)
  repositories/    interface do repositório + implementação Prisma (só o schema do módulo)
  <area>/          service (regras + orquestração) e controller (só HTTP)
  dto/             validação da entrada (class-validator)
```

Quando um módulo precisa reagir a outro que depende dele (ex.: `projects`
perguntar ao `timesheet` se há cronômetro ativo), o módulo de baixo expõe um
gancho na fachada (`registerLifecycleListener`) e o de cima se registra no
`onModuleInit`. Assim não há dependência circular. Os anexos seguem a mesma
ideia: cada módulo dono de documentos registra no `files` um resolvedor
(`registerOwner`) que diz quem vê e quem altera os anexos.

Anexos: com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, vão para o Supabase
Storage (bucket privado, `SUPABASE_BUCKET`, padrão `anexos`, criado no painel
do Supabase); sem, ficam em `backend/storage` (desenvolvimento).

Permissões: `@RequireAccess('jobs', nível)`, `@RequireAdministrator()` ou
`@LoadAccess()` (de `modules/auth/public`) carregam as permissões do usuário;
o service recebe `@CurrentAccess()` e aplica as regras finas (registros
próprios, projeto oculto etc.).

## Módulos prontos

| Módulo | Rotas principais |
|---|---|
| `auth` | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password`, `/auth/me`, `/users`, `/access-profiles`, `/teams`, `/collaborators`, `/positions` |
| `crm` | `/parties` (papéis, contatos, anotações), `/contacts`, `/client-groups`, `/departments` |
| `settings` | `/settings/agency` |
| `projects` | `/projects`, `/jobs`, `/tasks`, `/project-statuses`, `/predefined-briefings`, `/comments`, `/approvals` (pedido, `pending`, `vote`, `cancel`, `markers`) |
| `timesheet` | `/timesheet/current`, `/timesheet/start`, `/timesheet/stop`, `/timesheet/running`, `/timesheet/entries`, `/timesheet/documents/:tipo/:id`, `/work-schedules` |
| `media` | `/medias` (peças, grades, linhas, situação, envolvidos, `send-to-finance`, `reopen-billing`), `/medias/billing-types`, `/media-settings/*` (redes, praças, programas, métricas de custo, status) |
| `finance` | `/finance/bills` (lançamentos, `settle`, `cancel`, `reopen`), `/finance/summary`, `/finance/transfers`, `/finance/accounts`, `/finance/categories`, `/finance-settings/*` |
| `production` | `/productions` (itens, fornecedores, cotações, `approve`, pedidos, `send-to-finance`, `reopen-billing`), `/production-settings/*` (encargos, status, textos) |
| `files` | `/files` (listar e enviar, multipart), `/files/:id` (descrição, excluir), `/files/:id/url`, `/files/usage`, `/files/content/:token` (download do storage local) |
| `notifications` | `/notifications` (lista do usuário), `/notifications/unread-count`, `/notifications/read`, `/notifications/preferences` |
| — | `/health` |
