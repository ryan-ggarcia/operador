# operador: modelo de dados da v1

> Primeira versão da modelagem do banco, feita a partir do mapeamento do
> Operand (`docs/operand/`). Define os módulos da v1, o schema PostgreSQL de
> cada um, as tabelas e campos principais e como os módulos se referenciam.
> Os nomes estão em inglês (como ficarão no código); as descrições, em
> português. Tipos e índices finais saem no `schema.prisma`.

| Item | Valor |
|---|---|
| Data | 13/10/2026 |
| Base | `docs/operand/*.md` e uso real da conta no Operand |
| Situação | Proposta para revisão do usuário, antes de criar o código |

---

## 1. Módulos da v1

| Módulo | Schema | Responsabilidade | Origem no Operand |
|---|---|---|---|
| `auth` | `auth` | Usuários, login/JWT, perfis de acesso e níveis por módulo, colaboradores (dados de RH e valor/hora), funções e equipes | Usuários e permissões, Colaboradores, Equipes |
| `crm` | `crm` | Cadastro único de pessoas com papéis (cliente, fornecedor, prestador, veículo), contatos, departamentos, grupos de clientes | Cadastros |
| `projects` | `projects` | Projetos, jobs, tarefas, status, briefings, comentários, aprovação de peças, templates, numeração dos documentos | Projetos, Jobs |
| `timesheet` | `timesheet` | Apontamentos de horas (cronômetro e manual), jornadas de trabalho | Timesheet |
| `media` | `media` | Mídias (PI), peças, grades e inserções, redes, praças, métricas de custo | Mídia (**sem CENP**) |
| `production` | `production` | Produções, itens, cotações por fornecedor, pedidos de produção, encargos | Produção |
| `finance` | `finance` | Lançamentos (receitas e despesas), parcelas, contas, categorias, centros de custo, formas de pagamento, transferências | Financeiro |
| `files` | `files` | Anexos de qualquer módulo (metadados; arquivos no Supabase Storage) | Anexos |
| `notifications` | `notifications` | Avisos no sistema e preferências por usuário (o envio por e-mail é um extra, depois da v1) | Notificações |
| `settings` | `settings` | Dados da agência (razão social, CNPJ, endereço, logo), fuso, moeda | Empresas, Geral |
| `ai` | `ai` | Conversas com o Claude, mensagens e consumo de tokens | (novo) |

**Fora da v1**: Propostas e contratos de fee, Conversas, Agenda, Acesso
Cliente, CENP-Meios, webhooks e API pública, boleto e NFS-e, conciliação
bancária (OFX), Timesheet Automático e **envio de e-mails** (extra: notificações
e redefinição de senha por e-mail). As tabelas marcadas "depois" abaixo
ficam desenhadas, mas não entram na primeira migração.

A grade de mídia e o faturamento de mídia e produção ficam **iguais ao
Operand** (decisão do usuário): todos os tipos de mídia, incluindo TV e rádio
com calendário de inserções, programas e tabelas de preço, e faturas geradas
no financeiro conforme o tipo de faturamento.

A dashboard e os relatórios não têm schema próprio: leem os dados pelas
interfaces públicas dos módulos (ver 4).

---

## 2. Convenções

| Tema | Regra |
|---|---|
| Schemas | Um schema PostgreSQL por módulo (recurso de vários schemas do Prisma, `@@schema("<modulo>")`). Um arquivo Prisma por módulo em `backend/prisma/schema/<modulo>.prisma`. |
| Chaves | `id` UUID em todas as tabelas (bom para virar microsserviço). Números para pessoas lerem ficam em colunas próprias (`number`, `sequence`). |
| Referência entre módulos | Só o id (ex.: `clientId` em `projects.project`), **sem chave estrangeira** e sem `@relation` do Prisma entre schemas. A validação é feita chamando a interface pública do outro módulo. Dentro do mesmo schema, chaves estrangeiras normais. |
| Isolamento | O Prisma gera um só cliente, então o isolamento é por regra: o repositório de um módulo só usa os modelos do próprio schema. Um teste de arquitetura (ex.: dependency-cruiser) quebra o build se um módulo importar arquivos internos de outro. |
| Exclusão | Registros de negócio não são apagados: `situation` (aberto, concluído, cancelado, inativo…). Cadastros de apoio usam `active`. |
| Auditoria | `createdAt`, `updatedAt`, `createdById`, `updatedById` em todas as tabelas de negócio. Mudanças importantes vão para a tabela `history` do módulo. |
| Dinheiro | `Decimal(14,2)`; percentuais `Decimal(7,4)`; quantidades `Decimal(14,4)`. |
| Tempo | Datas e horas em `timestamptz`; durações em **minutos** (inteiro). Prazo sem hora vale até 23:59:59 no fuso da agência (`deadlineHasTime`). |
| Texto rico | HTML higienizado no back-end (briefings, comentários, observações). |
| Status | Cada módulo tem a sua tabela de status configurável, com cor, ordem, ativo e **não conta atraso** (`ignoresDelay`). |
| Snapshot | Documentos que geram PDF (mídia e produção) guardam, ao enviar ao financeiro, um retrato dos dados de cliente, veículo ou fornecedor (`snapshot` JSON), para o PDF antigo não mudar se o cadastro mudar. |

---

## 3. Tabelas por módulo

### 3.1 `auth`

| Tabela | Campos principais | Observações |
|---|---|---|
| `user_account` | email (único), passwordHash, name, avatarFileId, signatureFileId, color, accessProfileId, customPermissions (JSON, nulo = usa o perfil), isOwner, mustChangePassword, collaboratorId (único), active, lastLoginAt | Desativar no lugar de excluir. Precisa de acesso a pelo menos um módulo. |
| `access_profile` | name, permissions (JSON: módulo → nível 0/1/2/3/6/7, mais flags), system | Dados iniciais: os 9 perfis do Operand ([configuracoes.md](operand/configuracoes.md#14-usuários-e-permissões-vista--legado)) |
| `collaborator` | personType (PF/PJ), name, document (CPF/CNPJ, único), legalName, rg, birthDate, phone, email, address (JSON), positionId, admissionDate, dismissalDate, grossSalary, totalCost, **hourlyRate**, benefits (JSON), bankData (JSON), pixKeys (JSON), cvUrl, notes, active | Dados de RH: acesso restrito e **nunca** enviados ao Claude |
| `position` | name (único) | Funções (CEO, Mídia, Atendimento…) |
| `team`, `team_member` | name; teamId + userId | |
| `refresh_token` | userId, tokenHash, expiresAt, revokedAt | Login com JWT curto + refresh |
| `password_reset` | userId, tokenHash, expiresAt, usedAt | **Depois** (junto com o e-mail). Na v1, o administrador define uma senha provisória e o usuário troca no primeiro acesso (`mustChangePassword` em `user_account`). |
| `history` | entityType, entityId, userId, action, field, oldValue, newValue, createdAt | |

**Por que colaborador fica no `auth`**: todo usuário é um colaborador, e o
valor/hora alimenta o custo das horas. No Operand o colaborador é um papel da
pessoa, mas aqui separamos a equipe interna (`auth`) de clientes e terceiros
(`crm`).

### 3.2 `crm`

| Tabela | Campos principais | Observações |
|---|---|---|
| `party` | personType, name (fantasia), legalName, document (CPF/CNPJ, único quando preenchido), stateRegistration, municipalRegistration, email, phone1, phone2, website, address (CEP, logradouro, nº, complemento, bairro, cidade, UF, país), **isClient**, **isSupplier**, **isProvider**, **isVehicle**, clientGroupId, bankData (JSON), notes, active | Uma pessoa com vários papéis; o mesmo CNPJ não vira dois cadastros |
| `contact` | partyId, name, email, departmentId, phone1, phone2, birthDate, active | Contatos de cliente, fornecedor e veículo |
| `department` | name | |
| `client_group` | name | Filtro de relatórios |
| `party_note` | partyId, authorId, html, createdAt | Aba Anotações |
| `history` | (igual ao `auth`) | |

### 3.3 `projects`

| Tabela | Campos principais | Observações |
|---|---|---|
| `project` | **number** (sequencial, único), title, clientId, description (HTML), requesterId, responsibleId, statusId, situation (open, archived, canceled), hidden, isClientDefault, desiredDeadline, budget, **lastDocumentSequence**, closedAt, situationChangedById | `isClientDefault` = projeto "Geral" do cliente (um por cliente, criado pelo sistema) |
| `project_member`, `project_favorite` | projectId + userId | |
| `job` | projectId, **sequence**, title (≤ 250), clientId, clientContactId, responsibleId, requesterId, statusId, situation (open, done, canceled), startAt, deadline, deadlineHasTime, estimatedMinutes, briefing (HTML), recurrence (JSON), closedAt | Número exibido `project.number.sequence` |
| `job_member` | jobId + userId | |
| `task` | jobId, title, responsibleId, statusId, order, startAt, deadline, situation, completedAt | Subtarefas do job |
| `task_dependency` | taskId, dependsOnTaskId | Tarefa bloqueada até a anterior concluir |
| `briefing_version` | jobId, html, authorId, createdAt | Histórico do briefing |
| `status` | docType (project, job), name, color, order, active, ignoresDelay, system, groupId | Dados iniciais: status atuais da conta ([jobs.md](operand/jobs.md)) |
| `status_group` | name | |
| `comment` | docType (project, job), docId, authorId, html, mentionedUserIds, parentId, fileId, pinned, situation | |
| `approval_request` | fileId, docType, docId, requesterId, approverIds, deadline, situation (open, approved, rejected, canceled) | Aprovação de peças |
| `approval_vote` | requestId, userId, decision, reason, createdAt | |
| `approval_marker` | requestId, x, y, html, authorId | Marcadores na imagem |
| `predefined_briefing` | docType, title, html | |
| `project_template`, `template_job`, `template_task` | título, briefing, jobs e tarefas com dependências | |
| `history` | (igual) | Histórico de projeto e job |

**Numeração dos documentos**: jobs, mídias e produções dividem a sequência do
projeto (no Operand, "1299.4" é o 4º documento do projeto 1299, seja job,
mídia ou produção). O `projects` expõe `reserveDocumentSequence(projectId)`,
que incrementa `lastDocumentSequence` numa única instrução e devolve o
número. `media` e `production` chamam essa função ao criar documento.

### 3.4 `timesheet`

| Tabela | Campos principais | Observações |
|---|---|---|
| `time_entry` | userId, docType (job, task, media, production, project), docId, projectId, clientId, startedAt, endedAt, minutes, source (timer, manual), kind (normal, rework), description, situation (running, done), **hourlyCost** | Um só apontamento `running` por usuário (índice único parcial). `projectId` e `clientId` vêm do módulo de origem, para relatórios. `hourlyCost` guarda o valor/hora do dia do apontamento. |
| `work_schedule` | title, isDefault, productiveGoalMinutesPerDay, periods (JSON: dia da semana → faixas de entrada e saída) | Dados iniciais: jornada padrão (42h30 por semana, meta 8h30 por dia) |
| `user_schedule` | userId, scheduleId, validFrom | Troca de jornada vale a partir do dia seguinte |

Na conta atual só se aponta horas em jobs. O `docType` já aceita mídia e
produção para quando a agência quiser.

### 3.5 `media`

| Tabela | Campos principais | Observações |
|---|---|---|
| `media` | projectId, sequence, clientId, title, **mediaType** (tv, radio, newspaper, magazine, ooh, internet, other), vehicleId, vehicleContactId, networkId, channel, target, estimateNumber, responsibleId, requesterId, statusId, situation, deadline, documentDate, commissionType, commissionValue, negotiatedCommission, feeType, feeValue, discountType, discountValue, grossTotal, bonusTotal, netValue (calculados e gravados), **billingType** (FLCC, FBCC, FLCA, FL_CCA, FBCA), firstDueDate, paymentCondition, vehicleNotes, clientNotes, briefing, pdfPreferences (JSON), sentToFinanceAt, snapshot (JSON) | Enviado ao financeiro = travado |
| `media_member` | mediaId + userId | |
| `media_piece` | mediaId, letter, title | Peça em uso na grade não sai |
| `media_grid` | mediaId, marketId, periodStart, periodEnd, order, replicaGroupId | Uma praça + um período |
| `media_line` | gridId, pieceId, product, location, section, position, color, format, placementType, costMetricId, startDate, endDate, biweeks (JSON), dailyInsertions (JSON, TV/rádio), insertions, unitValue, discountPercent, subtotal, isBonus | Campos usados conforme o tipo de mídia ([midia.md](operand/midia.md#23-documento-de-mídia-mtipoid-front-legado-vista)) |
| `media_installment` | mediaId, dueDate, amount, paymentMethodId, financeBillId | Parcelas planejadas; `financeBillId` preenchido ao enviar |
| `status` | name, color, order, active, ignoresDelay | Dados iniciais: Em aberto, Aprovação Interna, Aprovação Cliente, Aprovado/Enviar PI, Aguardando NF, Reprovado |
| `network` | name, mnemonic, type (open_tv, pay_tv, radio, other), active | |
| `market` | name, abbreviation, state | Praças |
| `cost_metric` | name (CPM, CPC…), active | |
| `predefined_briefing` | title, html | |
| `program` | name, mnemonic (único por rede), networkId, channel, mediaType (tv, radio), airingDays (dias da semana), startTime, endTime, active | Só se insere nos dias em que o programa vai ao ar. Programa usado numa tabela de preços não pode ser excluído. |
| `price_table` | vehicleId, mediaType, mnemonic, networkId, channel, marketId, validFrom, active | Tabela de preços do veículo por praça e vigência; importação por planilha |
| `price_table_row` | priceTableId, programId (TV/rádio), section, position, color, format, unitPrice | Jornal e revista usam seção, posição, cor e formato |
| `history` | (igual) | |

### 3.6 `production`

| Tabela | Campos principais | Observações |
|---|---|---|
| `production` | projectId, sequence, clientId, clientContactId, title, responsibleId, requesterId, statusId, situation, deadline, validityDays, taxId, taxPercent, paymentConditions, clientNotes, briefing, pdfPreferences (JSON) | |
| `production_member` | productionId + userId | |
| `item` | productionId, sequence, title, description, quantities (lista de decimais), commissionType, commissionValue, feeType, feeValue, situation | Número `projeto.sequência.item` |
| `item_supplier` | itemId, supplierId, estimateNumber, dueDate, orderGroup, situation | Fornecedor cotado no item |
| `quote` | itemSupplierId, quantity, unitValue, totalValue, commissionValue, feeValue, **approved** | Uma cotação aprovada por fornecedor em cada item (índice único parcial). Excluir uma quantidade apaga a cotação dela em todos os fornecedores. |
| `purchase_order` | productionId, supplierId, orderGroup, billingType, subtotal, discount, total, commission, negotiatedCommission, fee, tax, netValue, valueToPass, supplierNotes, deliveryPlace, deliveryDate, firstDueDate, approvedById, approvedAt, sentToFinanceAt, snapshot (JSON) | Pedido de produção (PP), um por fornecedor aprovado |
| `purchase_order_installment` | purchaseOrderId, dueDate, amount, paymentMethodId, financeBillId | |
| `status` | name, color, order, active, ignoresDelay | Dados iniciais: Em aberto, Aprovação Interna, Aprovação Cliente, Aprovado/Enviar PP, Aguardando Entrega, Reprovado |
| `tax` | title, type, percent, isDefault, active | Encargos (hoje só "Sem encargo"). Quando Propostas entrar, ela lê os encargos daqui pela interface pública. |
| `predefined_text` | kind (payment_condition, client_note, supplier_note, briefing), title, html | |
| `history` | (igual) | |

### 3.7 `finance`

| Tabela | Campos principais | Observações |
|---|---|---|
| `bill` | installmentGroupId, kind (revenue, expense), partyType (client, supplier, provider, vehicle, collaborator), partyId, title, categoryId, accountId, paymentMethodId, amount, additions, discounts, finalAmount, dueDate, paidAt, competenceDate, billingDate, installmentNumber, installmentCount, condition (single, installments, recurring), documentNumber, referenceNumber, clientId, **sourceType** (manual, media, production, project, job), **sourceId**, projectId, statusId, situation (open, paid, canceled), createdById | `partyId` aponta para `crm.party` ou, se `collaborator`, para `auth.collaborator` |
| `bill_cost_center` | billId, costCenterId, amount, percent | Rateio |
| `bill_adjustment` | billId, adjustmentTypeId, amount | Acréscimos e descontos |
| `transfer` | title, fromAccountId, toAccountId, date, amount, outBillId, inBillId, scheduled | Gera o par saída/entrada |
| `category` | name, parentId, kind, active | Plano de contas em árvore |
| `account` | name, bank, accountType, agency, number, initialBalance, isDefault, active | Conta padrão não pode ser inativada |
| `payment_method` | name, isDefault, active | |
| `cost_center` | name, active | |
| `adjustment_type` | name, sign | |
| `status` | name, color, system | Em aberto, Enviado, Agendado |
| `reconciliation_batch`, `statement_line` | **depois**: conciliação por OFX | |
| `history` | (igual) | |

**Envio ao financeiro**: `media` e `production` montam as faturas conforme o
tipo de faturamento (veículo/fornecedor × agência × cliente) e chamam
`finance.createBillsFromSource(sourceType, sourceId, bills[])`. Daí em
diante o documento fica travado. Para alterar, chamam
`finance.reopenSource(...)`, que só deixa reabrir se nenhuma fatura estiver
quitada.

### 3.8 `files`

| Tabela | Campos principais | Observações |
|---|---|---|
| `file` | storageKey, originalName, mimeType, sizeBytes, ownerModule, ownerType, ownerId, description, uploadedById, active | Arquivo no Supabase Storage (bucket privado, link assinado temporário). O Operand usa 45 GB hoje. |

### 3.9 `notifications`

| Tabela | Campos principais | Observações |
|---|---|---|
| `notification` | userId, event, title, link, payload (JSON), readAt, createdAt | |
| `preference` | userId, event, inApp, email (usado quando o e-mail entrar) | Eventos da v1: fui mencionado, fui envolvido, peça aprovada/reprovada, documento concluído ou reaberto |

### 3.10 `settings`

| Tabela | Campos principais | Observações |
|---|---|---|
| `agency` | legalName, tradeName, cnpj, stateRegistration, municipalRegistration, email, phone, address (JSON), logoFileId, timezone (`America/Sao_Paulo`), currency (`BRL`), locale (`pt-BR`) | Uma linha só (uma agência). Usada nos PDFs. |

### 3.11 `ai`

| Tabela | Campos principais | Observações |
|---|---|---|
| `conversation` | userId, title, createdAt | |
| `message` | conversationId, role, content (JSON), toolCalls (JSON), model, inputTokens, outputTokens, createdAt | Base para controlar custo da Claude API |

---

## 4. Interfaces públicas entre módulos

Cada módulo exporta um service de fachada (interface + token de injeção).
Principais métodos:

| Módulo | Métodos (leitura) | Métodos (ação) |
|---|---|---|
| `auth` | `getUsers(ids)`, `getPermissions(userId)`, `getHourlyRate(userId, date)`, `getTeams()` | — |
| `crm` | `getParties(ids)`, `searchParties(role, termo)`, `getContacts(ids)` | — |
| `projects` | `getProject(id)`, `getJobs(ids)`, `getDocumentRef(docType, id)`, `countByClient(clientId)` | `ensureClientDefaultProject(clientId)`, `reserveDocumentSequence(projectId)` |
| `timesheet` | `getMinutesBySource(docType, ids)`, `getHoursReport(filtros)` | — |
| `media`, `production` | `getSummaryByProject(projectId)`, `getSummaryByClient(clientId)` | — |
| `finance` | `getBillsBySource(sourceType, id)`, `getCashSummary(período)` | `createBillsFromSource(...)`, `reopenSource(...)`, `cancelSource(...)` |
| `files` | `list(owner)`, `getSignedUrl(id)` | `attach(owner, upload)`, `remove(id)` |
| `notifications` | — | `notify(userIds, event, payload)` |
| `settings` | `getAgency()` | — |

O módulo `ai` só usa os métodos de **leitura**, como ferramentas do Claude
(tool use). Os dados de RH do `auth` e os dados bancários não ficam expostos
às ferramentas.

Lista de nomes: as pautas mostram nomes de cliente, responsável etc. O módulo
dono da pauta busca os nomes em lote pela fachada (`getParties(ids)`,
`getUsers(ids)`), com cache curto, em vez de copiar nomes para as próprias
tabelas.

---

## 5. Permissões

- Módulos com nível (0, 1, 2, 3, 6, 7, como no Operand): projetos, jobs,
  mídia, produção, financeiro, clientes, fornecedores, prestadores, veículos,
  colaboradores.
- Flags extras: projetos ocultos, budget de projetos (nenhum / ver / ver e
  editar), financeiro por tipo (receitas, despesas, transferências).
- O JWT leva só o id do usuário e a versão das permissões; o guard do Nest
  consulta `auth.getPermissions` (com cache) e cada service aplica a regra
  "registros próprios" (é responsável, solicitante ou envolvido).

---

## 6. Dados iniciais (seed)

- Perfis de acesso (9) e níveis.
- Status de projetos, jobs, mídia, produção e financeiro com a configuração
  atual da conta.
- Jornada padrão, encargo "Sem encargo", formas de pagamento e categorias
  básicas.
- Usuário dono da conta.
- Clientes, colaboradores etc. o próprio usuário cadastra (há importação por
  planilha prevista no `crm`).

---

## 7. Decisões do usuário (13/10/2026)

1. **Grade de mídia igual ao Operand**: todos os tipos, inclusive TV e rádio
   com calendário de inserções, programas e tabelas de preço.
2. **Faturamento igual ao Operand**: mídia e produção geram as faturas no
   financeiro pelo tipo de faturamento; o documento enviado fica travado até
   reabrir.
3. **E-mail é um extra**: a v1 só tem avisos no sistema. Envio de e-mail
   (notificações e redefinição de senha) vem depois.
4. **Sem CENP**; Financeiro e Produção entram na v1.
