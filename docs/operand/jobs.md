# Operand: módulo Jobs (mapeamento funcional)

> Referência funcional para o módulo `projects` do operador (jobs, tarefas,
> prazos e aprovações). Descreve **o que** o Operand faz, não **como** ele faz:
> não reproduzir código, textos de interface, marca nem visual. Exemplos usam
> dados fictícios. Complementa [projetos.md](projetos.md).

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Conta da agência no Operand (menu JOBS e Configurações › Jobs) |
| Método | Somente leitura. Telas lidas de forma passiva e respostas de leitura (GET) da API. Componentes que exigiriam clicar em ações foram extraídos pelo **MCP `rea`** (`inspect_web_page` + `export_web_scripts`, leitura estática do front) e da base local com o front inteiro (`C:\Users\Iberika\operand-rea`). Exigências de permissão por tela vieram das rotas do front. Uma guarda bloqueou toda requisição de escrita. |

Marcações de origem:
- sem marcação: visto na tela ou na API;
- **(código)**: extraído dos componentes do front, sem abrir a tela;
- **(inferido)**: dedução a partir do código, sem texto explícito.

---

## 1. Conceito

- **Job** é a unidade de trabalho da agência, por exemplo "KV", "E-mail
  marketing", "Desdobramento ON".
- Todo job pertence a **um cliente** e a **um projeto**. Sem projeto, vai para
  o projeto "Geral" do cliente (ver [projetos.md](projetos.md)).
- Número do job: `<nº do projeto>.<sequência no projeto>`, por exemplo
  `1234.3`.
- Um job tem **tarefas** (subtarefas): passos com responsável, prazo e status
  próprios, opcionalmente encadeados em **workflow** (dependências).
- Horas são lançadas no job ou nas tarefas (timesheet). O job soma o tempo
  **realizado** e o tempo **estimado**.
- **Situação** (aberto / concluído / cancelado) é diferente de **status** (etapa
  configurável, como Criação ou Aprovação Cliente).
- Arquivos do job podem passar por **aprovação** de usuários envolvidos.

---

## 2. Telas

### 2.1 Pautas (visões da lista de jobs)

Todas as pautas compartilham a barra superior:
- título "Jobs / <visão>" e **+ Adicionar**;
- seletor de visões (6 ícones), na ordem: Minha pauta, Pauta, Pauta por
  status, Pauta por responsável, Timeline, Timesheet;
- **Busca**;
- **Filtros** (painel lateral);
- **Ajustes e configurações rápidas** (painel lateral).

| Visão | Rota | O que mostra |
|---|---|---|
| **Minha pauta** | `/jobs/minhapauta` | Jobs e tarefas em que o usuário está **envolvido**, agrupados pelo usuário. Colunas: Título, Tarefas, Prazo, Cliente/Projeto, Envolvidos, Status. Sem dados: "nenhum job encontrado". |
| **Pauta** | `/jobs` | Lista geral filtrável (padrão: abertos). Cada linha: avatar do responsável, número + título, nº de tarefas abertas, prazo (vermelho se atrasado, laranja se vence hoje), cliente / projeto, etiqueta de status e menu ⋮. Rodapé "Exibindo N de M", com rolagem infinita. |
| **Pauta por status** (código) | `/jobs/kanban/status` | Kanban com uma coluna por status (as colunas visíveis são escolhidas nos ajustes rápidos) e cards de jobs/tarefas. **Arrastar o card para outra coluna muda o status.** Tem modo de seleção (Shift para vários), busca rápida e checagem periódica de prazos. Sem colunas escolhidas, mostra "nenhum status (coluna) selecionado". |
| **Pauta por responsável** (código) | `/jobs/kanban/responsavel` | Kanban com uma coluna por usuário (escolhidos nos ajustes rápidos). Exige nível **Leitura total** ou maior em Jobs. |
| **Timeline** | `/jobs/timeline` | Grade mensal: **linhas = usuários**, colunas = dias do mês (fim de semana destacado, hoje marcado). Navega por mês ou dia ("hoje", anterior, próximo). Barras = jobs/tarefas no período; mostra dependências entre tarefas. Usa a **jornada de trabalho** cadastrada. É um recurso do plano ("Timeline") e exige nível **Leitura total** ou maior. |
| **Timesheet** (código) | `/jobs/timesheet` | Cards por usuário com cronômetros **ativos** e **concluídos**. Permite **parar** um timesheet e abrir o relatório de timesheet. Filtros: usuário, situação dos timesheets, cliente, projeto, empresa. Exige nível **Leitura total** ou maior. (Sem cronômetros no momento do mapeamento.) |

**Colunas configuráveis da pauta (código)**: Responsável, Tarefas, Consumo de
horas (realizado × estimado), Prazo, Cliente/Projeto, Envolvidos, Data de
criação, Status, Valor. Há também ícones de **aprovação em andamento** e de
**compartilhado com o cliente**.

**Filtros (código)**:
- Tipo (job e/ou tarefa);
- "Visualizar tarefas bloqueadas" (tarefas presas por workflow);
- Situação dos jobs (abertos, concluídos, cancelados);
- Cliente e Projeto;
- Status;
- Envolvidos, Requisitante e Responsável;
- Período de datas;
- Visibilidade (projetos ocultos).

O filtro fica salvo como preferência do usuário.

**Ajustes e configurações rápidas (código)**:
- Ordenação.
- "Configurar exibição": quais informações do job aparecem na linha ou card.
- Na timeline e no kanban por responsável: quais **usuários ativos e
  inativos** viram linhas ou colunas.
- No kanban por status: quais **status** viram colunas.
- Link "Mais configurações".

**Ações em lote (código)**: selecionar jobs/tarefas e então:
- alterar responsável;
- alterar datas;
- **adiar prazos**;
- alterar status;
- concluir, cancelar ou reabrir.

Cada ação pede confirmação.

### 2.2 Novo job (modal) (código)

Abre pelo **+ Adicionar** da pauta ou de dentro de um projeto (já com cliente e
projeto preenchidos).

| Campo | Tipo | Obrigatório | Comportamento |
|---|---|---|---|
| Título | texto (máx. 250) | sim | Limpa caracteres inválidos. Tem **autocompletar pela tabela de preços**: escolher um item preenche o briefing, o **tempo estimado** (tempo-base do item) e liga o job ao item de preço. |
| Cliente | seleção (clientes ativos) | sim | |
| Projeto | seleção (projetos do cliente) | não | Desabilitado até escolher o cliente. Sem projeto, o job vai para o "Geral" do cliente. |
| Responsável | seletor de usuário | não | |
| Prazo | data, com hora opcional, + **data de início** opcional | não | Opção "sem prazo" |
| Briefing | texto rico (sem imagem) | não | Seletor de **briefing predefinido de jobs** |

Botões:
- **Salvar e editar**: abre o job criado para adicionar tarefas e anexos;
- **Salvar e adicionar novo**;
- **Salvar**.

**Criar job a partir de template**: um ícone troca o modal para uma tabela de
jobs-modelo.
- Colunas: template, job, responsável, status, nº de tarefas e preview das
  tarefas.
- Tem busca e permite escolher um.
- Cria o job com briefing, responsável, status e tarefas do modelo.

Regra: não é possível criar nem duplicar job para **cliente inativo**.

### 2.3 Job aberto (modal sobre a pauta, `/jobs/:id`)

**Barra do topo**
- Botão **Concluir** (vira **Reabrir** no job fechado).
- Responsável (seletor).
- Prazo (seletor de data, com recorrência; ver 2.5).
- Indicador de posição do status **(inferido)**.
- Status (seletor).
- Envolvidos (ícone com contador e lista de usuários).
- Menu ⋮ e botão fechar.

**Cabeçalho**: número + título (editável) e "Cliente > Projeto", com link para
o projeto.

**Menu ⋮ do job (código)**
| Item | O que faz |
|---|---|
| Mais informações | Empresa emissora, requisitante, contato do cliente e "criado por" |
| Copiar link | Copia o endereço do job |
| Duplicar job | Escolher cliente/projeto de destino. Mostra "aguarde" e depois "o job foi duplicado", com contagem para redirecionar e as opções **Ficar aqui** / **Ir agora**. |
| Mover job | Escolher **outro projeto**, com aviso antes de confirmar |
| Exportar/Imprimir job | Escolher o que imprimir: briefing, envolvidos, comentários, tempo realizado, tarefas, tarefas › responsáveis, tarefas canceladas |
| Compartilhar com o cliente | Liberar o job para usuários do cliente no **Acesso Cliente**, conforme o perfil de permissão do cliente (ver, comentar, anexar…). Também dá para descompartilhar. Job de projeto oculto não pode ser compartilhado. *(O módulo Acesso Cliente não está ativo nesta conta.)* |
| Cancelar job | Cancela o job e as tarefas |
| Templates | Usar job de template (insere as tarefas do modelo neste job), criar template a partir deste job, ver templates |

**Coluna esquerda: Tarefas**
- Barra:
  - **buscar tarefas**;
  - **workflow** (ativar ou remover dependências);
  - templates;
  - **adiar prazos**;
  - **ordenar** (prazo crescente, prazo decrescente ou ordem original);
  - contador "Abertas X/Y".
- Cada tarefa mostra:
  - círculo para **concluir**;
  - ▶ para **iniciar o cronômetro**;
  - ícone de dependência;
  - responsável;
  - prazo (cores de atraso);
  - status;
  - menu ⋮.
- As tarefas podem ser reordenadas arrastando.
- "Adicionar uma tarefa": campo na própria lista (Enter salva, Esc cancela).
- Aviso "Job ou tarefas em atraso. Adiar prazos?" quando há atraso.

**Briefing do job**
- Editor de texto rico com imagens.
- Mostra quem está editando ("X está editando o briefing…"), com botão para
  **atualizar o briefing**.
- Guarda **versões do briefing**.
- Permite inserir um briefing predefinido.
- Mostra o briefing do **projeto** (ou "não há briefing cadastrado no
  projeto").

**Coluna direita: abas**
| Aba | Conteúdo |
|---|---|
| Comentários | Conversa com menções (só de envolvidos), **respostas/citações** de outro comentário, edição e exclusão ("este comentário foi excluído"), blocos de código, aviso de quem está digitando e **solicitações de aprovação** (ver 2.4) |
| Anexos | Enviar vários arquivos de uma vez, **reordenar arrastando**, descrição por arquivo, situação de aprovação, download, excluir e **enviar ao Hype Social** (integração de redes sociais, com limites de formato e tamanho) |
| Timesheet | Realizado × estimado (com explicação de cada um) e lançamentos (N = normal, RT = retrabalho). **Apontamento manual**: data (não pode ser futura), horas, tarefa e descrição. **Estimar**: informar o tempo estimado. Editar o tempo ou a data de um lançamento o converte em apontamento manual. |
| Histórico | Auditoria das alterações (quem, quando, campo, de → para) |

### 2.4 Aprovação de arquivos (código)

1. Num anexo, **Solicitar aprovação**: escolher os aprovadores ("aprovar
   com", entre os **usuários envolvidos** no job) e um **prazo**.
2. O pedido aparece nos comentários: "X enviou uma solicitação de aprovação",
   com o prazo e a data do pedido.
3. Cada aprovador vota **aprovar** ou **reprovar**. Ao reprovar, informa o
   motivo. Só os aprovadores escolhidos votam, uma vez cada; **quem pediu a
   aprovação não vota** no próprio pedido; pedido cancelado não recebe votos.
4. Em imagens dá para **marcar pontos** (clicar na imagem para inserir
   marcadores) para comentar trechos.
5. Situações do arquivo: **em aprovação**, **aprovado**, **reprovado**. O
   pedido também pode ser **cancelado**, e o histórico registra quem aprovou,
   reprovou ou cancelou e quando.
6. Um painel mostra "novas solicitações de aprovação" para o usuário.

O resultado final (aprovado/reprovado) é calculado pelo servidor; o front só
mostra o voto de cada aprovador. Não dá para ver se exige todos ou basta um.

### 2.5 Prazos, recorrência e adiamento (código)

- **Prazo**: data, com hora opcional e **data de início** opcional, ou "sem
  prazo".
- **Recorrência** do job, configurada no seletor de prazo:
  - diária: a cada N dias, com opção de só dias úteis;
  - semanal: a cada N semanas, nos dias da semana escolhidos (pelo menos um);
  - mensal: a cada N meses, no mesmo dia do mês ou no último dia;
  - termina após N vezes ou numa data;
  - limite de **50 jobs** por recorrência.

  Os jobs são criados em segundo plano, com aviso ao terminar. Cada um mostra
  "Job recorrente X/Y". Só uma recorrência por vez em cada projeto.
- **Adiar prazos** (no job, na lista de tarefas ou em lote):
  - adiar em horas, minutos, dias, semanas, meses ou anos;
  - escolher se adia o job, as tarefas ou os dois;
  - opção **somente dias úteis**;
  - itens sem prazo são ignorados, com aviso;
  - no fim mostra quantos jobs e tarefas foram adiados.

### 2.6 Workflow (dependências entre tarefas) (código)

- Com o workflow ativo, **cada tarefa só pode ser iniciada depois que a
  anterior for concluída**. Ativar exige pelo menos **2 tarefas abertas**.
- Por tarefa: "**depende de**" (pré-requisito) e "**bloqueia**" (tarefas que
  dependem dela).
- "Remover dependências" desfaz todas as ligações do job.
- A pauta pode mostrar ou esconder as **tarefas bloqueadas**.

### 2.7 Configurações do módulo (Configurações › Jobs)

| Tela | Conteúdo |
|---|---|
| **Status** | Lista de status de jobs **e tarefas**: nome, cor, ordem (arrastar), ativo/inativo e a opção **"jobs com este status não contabilizam atraso"**. Tem busca, inclusão, edição e exclusão. Os status de sistema não podem ser removidos. |
| **Grupos de status** | Grupos com nome e status, para organizar setores ou processos e usar nas pautas. Exige nível **Total**. Hoje a conta não tem grupos. |
| **Briefings predefinidos** | Modelos de briefing (título + texto) para novos jobs. Hoje há 1 cadastrado. |
| **Briefings para Acesso Cliente** | Modelos de briefing que o cliente preenche ao pedir jobs pelo Acesso Cliente. Só administradores. |
| **Templates** | Em Projetos › Templates: templates de projeto com seus jobs. Um job de template tem título, responsável, status, briefing e tarefas, com dependências entre elas. |

Configuração atual de **status de job** (útil para dados iniciais), na ordem:
1. Atendimento
2. Planejamento
3. Redação
4. Criação
5. Aprovação Interna
6. **Aprovação Cliente** (não conta atraso)
7. Programação
8. Mídia
9. T.I
10. **Entregue** (não conta atraso)

Inativos: Finalização e Templates.

---

## 3. Modelo de dados observado

### 3.1 Job
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | inteiro | auto | |
| sequência no projeto | inteiro | auto | Compõe o número `projeto.sequência` |
| título | texto (≤ 250) | sim | |
| cliente | ref. cliente | sim | Cliente ativo |
| projeto | ref. projeto | auto | Padrão: Geral do cliente |
| responsável | ref. usuário | não | |
| solicitante | ref. usuário | auto | Quem criou |
| envolvidos | lista de usuários | | |
| status | ref. status de job | não | |
| situação | enum: `aberto`, `concluído`, `cancelado` | auto | |
| data de início | data/hora | não | |
| prazo | data/hora | não | Sem hora, vale até 23:59:59 |
| tempo estimado | duração (min) | não | Pode vir da tabela de preços |
| tempo realizado | duração (min) | calculado | Soma dos lançamentos do job e das tarefas |
| briefing | texto rico (HTML) | não | Com versões |
| item da tabela de preços | ref. | não | Origem do título e do tempo-base |
| contato do cliente | ref. contato | não | |
| empresa | ref. empresa da agência | auto | Empresa emissora |
| recorrência | JSON (regra) | não | Ver 2.5 |
| compartilhado com cliente | booleano + usuários | não | Acesso Cliente |
| contadores | tarefas abertas / concluídas / canceladas, nº de anexos | calculado | |
| criado em / atualizado em / quem mudou a situação | auto | | |

### 3.2 Tarefa (subtarefa do job)
título, responsável, status (mesma lista de status de job), ordem, data de
início, prazo, concluída + data de conclusão, situação, atualizado por, tempo
realizado, **depende de** (lista) e **bloqueia** (lista).

### 3.3 Lançamento de horas (timesheet)
usuário, job, tarefa (opcional), data, duração, tipo (**normal** ou
**retrabalho**), descrição, origem (cronômetro ou **manual**), situação
(ativo/concluído). Ver o mapeamento de `timesheet`.

### 3.4 Comentário (interação)
documento (tipo + id), autor, texto, resposta a (outro comentário), situação
(ativo/removido), arquivo relacionado, fixado, reações, data.

### 3.5 Solicitação de aprovação
arquivo, solicitante, aprovadores, prazo, situação (ativa, aprovada, reprovada,
cancelada), votos (usuário, aprovar/reprovar, motivo, data), marcadores na
imagem.

### 3.6 Status de job
nome, cor, ordem, ativo/inativo, **não conta atraso**, de sistema (fixo),
grupo de status.

---

## 4. Ciclo de vida do job

```
ABERTO ── concluir ──► CONCLUÍDO ── reabrir ──► ABERTO
ABERTO ── cancelar ──► CANCELADO ── reabrir ──► ABERTO
```
- Concluir ou cancelar o projeto conclui ou cancela todos os jobs dele.
- O **status** muda livremente enquanto o job está aberto. Os status marcados
  com "não contabiliza atraso" tiram o job da conta de atrasados, por exemplo
  enquanto espera aprovação do cliente.

---

## 5. Regras de negócio

1. Título e cliente são obrigatórios; cliente inativo não recebe jobs novos
   nem duplicados.
2. Job sem projeto vai para o projeto "Geral" do cliente.
3. O número do job é sequencial dentro do projeto.
4. **Não é possível concluir nem cancelar** um job ou tarefa enquanto algum
   usuário tiver **cronômetro ativo** nele. A mensagem lista os usuários.
5. Para **reabrir** um job, o projeto precisa estar aberto.
6. Atraso = prazo vencido com job aberto, **exceto** quando o status está
   marcado como "não contabiliza atraso".
7. Workflow: uma tarefa só começa depois da anterior concluída; ativar exige
   pelo menos 2 tarefas abertas.
8. Recorrência: no máximo 50 jobs por regra e uma recorrência em processamento
   por projeto.
9. Adiar prazos ignora itens sem prazo; a opção "somente dias úteis" pula fins
   de semana.
10. Apontamento manual não aceita data futura. Editar o tempo ou a data de um
    lançamento o transforma em manual.
11. O cronômetro é **pausado automaticamente** fora da jornada de trabalho do
    usuário, e cada usuário só tem um cronômetro ativo por documento.
12. Só envolvidos podem ser mencionados nos comentários e escolhidos como
    aprovadores.
13. Cada aprovador vota uma vez; reprovação pede motivo.
14. Job de projeto oculto não pode ser compartilhado com o cliente.
15. Mover um job troca o projeto (com aviso); duplicar permite escolher
    cliente e projeto.

---

## 6. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `projects` (projetos) | Job pertence a um projeto e alimenta prazos, horas, contadores e atrasados do projeto |
| `crm` | Cliente (ativo) e contato do cliente |
| `timesheet` | Cronômetro e apontamentos por job/tarefa; jornada de trabalho; relatório de timesheet |
| `finance` / comercial | **Tabela de preços** (título, briefing e tempo-base do job); coluna "Valor" na pauta |
| `auth` | Responsável, solicitante, envolvidos, aprovadores, permissões do módulo Jobs |
| Acesso Cliente (fora da v1?) | Compartilhar jobs e briefings para o cliente |
| Integrações | Hype Social (envio de anexos) |
| `ai` | Ferramentas de leitura sugeridas: job com tarefas, atrasados por responsável, horas realizadas × estimadas, histórico de aprovações |

---

## 7. Permissões

Mesmo esquema de níveis de [projetos.md](projetos.md#7-permissões), no
módulo **Jobs**:
- **Registros próprios**: só os jobs em que o usuário é envolvido; é a base da
  "Minha pauta".
- **Leitura total**: vê tudo.
- **Total / Administrador**: edita tudo.

Exigências por tela, lidas das rotas do front:

| Tela | Exige |
|---|---|
| Minha pauta, Pauta, Kanban por status | acesso a Jobs |
| Kanban por responsável, Timesheet (pauta) | Jobs nível ≥ 2 (Leitura total) |
| Timeline | recurso "Timeline" do plano + Jobs nível ≥ 2 |
| Relatório da pauta de jobs | Jobs nível ≥ 6 (Total) |
| Configurações › Grupos de status | Jobs nível ≥ 6 |
| Briefings para Acesso Cliente | administrador |
| Timesheets (menu do usuário) | nível > 0 em Jobs, Propostas, Produção ou Mídia |

---

## 8. Notas para o operador

- Job e tarefa podem ser a mesma tabela (tarefa = filho do job) ou duas
  tabelas. O Operand trata tarefa como subtarefa do job, com status
  compartilhado.
- Separar **situação** e **status**, como em projetos, e dar ao status a opção
  "não conta atraso".
- Candidatos a ficar fora da v1:
  - recorrência;
  - workflow com dependências;
  - Hype Social;
  - Acesso Cliente;
  - marcadores em imagem;
  - versões de briefing.

  A v1 pode ter tarefas simples, aprovação de arquivo e cronômetro/apontamento.
- O kanban por status e a timeline são visões da mesma consulta de jobs, sem
  dados próprios.

---

## 9. Pendências

- **Kanbans sem dados na tela**: a coluna aparece, mas os cards não carregam
  com a guarda de escrita ativa. A tela tenta salvar uma preferência do usuário
  antes, e esse salvamento fica bloqueado. A estrutura veio do código (seção
  2.1).
- **Timesheet (pauta)**: aberto com a sessão ativa, mas sem cronômetros no
  momento.
- Regra de decisão da aprovação (todos os aprovadores ou basta um): fica no
  servidor, invisível pelo front.
- Conteúdo da coluna "Valor" da pauta: provavelmente o valor do item da tabela
  de preços **(inferido)**.
