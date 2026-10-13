# Operand: Dashboard (mapeamento funcional)

> Referência funcional para a tela inicial do operador. Descreve **o que** o
> Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Página inicial (`/`) e "Configurações da Dashboard" |
| Método | Do código, pelo MCP `rea` e pela base local `C:\Users\Iberika\operand-rea`. A tela foi aberta, mas os cards **não carregaram**: os dados chegam por um canal em tempo real que a guarda de escrita bloqueia. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(inferido)** =
dedução.

---

## 1. Conceito

- A dashboard é uma página de **cards** que cada usuário escolhe e organiza.
- Há cards **pessoais** ("meus") e cards **da empresa**. Cada card exige a
  permissão do módulo de onde vêm os dados; sem ela, aparece como
  indisponível.
- Os números são calculados no servidor e **enviados em tempo real** para a
  tela; não há botão de atualizar.
- Cada card tem **abrir relatório** (leva ao relatório completo) e **remover
  card**. Card sem dados mostra um aviso.

---

## 2. Cards disponíveis (código)

| Grupo | Card | Conteúdo |
|---|---|---|
| Pessoal | Meu perfil | Dados do usuário |
| | Timesheet | Horas apontadas hoje (ou aviso de nenhum apontamento) |
| | Acesso rápido | Atalhos para pautas e relatórios (minha pauta, pauta por status e por responsável, lançamentos, contas, fluxo de caixa, cadastros etc.) |
| | Comentários | Comentários recentes em que o usuário está envolvido **(inferido)** |
| | Últimos documentos editados | Projetos e documentos alterados por último |
| | Agenda | Próximos eventos |
| | Próximos aniversários | Aniversários dos colaboradores |
| | Meus jobs concluídos no prazo | % no prazo × fora do prazo no mês |
| | Novidades do Operand | Notícias do produto (não se aplica ao operador) |
| Operação | Jobs e tarefas | Contadores (abertos, atrasados etc.) |
| | Outros módulos | Contadores de propostas, produção e mídia |
| | Projetos | Contadores de projetos |
| | Prazo de projetos | Projetos por prazo |
| | Budget de projetos | Budget × custo |
| | Retrabalho em projetos | Horas de retrabalho |
| | Jobs concluídos no prazo | % de todos os jobs da empresa entregues no prazo no mês |
| | Propostas, Produção, Mídia | Resumos de cada módulo |
| Financeiro | Receitas, Despesas, Faturas | Totais |
| | Saldo do mês, Saldo no período, **Saldo acumulado** | Saldo acumulado = saldo do período anterior + saldos até agora |
| | Receitas e despesas previstas | Previsto do período |
| | Receitas de comissão/honorário | Receita da agência sobre mídia e produção |
| | **Índice de lucratividade** | Ano atual: saldo (lucro líquido) ÷ receita total × 100 |
| | Faturamento de propostas, mídia e produção | Totais faturados por origem |

Um filtro de **empresa** vale para os cards financeiros **(inferido)**.

---

## 3. Configurações da dashboard (código)

- Lista de cards por grupo ("meus" e "empresa") para marcar e desmarcar.
- Cards sem permissão aparecem bloqueados; alguns aparecem como "em breve".
- A escolha fica salva por usuário.

---

## 4. Relações com outros módulos

Cada card lê o resumo de um módulo: `projects` (jobs, projetos, prazos,
budget, retrabalho), `timesheet` (horas de hoje), `finance` (saldos,
receitas, lucratividade), `crm` (aniversários, pelo cadastro de
colaboradores), agenda e comentários.

---

## 5. Notas para o operador

- A dashboard é um bom lugar para o módulo `ai`: um card de **resumo do dia
  feito pelo Claude** (jobs atrasados, prazos da semana, horas apontadas) e
  uma caixa para perguntar.
- Para a v1, sugestão de poucos cards fixos, sem tempo real: **meus jobs**
  (abertos, atrasados, prazo hoje), **horas de hoje**, **jobs no prazo no
  mês** e **últimos documentos**. Os cards financeiros entram junto com o
  `finance`.
- Cada card deve chamar a interface pública do módulo dono do dado (regra do
  monolito modular), nunca ler tabelas de outro módulo.

---

## 6. Pendências

- Aparência e números reais dos cards (não carregaram com a guarda ativa).
- Lista exata do "acesso rápido" e dos contadores de jobs.
