# Operand: Relatórios (mapeamento funcional)

> Catálogo dos relatórios do Operand e do que eles têm em comum. O detalhe de
> cada relatório está no documento do módulo de origem. Descreve **o que** o
> Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu RELATÓRIOS (catálogo por abas) e os relatórios de cada módulo |
| Método | Catálogo visto com sessão ativa (só leitura); regras de acesso, filtros e exportação lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea`. Parte dos relatórios fica no front legado. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(inferido)** =
dedução.

---

## 1. Catálogo

O menu Relatórios mostra abas por área. Cada relatório só aparece para quem
tem a permissão indicada.

| Área | Relatório | O que mostra | Exige | Detalhe em |
|---|---|---|---|---|
| Financeiro | Lançamentos | Receitas e despesas, previsto × realizado, por competência, categoria ou centro de custo | Financeiro ≥ 6 | [financeiro.md](financeiro.md) |
| | Centros de custo | Lançamentos por centro de custo | Financeiro ≥ 6 | |
| | Fluxo de caixa (mensal e diário) | Resultado e saldo previstos, índice de lucratividade, fluxo por categoria do plano de contas | Financeiro ≥ 6 + receitas, despesas e transferências | |
| | Contas | Faturas por conta, com saldo inicial, realizado e previsto | idem | |
| | Demonstrativo por competência | Resultado anual pela data de competência (parecido com um DRE) | idem | |
| | Movimentação por cliente | Receitas e despesas ligadas a um cliente | idem | |
| | Movimentação de terceiros | Receitas e despesas ligadas a fornecedores, veículos, prestadores e colaboradores | idem | |
| Timesheet | Timesheet | Horas por cliente, com detalhe por pessoa e por documento | Jobs, Propostas, Mídia ou Produção ≥ 6 | [timesheet.md](timesheet.md) |
| | Apontamentos por colaborador | **Custo** das horas de cada pessoa num projeto ou atividade | Colaboradores ≥ 6 | |
| | Apontamentos por cliente | Total de horas por cliente ou projeto | Clientes e Colaboradores ≥ 6 | |
| | Timesheet (novo) | Horas por equipe, usuário, cliente e projeto | Jobs ≥ 6 + liberação do recurso | |
| Projetos | Pauta de projetos | Documentos do projeto com as principais informações | Projetos e Jobs ≥ 6 | [projetos.md](projetos.md) |
| Jobs | Pauta de jobs | Volume de jobs, status, subtarefas, envolvidos | Jobs ≥ 6 | [jobs.md](jobs.md) |
| Propostas | Pauta e Faturamento | Propostas por período e previsões; lançamentos gerados | Propostas ≥ 6 | [propostas.md](propostas.md) |
| Contratos de fee | Horas por profissional, por equipe, por equipe (semanal), por projeto; resumo | Desempenho dos contratos | Contratos de fee ≥ 6 | [propostas.md](propostas.md) |
| Produção | Pauta e Faturamento | Documentos, comissões e receitas por fornecedor e cliente | Produção ≥ 6 | [producao.md](producao.md) |
| Mídia | Pauta e Faturamento | Documentos por tipo e veículo; receitas e despesas por cliente, veículo e tipo | Mídia ≥ 6 | [midia.md](midia.md) |
| Cadastros | Clientes, colaboradores, veículos, fornecedores, prestadores | Listas com os dados cadastrados | Cadastro correspondente ≥ 6 | [cadastros.md](cadastros.md) |

---

## 2. Recursos comuns (código)

- **Filtros** antes de gerar: período ("este ano", "todo o período" ou
  datas), empresa, clientes e **grupos de clientes**, status e **grupos de
  status**, equipes, categorias. Sem filtro aplicado, o relatório pede para
  escolher e clicar em filtrar. "Filtros ativos" mostra o que está valendo.
- **Visões**: resumida e **detalhada** (os filtros só mudam no modo
  detalhado). A visão escolhida faz parte do endereço.
- **Filtro padrão**: o usuário salva os filtros como padrão do relatório.
- **Grade configurável**: colunas, agrupamentos e totais, com gráficos
  (cabeçalho, legenda, limite de itens).
- **Exportar**:
  - **Excel** ou **PDF** (retrato ou paisagem, tamanho da página), com nome
    do arquivo, opção de incluir os filtros e divisão em vários arquivos para
    relatórios grandes;
  - **Automática (BI)**: exportação **diária** para um servidor **FTP** (host,
    porta, login, senha, pasta, nome do arquivo com a data no fim), com teste
    de conexão e histórico das execuções. Serve para alimentar ferramentas de
    BI.
- Contador "total de N registros" e aviso quando os filtros não trazem nada.

---

## 3. Notas para o operador

- Relatórios são onde o módulo `ai` mais ajuda: em vez de dezenas de
  relatórios fixos, o Claude responde perguntas ("quantas horas o cliente X
  consumiu este mês?", "quais jobs atrasaram mais?") usando as ferramentas de
  leitura dos módulos.
- Sugestão para a v1, pelo uso real da conta:
  - **pauta de jobs** com filtros e exportação para Excel;
  - **horas por cliente, projeto e pessoa** (o timesheet é muito usado);
  - **pauta de mídia** com investimento por cliente, veículo e tipo.
- Relatórios financeiros (fluxo de caixa, DRE, lucratividade) só fazem
  sentido se a agência passar a lançar o financeiro no operador; hoje há 3
  lançamentos no Operand.
- A exportação automática para BI por FTP pode ser trocada, depois, por uma
  visão só de leitura no banco ou por um export agendado.
- Cada relatório lê dados pela interface pública dos módulos; relatórios que
  cruzam módulos (ex.: horas × financeiro) ficam num serviço de leitura que
  chama essas interfaces.

---

## 4. Pendências

- Colunas e gráficos de cada relatório vistos só nos documentos dos módulos
  (os legados abrem em outra tela).
- Se o "Timesheet (novo)" está liberado na conta.
