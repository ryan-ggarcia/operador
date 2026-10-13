# Operand: Timesheet (mapeamento funcional)

> Referência funcional para o módulo `timesheet` do operador. Descreve **o que**
> o Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual. Exemplos usam dados fictícios. Complementa
> [jobs.md](jobs.md) (aba Timesheet do job) e [projetos.md](projetos.md)
> (tempo e custo do projeto).

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Cronômetro do topo, pauta **Timesheets** (menu do usuário), aba Timesheet de jobs e projetos, pauta Jobs › Timesheet, Configurações › Jornada de trabalho, relatórios de timesheet |
| Método | Leitura estática do front pelo MCP `rea` e pela base local `C:\Users\Iberika\operand-rea`. Algumas partes foram vistas na tela em etapas anteriores (aba Timesheet do job e do projeto, timeline com jornada). **Sem sessão ativa nesta etapa**: a pauta Timesheets e a jornada de trabalho não foram vistas com dados. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(inferido)** =
dedução.

---

## 1. Conceito

- **Apontamento** (lançamento de horas) = tempo que um usuário dedicou a um
  documento (job, tarefa, proposta, produção, mídia ou projeto), numa data.
- Há duas origens:
  - **Timer** (cronômetro): o usuário inicia e para;
  - **Apontamento manual**: o usuário informa data e horas.
- Cada apontamento é **horas normais** (N) ou **retrabalho** (RT).
- Os apontamentos alimentam:
  - o tempo **realizado** do job e do projeto;
  - o **custo** do projeto (horas × valor/hora do colaborador);
  - o **consumo dos contratos de fee** ligados ao projeto;
  - os relatórios de produtividade.
- A **jornada de trabalho** define dias e horários de cada grupo de usuários.
  O **Timesheet Automático** usa a jornada para pausar o cronômetro fora do
  horário e retomá-lo na próxima hora útil.

---

## 2. Telas

### 2.1 Cronômetro (widget global no topo) (código)

- Botão **Iniciar timesheet** / **Parar**, mostrando o tempo corrente e o
  documento/tarefa do cronômetro.
- Ao parar: tarefa (opcional), **descrição** (pedida, "informações adicionais
  da tarefa") e a marcação **retrabalho** ("marcar o tempo total dessa tarefa
  como retrabalho").
- **Histórico**: os **5 últimos apontamentos**, o total apontado no dia e o
  link "ir para pauta Timesheets".
- Estado **pausado** quando o Timesheet Automático pausa fora da jornada
  (ícone com explicação).
- Avisos:
  - "seu timesheet foi parado por X" quando outra pessoa conclui ou cancela o
    documento;
  - falha de conexão com o serviço de timesheet (tempo real).
- Bloqueios:
  - **um cronômetro por usuário**: "você já possui um cronômetro em andamento
    para outro documento";
  - um cronômetro do usuário por documento;
  - sem permissão, não inicia.

### 2.2 Pauta Timesheets (`/timesheets`, menu do usuário) (código)

- Visões: **Minha pauta**, **Do dia**, **Pauta** (todos). A pauta geral exige
  nível ≥ 1 em algum módulo de documentos.
- Colunas:
  - tipo de timesheet (Timer / Manual) e tipo de apontamento (N / RT);
  - descrição, tarefa, horas utilizadas;
  - usuário, data;
  - tipo do documento, título, cliente / projeto.
- Rodapé: "Exibindo X de Y" e **total de horas**.
- Ações por linha: **editar** e **excluir**.
- Filtros: período, usuário, situação dos timesheets (ativos/concluídos),
  tipo (Timer/Manual, pelo menos um), cliente, projeto, empresa e situação do
  documento.

### 2.3 Editar apontamento (modal) (código)

- Campos: descrição, tarefa, **tempo realizado**, tipo (horas normais ou
  retrabalho) e data.
- Aviso: editar o **tempo ou a data** converte o lançamento em **apontamento
  manual**.

### 2.4 Aba Timesheet do job (código + visto em jobs)

- Totais: **estimado**, **realizado** e **saldo** (estimado − realizado). O
  realizado é a soma do job e das suas tarefas.
- **Apontamento manual**: data (**não pode ser futura**), horas (hh:mm),
  tarefa e descrição.
- **Estimar**: informar o tempo estimado do job.
- Lista de lançamentos, com edição, exclusão e alternância N/RT.

### 2.5 Concluir tarefa sem apontamento (código)

Ao concluir uma tarefa que **não tem nenhum registro de tempo**, aparece
"Apontamento pendente", com duas opções:
- **Registrar e concluir**: abre o apontamento e depois conclui;
- **Sem registrar**: conclui assim mesmo.

### 2.6 Pauta Jobs › Timesheet (ver [jobs.md](jobs.md))

Cards dos usuários com cronômetro **ativo** e **concluído**. Um gestor pode
**parar** o cronômetro de outra pessoa. Exige Jobs nível ≥ 2.

### 2.7 Jornada de trabalho (Configurações › Geral › Jornada) (código)

- Só **administradores**.
- Lista de jornadas, cada uma com título, selo **Padrão**, total por semana e
  por mês, **meta mínima produtiva** e quantidade de usuários. Dá para editar
  e excluir.
- Assistente em 2 etapas:
  1. **Dias e horários**:
     - título da jornada;
     - **meta mínima produtiva** (% da jornada que deve ser apontada como
       produtiva);
     - "mesmo horário e somente dias úteis" (segunda a sexta) ou
       **personalizar** por dia (entrada e saída);
     - mostra o total por dia e por semana.
  2. **Colaboradores**: buscar e adicionar usuários, ou movê-los para outra
     jornada.
- **Mover colaborador** de jornada vale **a partir do dia seguinte**.
- **Excluir jornada** move todos os usuários para a jornada **padrão** da
  empresa.
- Cada usuário pertence a exatamente uma jornada **(inferido)**.

### 2.8 Card do painel inicial

"Horas apontadas hoje" ou "nenhum apontamento realizado hoje".

### 2.9 Relatórios de timesheet (código)

- **Timesheet**, em duas frentes:
  - **Equipes e usuários**;
  - **Clientes e projetos**.

  O período tem limite máximo de meses.
- Resumo:
  - usuários com apontamento;
  - **horas registradas**;
  - **horas normais**;
  - **horas retrabalho** (com % do total);
  - **dias com apontamento** sobre dias úteis.
- Por colaborador, mostra se **atingiu ou não a meta mínima de
  produtividade** da jornada ("esperado × apontado").
- Gráficos: apontamentos por usuário, por módulo e horas por dia.
- **Apontamentos por colaborador** e **por cliente**. Colunas: nº doc,
  cliente, grupo, código do projeto, módulo, título, usuário, equipe,
  descrição, tarefa, tipo, início e fim (data e hora), RT, tempo, empresa e
  ID do contrato de fee.
- **Horas por cliente e projeto** (normais × retrabalho).
- Relatórios de contratos de fee (horas contratadas × apontadas): ver
  [propostas.md](propostas.md).

---

## 3. Modelo de dados observado

### 3.1 Apontamento
| Campo | Tipo | Observação |
|---|---|---|
| usuário | ref. usuário | |
| documento | tipo + id | job, tarefa, proposta, produção, mídia, projeto |
| tarefa | ref. tarefa | opcional |
| data/hora início, data/hora fim | data/hora | Timer guarda início e fim |
| duração | minutos | |
| origem | `timer` / `manual` | Editar tempo ou data converte para manual |
| tipo | `normal` / `retrabalho` | |
| descrição | texto | |
| situação | ativo (correndo) / concluído | |
| empresa | ref. empresa | |
| contrato de fee | ref. | Vem do projeto |
| parado por / pausado automaticamente | auditoria | |

### 3.2 Jornada de trabalho
título, padrão (sim/não), meta mínima produtiva (%), dias da semana com entrada
e saída (ou "mesmo horário em dias úteis"), totais por dia, semana e mês
(calculados), usuários.

### 3.3 Valor/hora do colaborador
Usado no custo do projeto e no contrato de fee detalhado. Fica no cadastro do
colaborador (ver o mapeamento de Cadastros).

---

## 4. Regras de negócio

1. Cada usuário tem **no máximo um cronômetro** em andamento.
2. Job ou tarefa **não pode ser concluído ou cancelado** com cronômetro ativo
   (ver [jobs.md](jobs.md)).
3. Apontamento manual não aceita **data futura**.
4. Editar tempo ou data de um apontamento por timer o converte em **manual**.
5. O **Timesheet Automático** pausa o cronômetro fora da jornada do usuário e
   o retoma na próxima hora útil. Iniciado fora da jornada, ele já começa
   pausado.
6. A descrição é pedida ao salvar o apontamento.
7. Concluir uma tarefa sem nenhum registro de tempo dispara o aviso de
   apontamento pendente (registrar ou concluir assim mesmo).
8. Concluir ou cancelar um documento com cronômetros de outras pessoas os
   para, e essas pessoas são avisadas.
9. Mover um usuário de jornada vale a partir do dia seguinte. Excluir uma
   jornada leva os usuários para a jornada padrão.
10. **Meta mínima produtiva**: horas apontadas ÷ horas da jornada no período,
    comparadas ao percentual da jornada.
11. Horas apontadas nos documentos de um projeto com contrato de fee contam no
    consumo do contrato.

---

## 5. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `projects` | Apontamentos em jobs e tarefas; tempo realizado e custo do projeto |
| `crm` / propostas | Apontamentos em propostas; consumo de contratos de fee |
| `auth` | Usuário, equipe, jornada, valor/hora, permissões |
| `finance` | Custo das horas, se houver apropriação de custo |
| `ai` | Ferramentas sugeridas: horas por pessoa, job ou cliente; retrabalho; meta produtiva |

---

## 6. Permissões

- Pauta Timesheets: nível ≥ 1 em Jobs, Propostas, Produção ou Mídia.
- Jobs › Timesheet (ver e parar cronômetros de outros): Jobs nível ≥ 2.
- Jornada de trabalho: administrador.
- Editar e excluir apontamentos de outros: depende do nível do módulo do
  documento **(inferido)**.

---

## 7. Notas para o operador

- O cronômetro em tempo real é o ponto mais caro (o Operand usa Firebase e
  sockets). Na v1 pode bastar: iniciar e parar com o estado no banco, um
  cronômetro por usuário, e apontamento manual.
- **Retrabalho** é só uma marcação no apontamento; vale manter, porque alimenta
  os relatórios de qualidade.
- Timesheet Automático (pausa pela jornada) e meta produtiva são candidatos a
  depois da v1. A jornada simples (dias e horas) é útil para a timeline.
- Configuração real da conta (vista depois, em
  [configuracoes.md](configuracoes.md#19-geral-vista--legado)): **Timesheet
  Automático desligado**, apontamento **só em jobs** ("timesheet em todos os
  módulos" desligado), alerta de tarefa sem apontamento desligado e uma única
  jornada padrão (42h30 por semana, 170 h por mês, meta de 8h30 por dia, 38
  usuários).

---

## 8. Pendências

- Pauta Timesheets com dados (sem sessão nesta etapa). ~~Jornadas reais~~:
  ver acima.
- Formato dos dados de apontamento (`/v3/components/timesheets`) e da jornada
  (`/v3/workJourney`) com registros.
- Quem pode editar ou excluir apontamento de outra pessoa.
