# Operand: módulo Propostas (mapeamento funcional)

> Referência funcional para a parte comercial do operador (`crm`: propostas;
> `finance`: contratos de fee e faturamento). Descreve **o que** o Operand faz,
> não **como** ele faz: não reproduzir código, textos de interface, marca nem
> visual. Exemplos usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu PROPOSTAS (Propostas comerciais e Contratos de Fee) e Configurações › Propostas |
| Método | Leitura estática do front pelo MCP `rea` e pela base local `C:\Users\Iberika\operand-rea`: telas, formulários, rotas e textos do front atual (app4) e do legado (app3). Numa janela curta de sessão ativa, foram vistos a pauta, os status, a **tela da proposta aberta** (captura passiva + modelo da página + script da tela) e o formato dos dados. |
| Uso na conta | Baixo: só 7 propostas no total (1 aberta, 2 concluídas, 4 canceladas) e nenhuma com fatura. A agência praticamente não usa este módulo. |

Marcações de origem:
- sem marcação: visto na tela ou na API;
- **(código)**: extraído dos componentes do front atual (app4);
- **(legado)**: extraído do script e do modelo de página do front antigo
  (app3);
- **(inferido)**: dedução.

---

## 1. Conceito

O menu Propostas tem dois documentos:

- **Proposta comercial** (orçamento): documento de **um cliente**, dentro de um
  projeto (sem projeto, vai para o "Geral" do cliente), que lista o que a
  agência vai entregar e quanto custa.
  - **Itens** vêm da **tabela de preços** da agência.
  - Pode ter **custos externos** (fornecedores).
  - Sobre os valores incidem **honorários**, **encargos**, **comissão**,
    **bonificação** e **desconto**, chegando ao **valor final**.
  - Gera **faturamento**: as faturas são **enviadas ao financeiro**, e isso
    trava a edição.
  - Sai em **PDF / impressão** personalizável.
- **Contrato de fee**: contrato recorrente com o cliente.
  - Tem período (vigência), **quantidade de jobs** e **horas contratadas**
    (totais e por mês) e **budget**.
  - O consumo de horas vem do **timesheet** dos projetos relacionados ao
    contrato (ver [projetos.md](projetos.md), campo Contrato).
  - Também gera faturas, em parcelas, enviadas ao financeiro.

---

## 2. Telas

### 2.1 Pauta de propostas (`/propostas`) (código)

- Barra: "Propostas / Pauta", **+ Adicionar**, busca, filtros e configurar
  exibição.
- **Colunas**: Nº doc, Título, Cliente, Responsável, Envolvidos, Data de
  criação, Prazo, Status, **Valor**, **Enviado ao financeiro**.
- **Filtros**:
  - período de datas;
  - situação dos documentos;
  - cliente / projeto;
  - status;
  - responsável e requisitante;
  - **empresa** (emissora).
- **Configurar exibição**: ordenação, cabeçalho e quais informações da
  proposta aparecem.
- **Ações em lote**:
  - alterar datas, responsável e status;
  - **concluir**, **cancelar** e **reabrir**.

  Cancelar tem bloqueio (ver regras). Propostas de projeto arquivado não são
  afetadas, porque é preciso reabrir o projeto antes.
- Abrir uma proposta leva para a **tela de detalhe do front legado**
  (`/proposta/:id`, ver 2.3).

### 2.2 Nova proposta (modal) (código)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| Título | texto | sim | Limpa caracteres não imprimíveis; recusa conteúdo com script (XSS) |
| Cliente | seleção | sim | Cliente válido (id > 0) |
| Projeto | seleção (projetos do cliente) | não | Sem projeto, vai para o "Geral" do cliente |
| Responsável | seletor de usuário | não | |
| Prazo | data | não | Opção "sem prazo" |
| Descrição (briefing) | texto rico, sem imagem | não | Seletor de **briefing predefinido de propostas** |

O modal não fecha clicando fora nem com Esc. Botões: **Salvar e editar**
(abre a proposta), **Salvar e adicionar novo** e **Salvar**.

### 2.3 Proposta aberta (`/proposta/:id`, front legado)

Vista na tela (uma proposta cancelada) e completada pelo script e pelo modelo
da página **(legado)**. A tela é uma página única, de cima para baixo:

1. **Cabeçalho**:
   - "PROPOSTA" com a etiqueta de **status**;
   - em proposta cancelada ou concluída, faixa explicando quem fez e quando,
     e que reabrir exige o projeto aberto;
   - **número** `projeto.sequência` + título (editáveis na própria tela);
   - **Exportar**: Gerar PDF, Imprimir, Personalizar PDF/Imprimir;
   - atalho "+" para criar outros documentos no mesmo projeto: job, proposta,
     produção, mídia, receita, despesa, projeto.
2. **Linha de dados**:
   - cliente e projeto (links);
   - **Validade** (em dias, até 999; editável);
   - **Prazo**.
3. **Introdução**: texto livre que abre o PDF.
4. **Itens da proposta**: tabela com Nº, Item, Valor unitário, Quantidade,
   **Desconto** e Subtotal.
   - O desconto é por item, em valor ou percentual.
   - Cada item pode ser **ativado ou desativado** (o desativado não entra no
     total).
   - Excluir pede confirmação.
   - **Adicionar** busca na **tabela de preços** ou cria um item livre ("item
     sem título").
5. **Totais**:
   - **Aplicar encargos** (seleção de um encargo cadastrado ou "sem
     encargo"; trocar pede confirmação, porque recalcula os valores);
   - **Valor total** + **Desconto** + **Honorários** + **Encargos** =
     **Valor final**;
   - desconto e honorários são editáveis na própria tela.
6. **Custos externos**: blocos "Custo" com:
   - **Pagar a** (fornecedor, prestador ou veículo, obrigatório);
   - **Referente a** (obrigatório);
   - **Valor unitário** (obrigatório);
   - **Quantidade** (obrigatória);
   - Total.

   Dá para adicionar custo externo, e há o "Total de custos externos".
7. **Considerações finais**: texto livre que fecha o PDF.
8. **Lançar itens na pauta de jobs**: abre uma lista com os itens. Para cada
   um, informa responsável, descrição e datas (início e prazo), e confirma.
   O sistema **cria um job por item** no mesmo projeto, inclusive jobs
   recorrentes.
9. **Painel lateral**: Briefing da proposta, Briefing do projeto, Timesheet e
   Anexos.
10. **Ações**: **Concluir/Reabrir**, **Duplicar** e **Cancelar**.
11. **Faturamento** (bloco do faturamento) **(legado)**:
    - modelo de faturamento: "agência recebe do cliente"; "agência recebe do
      cliente e repassa ao fornecedor/veículo"; "agência recebe do cliente
      sem comissão e retém o encargo de X%";
    - **tipo de pagamento**: à vista, parcelado, mensal, semanal, quinzenal,
      trimestral, semestral, anual;
    - **parcelas**: datas e valores; a soma precisa bater com o total da
      fatura; há número máximo de parcelas;
    - **1º vencimento** e **instruções de faturamento**;
    - **enviar ao financeiro** (pede confirmação);
    - **reabrir faturas**, que cancela as enviadas e não é permitido se
      alguma já foi quitada.
12. **Personalizar PDF/Imprimir** **(legado)**. Escolher o que mostrar:
    - introdução;
    - dados do cliente, dados da agência e dados de faturamento;
    - valores dos itens, valores totais dos itens e soma do valor dos itens;
    - desconto final;
    - custos externos;
    - considerações finais;
    - assinatura do cliente, assinatura da agência e assinatura digitalizada;
    - embutir encargos.

**Travas**: com a proposta concluída ou com fatura gerada, itens, descontos,
honorários e encargos ficam somente leitura.

**Status de proposta (configuração atual da conta)**:
1. Em aberto
2. Aprovação Cliente
3. **Aprovado** (não conta atraso)
4. Reprovado

O vocabulário do legado também tem as situações Em aberto, Em andamento, Em
aprovação, Finalizado e Cancelado.

### 2.4 Pauta de contratos de fee (`/propostas/contratos-fee`) (código)

- **Colunas**: Nº doc, Título, Cliente, **Período**, Status, **Horas**,
  **Jobs**, **Valor final**, **Enviado ao financeiro**.
- **Filtros**: data, situação, clientes, empresa.
- **Configurar exibição**: ordenação, cabeçalho, informações do contrato.
- **Ações em lote**:
  - alterar datas, responsável e status;
  - concluir, cancelar e reabrir;
  - **enviar ao financeiro** ("Enviando ao financeiro, aguarde");
  - **atualizar contrato** (renovação; ver 2.6).

### 2.5 Novo contrato de fee (modal) (código)

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| Cliente | seleção (clientes ativos) | sim | |
| Título | texto (máx. 80) | sim | Recusa caracteres inválidos |
| Período | data inicial – prazo | sim (as duas) | O prazo precisa ser **depois** da data inicial. Mostra a vigência calculada ("1 ano e 3 meses, encerrando em…"). |
| Quantidade de jobs | total (aproximado) ↔ por mês | não | Os dois campos se recalculam pela vigência |
| Horas | totais ↔ por mês | não | Idem |
| Budget total (R$) | moeda | sim | Maior que 0 |

### 2.6 Contrato de fee aberto (código)

- **Cabeçalho e menu**: concluir, cancelar, reabrir e exportar.
  - **Atualizar contrato** conclui o contrato atual e cria um novo com base
    nele (renovação).
  - **Enviar ao financeiro**.
- **Clientes** do contrato e **envolvidos**.
- **Quantidades contratadas**: jobs (total e por mês) e horas (total e por mês).
- **Resumo dos valores**: subtotal, **margem** (0 a 100%) e **valor final**.
- **Tipo de contrato**:
  - **simples**: valores globais;
  - **detalhado por equipes e profissionais**: equipe, colaborador, valor/hora,
    horas/mês e custo. O custo da equipe é a média dos colaboradores dela.
  - Dá para trocar de detalhado para simples (com aviso) ou cancelar o
    detalhamento.
- **Faturamento**:
  - modelo de faturamento;
  - **vencimento-base** (data usada para gerar as faturas);
  - faturamento da agência: "receber de", condição, **parcelas**, valor,
    **forma de pagamento**, status e link "ir para fatura";
  - aviso quando a soma das parcelas difere do total;
  - **Enviar para o financeiro**: confirma e bloqueia a edição;
  - **reabrir faturas** cancela as faturas já enviadas. Não é permitido se
    alguma já foi **quitada**;
  - aviso quando alguma fatura foi alterada direto no financeiro, e marca
    "cancelada manualmente".
- **Projetos relacionados**: relacionar ou remover projetos do cliente.
- **Lembretes**:
  - **alertar quando o contrato alcançar X% do consumo** de horas;
  - **criar evento na agenda N dias antes do fim** do contrato (respeitando
    a permissão de agenda do usuário).
- **Cards de consumo**: consumo de horas, quantidade de jobs e valores do
  contrato.
- **Anotações**, **anexos** e **histórico**.

### 2.7 Configurações › Propostas (legado + código)

| Tela | Conteúdo |
|---|---|
| **Tabela de preços** | Catálogo de peças/serviços por **categoria**. Cada item tem título, descrição, **tempo-base** e preço unitário (base e atual). Alimenta os itens da proposta e o **autocompletar do título do job** (com briefing e tempo estimado; ver [jobs.md](jobs.md)). Categoria com itens não pode ser excluída. |
| **Encargos** | Lista de encargos: título, tipo, percentual. Usados na proposta e na produção. Não incidem sobre comissão e honorários e só valem em faturamentos com encargos. |
| **Briefings predefinidos** | Modelos de briefing de propostas (`/configuracoes/comercial/briefing`) |
| **Centros de custo** | Usados no faturamento (gerenciados no Financeiro). Centro com faturas não pode ser excluído. |

### 2.8 Relatórios ligados (código)

- **Propostas › Pauta**:
  - fechamentos no período;
  - valores agrupáveis por subtotal, desconto, honorários, encargos e valor
    final;
  - colunas de nº, título, cliente, grupo de clientes, empresa, datas
    (criação, conclusão, prazo), envio ao financeiro, responsável, envolvidos,
    requisitante, custos externos e contato do cliente.
- **Propostas › Faturamento**.
- **Contratos de fee**: horas por profissional, por equipe, por equipe
  (semanal), por projeto e **resumo do contrato**. Cada um mostra contratado,
  apontado, utilizado e saldo, mês a mês.

---

## 3. Modelo de dados observado

### 3.1 Proposta
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id + sequência no projeto | inteiro | auto | Exibido como `projeto.sequência` |
| título | texto | sim | Sem emojis; limite de caracteres |
| cliente | ref. cliente | sim | |
| projeto | ref. projeto | auto | Padrão: Geral |
| responsável, solicitante, envolvidos | usuários | | |
| prazo | data | não | |
| validade | inteiro (dias, ≤ 999) | não | |
| briefing | texto rico | não | |
| introdução, considerações finais | texto rico | não | Entram no PDF |
| status | ref. status de proposta | não | |
| situação | aberta / concluída / cancelada | auto | |
| empresa emissora | ref. empresa | auto | |
| itens | lista (abaixo) | | |
| custos externos | lista (abaixo) | | |
| encargo aplicado | ref. encargo | não | |
| desconto (geral), honorários | valor ou % | não | |
| valor total, valor final | moeda | calculado | A API da pauta devolve `valor total` |
| tem fatura | flag | auto | Trava a edição |
| faturamento | modelo, tipo de pagamento, parcelas, 1º vencimento, instruções | | Ver 2.3 |

Item da proposta: item da tabela de preços (ou livre), título, valor
unitário, quantidade, desconto (valor ou %), subtotal, ativo/inativo.

Custo externo: pagar a (pessoa: fornecedor, prestador ou veículo), referente
a, valor unitário, quantidade, total.

### 3.2 Contrato de fee **(código)**
cliente(s), título (≤ 80), data inicial, prazo, jobs total/mês, horas
total/mês, budget, margem %, valor final, tipo (simples/detalhado), linhas de
detalhamento (equipe, colaborador, valor/hora, horas/mês, custo), projetos
relacionados, modelo de faturamento, vencimento-base, parcelas (condição,
forma de pagamento, valor, status), lembretes (% de consumo, dias antes do
fim), anotações, anexos, envolvidos, situação.

### 3.3 Tabela de preços **(legado)**
categoria (nome); item: categoria, título, descrição, tempo-base, preço
unitário base, preço unitário.

### 3.4 Encargo **(legado)**
título, tipo, percentual.

---

## 4. Ciclo de vida

```
Proposta:   ABERTA ── concluir ──► CONCLUÍDA ── reabrir ──► ABERTA
            ABERTA ── cancelar ──► CANCELADA ── reabrir ──► ABERTA
Contrato:   ABERTO ── concluir/cancelar ──► … ; "atualizar" = conclui e cria o próximo
Faturamento: rascunho ── enviar ao financeiro ──► enviado (documento travado)
             enviado ── reabrir faturas ──► rascunho (cancela as faturas; não se houver quitada)
```

---

## 5. Regras de negócio

1. Proposta exige título e cliente; contrato exige cliente, título, data
   inicial, prazo e budget maior que 0.
2. No contrato, o prazo precisa ser posterior à data inicial. Jobs e horas
   mensais × totais são recalculados pela vigência.
3. **Enviar ao financeiro** gera as faturas e **trava a edição** do documento.
4. **Reabrir o faturamento** cancela as faturas enviadas. Não é permitido se
   alguma fatura já foi quitada.
5. Não é possível **cancelar** proposta já enviada ao financeiro
   **(inferido)** da mensagem "não é possível cancelar a(s) proposta(s)…" e da
   regra equivalente em projetos.
6. Para reabrir um documento, o projeto precisa estar aberto. Ações em lote
   não alteram propostas de projetos arquivados.
7. Comissão: entre 0% e 100%. Comissão negociada menor que a comissão. A
   comissão não pode passar do valor total do documento. Comissão negociada
   não vale em alguns tipos de faturamento.
8. Honorários ≥ 0%. Encargos não incidem sobre comissão nem honorários.
9. Margem do contrato entre 0% e 100%.
10. Lembrete de consumo do contrato: alerta ao atingir um percentual das horas
    contratadas.
11. **Atualizar contrato** conclui o atual e cria um novo a partir dele.
12. O custo de uma equipe no contrato detalhado é a média do custo dos
    colaboradores da equipe.
13. Categoria da tabela de preços com itens não pode ser excluída.
14. Com a proposta concluída ou com fatura gerada, itens, descontos,
    honorários e encargos não podem ser editados.
15. Trocar o encargo aplicado recalcula os valores e pede confirmação.
16. Item desativado não entra no total.
17. "Lançar itens na pauta de jobs" cria **um job por item**, no mesmo projeto,
    com responsável, descrição e datas informados.
18. Parcelas: a soma precisa ser igual ao total da fatura, as datas precisam
    ser válidas e há um número máximo de parcelas.
19. Campos de texto recusam emojis e conteúdo suspeito de script.

---

## 6. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `crm` | Cliente e contato do cliente; a proposta é o documento comercial |
| `projects` | Proposta dentro de um projeto; contrato de fee relacionado a projetos (horas consumidas) |
| `timesheet` | Horas apontadas nos projetos do contrato consomem as horas contratadas |
| `finance` | Faturas geradas pelo "enviar ao financeiro"; centros de custo; formas de pagamento; encargos |
| `projects` (jobs) | A tabela de preços alimenta o título, o briefing e o tempo estimado do job |
| `auth` | Responsável, envolvidos, permissões; equipes e valor/hora dos colaboradores no contrato detalhado |
| Agenda | Evento de lembrete antes do fim do contrato |

---

## 7. Permissões

| Permissão | Controla |
|---|---|
| Propostas (`deals`) | Pauta e documentos de proposta (níveis como em [projetos.md](projetos.md#7-permissões)) |
| Contratos de fee (`dealsFee`) | Pauta e documentos de contrato |
| Contrato de fee em projetos | Ver ou relacionar contrato no projeto |
| Relatórios | Relatórios de propostas e de contratos |

---

## 8. Notas para o operador

- No operador, a **proposta** fica no `crm`, e o **faturamento** (faturas,
  envio ao financeiro, centros de custo, encargos) no `finance`, ligado à
  proposta só pelo id e pela interface pública.
- A **tabela de preços** é compartilhada entre proposta e job: definir um dono
  (sugestão: `crm`, exposto para `projects`).
- O **contrato de fee** cruza `crm`, `finance`, `timesheet` e `projects`.
  Considerar um submódulo próprio ou deixá-lo para depois da v1.
- Candidatos a simplificar na v1:
  - comissão negociada e bonificação, que são mais de mídia;
  - contrato detalhado por equipe;
  - lembretes na agenda.
- **Prioridade**: a agência quase não usa propostas no Operand (7 no total,
  nenhuma faturada). Vale confirmar com o usuário se a v1 precisa do módulo
  ou se basta um orçamento simples (itens + total + PDF) com "gerar jobs a
  partir dos itens".

---

## 9. Pendências

- A tela da proposta aberta foi vista sem itens nem faturas (a conta não tem
  proposta com itens). O bloco de faturamento e o PDF vieram do script e do
  modelo da página.
- Fórmula exata de honorários e encargos (aplicados sobre o total ou
  embutidos "por dentro").
- **Status de contrato de fee** e a pauta de contratos com dados.
- ~~Tabela de preços e encargos~~ (lidos depois): a conta tem só o encargo
  "Sem encargo", 2 categorias na tabela de preços (Mídia online e Mídia OFF)
  e **nenhum item** cadastrado. O autocompletar de preço no job não devolve
  nada.
- Tipos de faturamento que valem para proposta. Os códigos FLCC, FBCC etc.
  ("faturar líquido/bruto contra cliente/agência") aparecem nos relatórios de
  produção e mídia.
