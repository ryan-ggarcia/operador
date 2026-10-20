# Projeto: operador

Este arquivo é o contexto de trabalho do projeto. O Claude Code é o único
agente usado neste repositório. O usuário escreve em português, então responda
em português.

---

## Parte 1 — Stack e arquitetura do aplicativo

### Stack
- **Back-end:** Nest.js (TypeScript)
- **Front-end:** Next.js com TypeScript (componentes `.tsx`)
- **Runtime:** Node v26.10.0, npm 11.19.1

### Regras de arquitetura (obrigatórias)
1. **Front e back separados.** Cada um tem sua própria pasta, com
   `package.json`, dependências e configuração próprios. O front nunca importa
   código do back, e vice-versa: os dois se comunicam só por HTTP/API.
2. **Monolito modular no back-end.** O back-end é uma única aplicação Nest.js,
   dividida em módulos de negócio isolados:
   - Cada módulo é dono das suas tabelas (um schema PostgreSQL por módulo).
     Nenhum módulo lê ou grava tabelas de outro.
   - Um módulo só usa outro pela interface pública que ele exporta (um
     service de fachada definido por interface), nunca importando arquivos
     internos dele.
   - Objetivo: qualquer módulo poder virar um microsserviço no futuro sem
     reescrever o resto.
3. **Princípios SOLID** em todo o código:
   - **S (responsabilidade única):** controllers só tratam HTTP, services
     contêm regra de negócio, repositories cuidam do acesso a dados.
   - **O (aberto/fechado):** estenda o comportamento com novas implementações
     de interfaces, em vez de alterar código que já funciona.
   - **L (substituição de Liskov):** qualquer implementação de uma interface
     deve funcionar no lugar de outra sem quebrar quem a usa.
   - **I (segregação de interfaces):** prefira interfaces pequenas e
     específicas a uma interface grande e genérica.
   - **D (inversão de dependência):** dependa de abstrações. No Nest, injete
     dependências por interface/token via injeção de dependência, nunca
     instanciando classes concretas com `new` dentro de outra classe. No
     front, isole o acesso à API em uma camada de serviços, em vez de chamar
     `fetch` direto nos componentes.

### O produto
O "operador" é um sucessor do Operand: um sistema de gestão para agências de
comunicação e publicidade, feito **sob medida para a agência do usuário**
(uma empresa só, não é SaaS). O usuário cadastra os dados da agência ele mesmo.

A única funcionalidade nova em relação ao Operand é a **integração com o
Claude**: analisar jobs, relatórios e os demais dados do sistema.

### Decisões tomadas
| Tema | Decisão |
|---|---|
| Arquitetura | Monolito modular (trocado de microsserviços a pedido do usuário) |
| Modelo de uso | Uma agência só (trocado de SaaS a pedido do usuário): sem `tenantId` nem cadastro de empresas |
| Banco de dados | Um PostgreSQL, com um schema por módulo |
| ORM | Prisma |
| Autenticação | E-mail e senha, com token JWT |
| Front → back | HTTP/REST |
| Visual do front | Tailwind CSS + shadcn/ui |
| Pacotes | npm workspaces (pedido do usuário em 13/10/2026): `package.json` próprio no front e no back, mais um na raiz só para juntar os dois; uma única `node_modules`, na raiz. Rodar `npm install` sempre na raiz. |
| Infra local | Docker Compose sobe o PostgreSQL, o back e o front |
| IA | Claude API pelo SDK oficial `@anthropic-ai/sdk`, modelo `claude-opus-5-5` |
| Testes | Escritos desde o início, junto com o código: unitários das regras de negócio com Vitest (padrão do Nest 12), e2e e teste de arquitetura |

### Módulos (primeira versão)
Definida com o usuário em 13/10/2026, depois do mapeamento. Tabelas e
interfaces de cada módulo em `docs/modelo-de-dados.md`.

| Módulo | Responsabilidade |
|---|---|
| `auth` | Usuários, login e JWT, perfis de acesso e níveis por módulo, colaboradores (RH e valor/hora), funções e equipes |
| `crm` | Cadastro de pessoas com papéis (cliente, fornecedor, prestador, veículo), contatos, grupos de clientes |
| `projects` | Projetos, jobs, tarefas, status, briefings, comentários, aprovação de peças, templates e numeração dos documentos |
| `timesheet` | Apontamento de horas (cronômetro e manual) e jornadas |
| `media` | Mídias (PI): veículo, peças, grades, comissão e valor líquido (**sem CENP**, por decisão do usuário) |
| `production` | Produções: cotação com fornecedores, pedidos de produção e encargos |
| `finance` | Receitas e despesas, parcelas, contas, categorias, centros de custo, transferências e fluxo de caixa |
| `files` | Anexos de todos os módulos (Supabase Storage) |
| `notifications` | Avisos no sistema e por e-mail |
| `settings` | Dados da agência (razão social, CNPJ, logo) usados nos PDFs |
| `ai` | Integração com o Claude: análise de jobs, relatórios e dados dos outros módulos |

Fora da v1: Propostas e contratos de fee, Conversas, Agenda, Acesso Cliente,
CENP-Meios, webhooks e API, boleto e NFS-e, conciliação bancária, Timesheet
Automático e envio de e-mails (extra; na v1 só avisos no sistema). A grade de
mídia e o faturamento de mídia e produção ficam iguais ao Operand.

### Estrutura de pastas
```
operador/
├── docker-compose.yml
├── docs/
│   ├── modelo-de-dados.md  # módulos, schemas, tabelas e interfaces
│   └── operand/            # mapeamento funcional do Operand, um arquivo por módulo
├── frontend/            # Next.js (TypeScript, .tsx), Tailwind + shadcn/ui
└── backend/             # um app Nest.js
    ├── prisma/schema/   # um arquivo .prisma por módulo, um schema PostgreSQL cada
    └── src/
        ├── shared/      # autenticação JWT, utilitários
        └── modules/
            ├── auth/
            ├── crm/
            ├── projects/
            ├── timesheet/
            ├── media/
            ├── production/
            ├── finance/
            ├── files/
            ├── notifications/
            ├── settings/
            └── ai/
```

### Módulo `ai` (integração com o Claude)
- Chama a Claude API com o SDK oficial `@anthropic-ai/sdk`; modelo padrão
  `claude-opus-5-5`.
- O Claude acessa os dados por **ferramentas (tool use)** que chamam as
  interfaces públicas dos outros módulos (ex.: buscar job, listar horas de um
  job, resumo financeiro). Nunca acessa o banco diretamente, e as ferramentas
  são só de leitura.
- Respostas longas usam streaming até o front.
- A chave `ANTHROPIC_API_KEY` fica só no back-end, em variável de ambiente.
- Os dados enviados para análise saem da infraestrutura da agência e vão para
  a Anthropic; enviar só o necessário para cada pergunta.

### Deploy
Objetivo do usuário: custo baixo sem dor de cabeça com manutenção. Hoje o
Operand custa cerca de R$ 2.000/mês, e a meta é reduzir esse valor.

| Parte | Onde |
|---|---|
| Front-end | Netlify (plano gratuito; deploy automático pelo GitHub) |
| Back-end | VPS da Hostinger com Docker, data center no Brasil |
| Banco | Supabase Pro (PostgreSQL gerenciado com backup diário), região São Paulo |
| DNS | Cloudflare (plano gratuito), opcional |

- Custo estimado: R$ 250 a 550/mês no total (VPS R$ 40–80, Supabase Pro
  cerca de US$ 25, Claude API R$ 50–300 conforme o uso, domínio cerca de
  R$ 4). Valores aproximados, a confirmar na contratação.
- Descartados: Cloudflare para o back-end (Nest.js + Prisma não rodam bem em
  Cloudflare Workers) e o banco MySQL remoto que o usuário já tem.
- Evitar hospedagem compartilhada; o back precisa de VPS.
- O deploy do back deve ser automatizado (GitHub → VPS) e documentado, para o
  usuário não precisar mexer no servidor.

### Mapeamento do Operand
O usuário quer o esqueleto completo do sistema, com regras de negócio, telas,
campos e fluxos, usando o Operand como referência. Os dados da agência serão
cadastrados pelo próprio usuário; não é preciso extrair nem migrar dados.
- **Como:** navegar pelo Operand no Chrome do usuário, com o login dele, um
  módulo por vez. A extensão Claude in Chrome ainda não está ligada ao Claude
  Code (falta o conector; `/chrome` deve configurar). Por isso o mapeamento
  usa uma **janela separada do Chrome** com perfil próprio e porta de
  depuração local 9222 (o Chrome 136+ não abre a porta no perfil padrão). O
  usuário faz login nela, e o agente lê por CDP e pelo MCP `rea`, bloqueando
  toda requisição que não seja GET. Para ver formulários e menus de ação, o
  agente lê o JS do front em vez de clicar; o classificador do modo automático
  recusa cliques em "Adicionar", "Duplicar" e similares.
- **Base local do `rea`:** `C:\Users\Iberika\operand-rea`, fora do repositório
  (tem código do Operand, que não pode entrar aqui). Contém o front inteiro já
  baixado (app4 e legado app3), índices (rotas com permissão, modais, endpoints,
  1.658 textos pt-BR), evidências do `rea` e as ferramentas (Chrome de leitura,
  guarda de escrita, leitores). Instruções no `README.md` de lá e na skill
  `.claude/skills/mapear-operand`.
- **Saída:** um arquivo por módulo em `docs/operand/`, com telas, campos (nome,
  tipo, obrigatoriedade, validações), fluxos, regras de negócio, relações com
  outros módulos e permissões.
- **Limite:** usar o Operand só como referência funcional. Não copiar código,
  textos, marca, logos nem visual; o "operador" tem implementação e identidade
  próprias.
- **Cuidado:** só ler. Nunca criar, editar ou excluir nada no Operand, e não
  colocar nos documentos dados reais de clientes da agência.

### Status e próximos passos
1. Mapeados em 13/10/2026: **Projetos** (`docs/operand/projetos.md`) e
   **Jobs** (`docs/operand/jobs.md`; o kanban não carrega cards com a guarda
   ativa, e a estrutura veio do código). **Propostas**
   (`docs/operand/propostas.md`; a agência quase não usa o módulo; a tabela
   de preços está vazia e o único encargo é "Sem encargo"). **Timesheet**
   (`docs/operand/timesheet.md`, só do código), **Cadastros**
   (`docs/operand/cadastros.md`), **Financeiro** (`docs/operand/financeiro.md`),
   **Mídia** (`docs/operand/midia.md`) e **Produção**
   (`docs/operand/producao.md`; sem uso desde meados de 2023) e
   **Configurações gerais** (`docs/operand/configuracoes.md`: perfil,
   notificações, empresas, usuários e perfis de permissão, equipes, módulos,
   integrações, webhooks, Acesso Cliente e Geral), **Conversas**
   (`conversas.md`; 1 conversa de teste na conta), **Agenda** (`agenda.md`;
   parada desde 2025), **Dashboard** (`dashboard.md`; cards lidos do código)
   e **Relatórios** (`relatorios.md`; catálogo e recursos comuns).
   **Mapeamento concluído em 13/10/2026.** Próximo passo: revisar a lista de
   módulos da v1 com o usuário.
   A conta tem 38 usuários ativos (todas as licenças) e 1 empresa; Acesso
   Cliente, Timesheet Automático, CENP e API estão desligados, e só se aponta
   horas em jobs.
   A sessão do Operand cai com frequência, provavelmente por login simultâneo
   do usuário em outro navegador ("login concorrente").
   **Uso real na conta (13/10/2026):** 4.314 projetos, ~38 mil jobs, 6.188
   mídias, 1.028 produções, 7 propostas, 0 contratos de fee, 3 lançamentos
   financeiros. Mídia é muito usada e não está na lista de módulos da v1;
   Produção tem mais de mil documentos, mas está parada desde 2023;
   Propostas e Financeiro quase não são usados. A guarda de escrita
   precisa liberar a renovação do login (`securetoken.googleapis.com` e
   `verifyCustomToken`); sem isso, a sessão cai.
2. ~~Continuar um módulo por vez em `docs/operand/`~~ (concluído).
3. Lista de módulos da v1 definida (13/10/2026: sem CENP; Financeiro e
   Produção entram) e modelo de dados aprovado (`docs/modelo-de-dados.md`,
   com as decisões do usuário na seção 7).
4. **Código em andamento** (14/10/2026). Feito:
   - npm workspaces na raiz (uma `node_modules`); `backend/` com Nest 12 (ESM,
     testes com **Vitest**, padrão do Nest 12; o usuário ainda pode pedir Jest)
     e `frontend/` com Next 16.4 (App Router, `src/`, Cache Components ligado).
     O Next 16 muda APIs: antes de mexer no front, ler o guia em
     `node_modules/next/dist/docs/`.
   - Prisma 7.10, um arquivo por módulo em `backend/prisma/schema/`, migração
     inicial `20261013000000_init` (conferida: `migrate diff` contra o schema
     vazio; em 20/10, antes de existir banco, editada para o schema do `auth`
     se chamar `access`, porque o Supabase reserva `auth`, e sem as tabelas da
     `ai`). `deploy/banco.sql`: as migrações + o registro em
     `_prisma_migrations`, para criar o banco à mão (conferido no PGlite:
     checksums iguais aos do Prisma, `migrate deploy` sem pendências e
     `migrate diff` sem diferença). Seed idempotente `prisma/seed.ts` (8 perfis do Operand, status de
     projeto/job/mídia/produção/financeiro, jornada padrão, "Sem encargo",
     formas de pagamento, categorias, conta principal e o dono da conta via
     `OWNER_EMAIL`/`OWNER_PASSWORD`). O perfil "Conversa" ficou de fora (só dá
     acesso a Conversas, fora da v1).
   - Backend ligado no `app.module.ts`: `auth` (login, refresh rotativo, troca
     de senha, usuários com senha provisória; endurecido em 20/10: 3 erros por
     e-mail + IP bloqueiam 15 min (em memória, `trust proxy` só da rede
     privada), senha provisória cobrada na API (claim `mcp`, 403 fora de
     troca de senha/me/logout), reuso de refresh derruba todas as sessões e
     o front renova uma vez por vez entre abas (Web Locks); perfis, equipes, colaboradores,
     funções; guard de permissões `@RequireAccess`/`@RequireAdministrator`/
     `@LoadAccess` em `auth/public`, cache de 30 s; o dono é sempre
     administrador), `crm` (pessoas com papéis, CPF/CNPJ validado e sem
     duplicar, contatos, anotações, grupos, departamentos, histórico),
     `settings` (agência) e `projects` (projetos, jobs, tarefas, status,
     briefings predefinidos, comentários com menção só de envolvidos,
     histórico, favoritos, projeto "Geral" bloqueado, projeto oculto,
     arquivar/cancelar em cascata, `reserveDocumentSequence`, prazo sem hora =
     fim do dia no fuso da agência).
   - Teste de arquitetura com dependency-cruiser (`npm run lint:arch`); `npm
     test` na raiz roda unitários, e2e (sem banco) e arquitetura.
   - Front: shadcn/ui, camada de serviços em `src/services` (renova o token
     sozinha), login, troca de senha obrigatória no primeiro acesso, pautas de
     jobs (minha/geral, filtros, atrasados), job (tarefas, comentários,
     histórico), projetos, cadastros (ficha e contatos) e configurações
     (agência e usuários).
   - Verificado contra um PostgreSQL embutido (PGlite, fora do repositório):
     migração, seed, roteiro de API completo e navegação no Chrome headless.
     O PGlite é de conexão única: para testar com ele, usar
     `DATABASE_POOL_MAX=1`.
   - `timesheet` (14/10/2026): cronômetro (um por usuário, índice único
     parcial), apontamento manual (sem data futura; editar tempo ou data vira
     manual), retrabalho, custo pelo valor/hora do dia, estimado × realizado
     do job (soma as tarefas), pauta de horas, jornadas (troca vale a partir de
     amanhã). Ligado a `projects` por ganchos de ciclo de vida
     (`registerLifecycleListener` na fachada de `projects`): job ou tarefa com
     cronômetro ativo não conclui nem cancela, e arquivar ou cancelar o
     projeto para os cronômetros dele. Assim `projects` não depende de
     `timesheet` (sem ciclo entre módulos). No front: cronômetro no topo,
     aba Timesheet do job e pauta `/timesheet`.
   - `media` (14/10/2026): mídias (PI) de todos os tipos, peças com letra,
     grades (praça + período, duplicar), linhas por tipo (TV/rádio com
     calendário de inserções só nos dias em que o programa vai ao ar; externa
     com bi-semanas), desconto da linha em % ou valor (migração
     `20261014120000_media_line_discount`), bonificação fora do valor,
     desconto geral, comissão padrão de 20%, comissão negociada, honorários,
     valor líquido e prévia das faturas por tipo de faturamento (FLCC, FBCC,
     FLCA, FL+CCA, FBCA; contas em centavos em `media/domain/media-math.ts`).
     Trocar o veículo (ou o canal, na TV) pede confirmação e apaga as grades.
     Número dividido com jobs; arquivar/cancelar o projeto fecha as mídias.
     Redes, praças, programas, métricas de custo e status. Front: pauta
     `/midia`, documento `/midia/:id` e `/midia/configuracoes`.
     Envio ao financeiro (`/medias/:id/send-to-finance`): só as faturas que
     passam pelo caixa da agência viram lançamento; a mídia fica travada,
     com retrato (snapshot) de cliente, veículo e valores; reabrir o
     faturamento cancela as faturas se nenhuma foi quitada.
     Projeto oculto (20/10): mesma regra do job, pela fachada de projects
     (`getHiddenProjectIdsNotInvolving`), filtrado no WHERE da pauta. (PDF do PI feito
     em 19/10; tabelas de preço de TV/rádio descartadas em 20/10.)
   - `finance` (15/10/2026): receitas e despesas à vista, parceladas (sobra
     dos centavos na última; datas mensais sem pular mês) ou recorrentes;
     acréscimos e descontos (só à vista); quitar (em lote, só um tipo),
     cancelar (só esta, esta e as próximas, todas abertas), reabrir; fatura
     de documento não muda de pessoa/cliente/projeto e só se cancela pelo
     documento; transferências entre contas (data futura = agendada;
     guardadas só na tabela `transfer`, sem lançamentos-par, para não exigir
     pessoa); saldo por conta; resumo do período; plano de contas do Operand
     no seed (com PI/PP – Repasse, PI – Veículos e PP – Fornecedores para o
     envio dos documentos); permissões por nível e por receitas, despesas e
     transferências. Gancho `beforeProjectCancel`: projeto com faturas não
     cancela. Front: `/financeiro` (mês a mês) e `/financeiro/configuracoes`.
     Fora da v1 (como no mapeamento): conciliação OFX, boleto, NFS-e, rateio
     por centro de custo e agrupamento de faturas.
   - `production` (15/10/2026): produções (orçamento ao cliente) com itens
     de várias quantidades; cada item é cotado com vários fornecedores
     (valor unitário por quantidade) e se aprova uma quantidade por
     fornecedor; BV (comissão) e honorários por item, em % ou valor; encargo
     da produção (só troca sem pedido enviado). Os itens aprovados geram um
     pedido de produção (PP) por fornecedor (e grupo de pedido), com tipo de
     faturamento, desconto, BV negociado, entrega e 1º vencimento. Envio do
     pedido ao financeiro pelo mesmo plano de faturamento da mídia (movido
     para `finance/public/billing.ts`, usado pelos dois módulos); depois do
     envio, os itens daquele fornecedor ficam travados até reabrir o
     faturamento. Produção com pedido enviado não cancela; arquivar ou
     cancelar o projeto fecha as produções. Front: pauta `/producao` e
     documento `/producao/:id` (cotação, pedidos, dados gerais).
     `backend/tsconfig.json` ganhou `useDefineForClassFields: false`: sem
     isso, campos opcionais dos DTOs viravam `undefined` e apagavam valores
     em `{ ...atual, ...entrada }`.
     Produção descartada em 20/10/2026 (não usada pela agência): PDFs do
     orçamento e do PP, textos padrão e tela de configurações não serão
     feitos.
   - `files` (15/10/2026): anexos de projetos, jobs, tarefas, mídias,
     produções, cadastros e lançamentos. Cada módulo dono registra um
     resolvedor na fachada de `files` (`registerOwner`, em `onModuleInit`)
     dizendo quem vê e quem altera os anexos dos seus documentos; `files` não
     conhece as regras dos outros. Storage trocável (`FILE_STORAGE`): com
     `SUPABASE_URL`, Supabase Storage pela API REST (bucket privado, link
     assinado de 5 min); sem, pasta local com link assinado por HMAC servido
     em `/files/content/:token`. Limite por arquivo (`FILES_MAX_MB`, padrão
     100) e cota opcional (`FILES_QUOTA_GB`); excluir marca inativo e apaga
     o arquivo do storage. Front: componente `Attachments` (arrastar e
     soltar, descrição, ver, baixar, excluir) nas abas de job e projeto, na
     produção, nos cards da mídia e do cadastro e num diálogo por lançamento
     no financeiro. Pendente: logo da agência (para os PDFs), reordenar
     arrastando e aprovação de peças.
   - `notifications` (15/10/2026): avisos no sistema (sem e-mail, que é
     extra). Fachada só de ação: `notify({ event, userIds, actorId, action,
     target })`; monta a frase com o nome de quem agiu, tira o autor e quem
     desligou o evento, aceita só links internos e nunca lança (um aviso que
     falha não desfaz a ação). Eventos da v1: fui mencionado; comentaram em
     documento de que sou responsável; fui envolvido (responsável ou membro,
     em projeto, job, mídia e produção); concluíram (ou arquivaram) algo de
     que sou responsável; reabriram algo em que estou envolvido. Em
     `projects`, os textos ficam em `ProjectsNotifier`. Front: sino no
     cabeçalho (contador a cada minuto e ao voltar à aba, lista, marcar
     lidos) e preferências em "Notificações" no menu do usuário.
     Pendente: aprovação de peças (eventos próprios), avisos do financeiro.
   - Aprovação de peças (15/10/2026, em `projects`): quem pode alterar o
     projeto ou job pede a aprovação de um anexo dele a envolvidos (sem
     incluir a si mesmo), com prazo opcional; um pedido aberto por arquivo.
     Regra escolhida (o Operand não mostra): **qualquer reprovação reprova
     na hora; aprova quando todos aprovam**. Reprovar exige motivo; cada
     aprovador vota uma vez; cancelar só quem pediu ou nível Total; marcadores
     (posição em %) só de envolvidos e só com o pedido aberto. Avisos:
     pedido aos aprovadores, aprovado/reprovado a quem pediu. Acesso ao
     documento centralizado em `DocumentAccessService` (comentários e
     aprovações). Front: selo da situação e botão "Solicitar aprovação" nos
     anexos de job e projeto (o componente de anexos recebe extensões por
     arquivo), diálogo com a imagem, marcadores e votos, e o painel
     "Aprovações para você" na pauta de jobs.
   - Templates e duplicação (15/10/2026, em `projects`): templates de
     projeto (título, briefing, jobs ordenados com responsável, status,
     briefing e tarefas); criar e editar exige nível Total em projetos.
     Projeto novo a partir de template, aplicar template em projeto aberto,
     job novo a partir de job de template (o que vier no formulário troca
     o do modelo), incluir as tarefas de um job de template num job, salvar
     projeto ou job como template. Duplicar job (cliente e projeto de
     destino; tarefas não canceladas voltam abertas) e duplicar projeto
     (envolvidos e jobs não cancelados). Responsáveis desativados e status
     inativos viram vazio na cópia. Tudo passa por `JobsService` e
     `ProjectsService` (`DocumentCopyService`), com as mesmas validações.
     Front: `/projetos/templates` (lista e editor), template no "Novo
     projeto", modelo no "Novo job" e menu ⋮ no projeto e no job.
     Pendente: duplicar mídias e produções junto com o projeto; dependência
     entre tarefas (workflow) nos templates.
   - Jobs: recorrência, adiar e workflow (19/10/2026). Recorrência a partir
     do prazo do job (diária com opção de dias úteis, semanal nos dias
     escolhidos, mensal no mesmo dia ou no último dia; termina após N vezes
     ou numa data; no máximo 50 jobs): cria as cópias na hora, no mesmo
     projeto, com início e prazos deslocados mantendo a hora local; cada
     job guarda "recorrente X/Y" no campo `recurrence`. Adiar prazos
     (`/jobs/postpone`, em lote): minutos a anos, job/tarefas/ambos,
     "somente dias úteis"; sem prazo fica de fora; passa pelo update do job
     (entra no histórico). Workflow: cada tarefa aberta depende da anterior;
     tarefa bloqueada não conclui; dependências manuais sem ciclo
     (`PUT /tasks/:id/dependencies`). Regras em
     `projects/domain/schedule-rules.ts`. Front: "Repetir job" e "Adiar
     prazos" no menu ⋮ do job, selo "Job recorrente X/Y", botão de workflow
     e selo "bloqueada" nas tarefas. Em 20/10: editar dependências tarefa a
     tarefa no front e adiar em lote pela pauta (seleção múltipla). Fora da
     v1: copiar dependências na recorrência/duplicação.
   - PI e logo (19/10/2026): página `/midia/:id/pi` para imprimir ou salvar
     em PDF pelo navegador (sem gerar PDF no servidor, sem dependência nova):
     agência com logo, veículo e cliente (razão social, CNPJ, endereço),
     campanha, peças, grades e linhas, totais, faturamento, observações ao
     veículo e assinaturas. Layout fixo (sem as preferências do PDF do
     Operand). Logo: anexo de imagem da agência (`ownerType` `agency`, id
     fixo `00000000-…`, registrado por `settings`; todos veem, só
     administrador troca), enviado em Configurações; vale a imagem mais
     recente. O campo `logoFileId` da agência segue sem uso.
   - Docker e deploy (19/10/2026), passo a passo em `docs/deploy.md`:
     `backend/Dockerfile` (migrações rodam ao subir), `frontend/Dockerfile`
     (só local), `docker-compose.yml` local (PostgreSQL, API e front),
     `deploy/docker-compose.prod.yml` na VPS (API + Caddy com HTTPS; variáveis
     em `deploy/.env`, modelo em `deploy/.env.example`), `netlify.toml` e
     `.github/workflows/deploy.yml` (push na `main`: testes e depois SSH na
     VPS com `git pull` e `up --build`). **Não testado com Docker de
     verdade** (o Docker não está instalado na máquina do usuário): conferir
     no primeiro deploy, principalmente a conexão SSL com o Supabase.
   - `ai` (20/10/2026): `GET /ai/status` e `POST /ai/chat` (SSE no `res`;
     histórico só texto, 1–40 mensagens, sem conversa salva). Loop manual de
     tool use com `claude-opus-5-5` (effort medium, `fallbacks: "default"`,
     até 8 rodadas). 5 ferramentas só de leitura (buscar_jobs, detalhes_job,
     horas_job, resumo_financeiro, buscar_midias) pelos métodos `*ForUser`
     das fachadas, com as mesmas permissões das telas (projeto oculto
     incluído). Sem `ANTHROPIC_API_KEY` o recurso fica desligado. Qualquer
     usuário logado usa; sem limite de uso. Financeiro nível 1 vê o saldo
     de todas as contas, como na tela (decisão do usuário). Front:
     `/assistente`, item no menu e "Analisar com o assistente" no ⋮ do job.
     Verificado só contra um Claude simulado (`ANTHROPIC_BASE_URL`).
     **Configuração da Anthropic pausada** a pedido do usuário (20/10): não
     pedir chave nem testar com a API real até ele retomar.
   Descartado em 20/10/2026 (o usuário confirmou que a agência não usa a
   Produção nem as tabelas de preço): PDFs do orçamento e do PP da produção,
   tela de configurações da produção e tabelas de preço de TV/rádio da mídia.
   Agentes (`.claude/agents/`, 20/10/2026): `backend`, `frontend`, `testes`,
   `seguranca` (auditoria defensiva do próprio operador) e
   `verificador-requisitos` (confere o CLAUDE.md contra o código, só leitura).
   O usuário recusou "agentes de invasão": ferramenta ofensiva sem alvo nem
   escopo, não feita.
5. Engenharia reversa de faturamento (14/10/2026): resultados em
   `docs/operand/midia.md` (2.8) e `producao.md` (2.9); registro técnico em
   `C:\Users\Iberika\operand-rea\saida\rea\achados-faturamento.md`. O legado
   (app3) exige login próprio; a guarda de escrita libera só o login.

---

## Parte 2 — Handoff: instalação do REA

### O que é
O REA (https://github.com/morluto/rea) é um servidor MCP de engenharia reversa
(pacote npm `rea-agents`, comando `rea`). Ele analisa localmente binários
nativos, apps JavaScript/Electron, assemblies .NET, sites, firmware e apps
Android (via ADB). Os resultados vêm com evidências e limitações. Não faz
parte do código do aplicativo: é uma ferramenta do agente.

### Estado atual
- O REA 6.4.0 está instalado globalmente (`npm install --global rea-agents`).
- MCP `rea` registrado só no Claude Code, em `C:\Users\Iberika\.claude.json`
  (backup em `.claude.json.rea.backup`), apontando para a instalação global.
  Para reconfigurar: `rea setup --client claude_code --yes` (com sublinhado;
  `--all-detected` recriaria registros para outros agentes).
- Skill `reverse-engineer-anything` instalada em `C:\Users\Iberika\.claude\skills`.
- O MCP `rea` conecta no Claude Code e expõe mais de 150 ferramentas (ex.:
  analyze_javascript_application, open_binary, binary_overview,
  inspect_managed_artifact, analyze_web_bundle, compare_application_versions).
- Os registros que o setup criou para outros agentes (Gemini CLI, Copilot CLI
  e o `mcp.json` do VS Code) foram removidos. Ainda resta uma cópia da skill em
  `C:\Users\Iberika\.agents\skills\reverse-engineer-anything`, que não é usada.
- A instalação local antiga foi removida do repositório.
