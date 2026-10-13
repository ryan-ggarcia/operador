# Operand: módulo Produção (mapeamento funcional)

> Referência funcional para um módulo de **produção** no operador (ainda não
> previsto na lista da v1). Descreve **o que** o Operand faz, não **como** ele
> faz: não reproduzir código, textos de interface, marca nem visual. Exemplos
> usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu PRODUÇÃO (pauta e documento de produção), Configurações › Produção, relatórios de produção |
| Método | Pauta e documento de produção vistos com sessão ativa (só leitura); formato dos dados da cotação e do pedido de produção lido por GET (só chaves e tipos). Modal de criação, regras e PDFs lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea` (app4 + legado app3, onde fica a tela do documento). |
| Uso na conta | 1.028 produções, **sem uso desde meados de 2023** (prazo mais recente: julho/2023). Numa amostra de 200: 179 abertas, 14 concluídas e 7 canceladas; 187 com valor e **nenhuma faturada** pelo Operand. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(legado)** =
script/modelo do front antigo; **(inferido)** = dedução.

---

## 1. Conceito

- **Produção** é o documento de **compra de serviços de terceiros** para um
  cliente: gráfica, filmagem, brindes, impressão, montagem etc. A agência
  cota com fornecedores, apresenta a estimativa ao cliente e emite o pedido ao
  fornecedor escolhido.
- Fica dentro de um **projeto**. Número no formato `projeto.sequência`; os
  itens são numerados `projeto.sequência.item`.
- Duas etapas, em duas abas do documento:
  1. **Cotação / Estimativa de custo (EC)**: itens, cada um com uma ou mais
     **quantidades** (ex.: 500, 1.000 e 2.000 unidades), e vários
     **fornecedores** cotando cada quantidade. O cliente aprova uma quantidade
     de um fornecedor por item.
  2. **Pedido de Produção (PP)**: um pedido por fornecedor aprovado, com
     instruções de faturamento, parcelas, local e data de entrega e
     observações ao fornecedor. O PP é enviado ao financeiro.
- Sobre os valores incidem **comissão** do fornecedor à agência (chamada de
  BV no mercado), **honorários** da agência e **encargos** (os mesmos
  cadastrados em Propostas; ver [propostas.md](propostas.md)).
- O fornecedor é um cadastro de pessoa com papel **fornecedor** (ver
  [cadastros.md](cadastros.md)).

---

## 2. Telas

### 2.1 Pauta de produção (`/producao`) (vista + código)

- **Colunas**: Nº doc, Título, Cliente, Responsável, Envolvidos, Data de
  criação, Prazo, Status, Valor e **Enviado ao financeiro**.
- **Filtros**: data, situação (abertas, concluídas, canceladas),
  cliente/projeto, **fornecedor**, requisitante e empresa. "Configurar
  exibição": ordenação, cabeçalho e informações do card.
- **Ações em lote** (código): alterar datas, responsável e status; concluir,
  cancelar e reabrir. Reabrir uma produção de projeto arquivado exige reabrir
  o projeto antes.
- **Status de produção** (configuração atual da conta):
  1. Em aberto
  2. Aprovação Interna
  3. Aprovação Cliente
  4. **Aprovado/Enviar PP** (não conta atraso)
  5. Aguardando Entrega
  6. Reprovado

### 2.2 Nova produção (modal) (código)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| Título | texto | sim | Remove caracteres não imprimíveis ao colar |
| Cliente / Projeto | seleção | cliente sim | Sem projeto, o sistema cria um projeto padrão do cliente |
| Responsável | usuário | não | |
| Prazo | data | não | |
| Briefing | texto rico + briefing predefinido de produção | não | |

Botões: Salvar e editar, Salvar e adicionar novo, Salvar. Ao salvar, avisa
com link para o documento (`projeto.sequência - título`).

### 2.3 Documento de produção (`/producao/:id`, front legado) (vista + legado)

De cima para baixo:

1. **Cabeçalho**:
   - etiqueta de status, número e título;
   - **Concluir** (faixa de concluída/cancelada com **Reabrir**);
   - **Exportar** (PDF da EC ou do PP, ver 2.5);
   - "+" para criar documentos ligados (job, proposta, receita, despesa,
     projeto).
2. **Dados gerais**: cliente, projeto, **validade** da cotação (em dias; ex.:
   30), prazo, criado em, empresa, **requisitante** e **contato do cliente**.
3. **Encargos**: seleção de um encargo cadastrado (hoje a conta só tem "Sem
   encargo"). Trocar recalcula os valores.
4. **Aba Cotação / Estimativa de custo** (2.4).
5. **Aba Pedido de Produção** (2.6).
6. **Condições de pagamento** (aos fornecedores), com texto predefinido
   opcional.
7. **Observações ao cliente** (saem na estimativa), com texto predefinido
   opcional.
8. **Envolvidos**, **briefing da produção**, **briefing do projeto** e
   **anexos**.
9. Menu: **Duplicar** e **Cancelar**.

### 2.4 Cotação / Estimativa de custo (EC) (legado)

- **Adicionar item**: item (título), descrição e **quantidades** (uma ou
  várias; não aceita quantidade repetida). "Salvar e adicionar novo".
- Em cada item:
  - **Adicionar fornecedores**: busca por nome, lista com nome e
    cidade/UF, seleção de vários. Se o fornecedor não existe, dá para
    **criar** o cadastro ali mesmo, só com o nome;
  - por fornecedor: **nº do orçamento** do fornecedor e prazo;
  - por fornecedor × quantidade: **valor unitário**, **valor total**,
    **comissão** e **honorários** (edição na própria linha);
  - **aprovar** uma quantidade de um fornecedor. Só uma quantidade fica
    aprovada por fornecedor; aprovar outra desmarca a anterior;
  - comissão e honorários do item em **%** ou **valor**;
  - excluir item; excluir uma quantidade (apaga essa quantidade de **todos**
    os fornecedores do item, com confirmação).
- **Expandir / esconder** todos os itens.

### 2.5 Exportar (PDF ou impressão) (legado)

| Documento | Opções |
|---|---|
| **Cotação / Estimativa (CO/EC)**, para o cliente | Dados da agência, dados do cliente, fornecedores, comissão, honorários da agência, observações ao cliente, assinatura da agência e do cliente, assinatura digitalizada. Outras opções: **somar valores aprovados**, **ordenar valores do menor para o maior**, **embutir encargos**, **comissão/valor líquido**. |
| **Pedido de Produção (PP)**, para um fornecedor escolhido | Dados da agência, **dados do fornecedor**, **instruções de faturamento**, **observações ao fornecedor**, assinatura da agência e do fornecedor, assinatura digitalizada. |

As escolhas ficam salvas como preferência do PDF.

### 2.6 Pedido de Produção (PP) (vista + legado)

- Um bloco por **fornecedor com quantidade aprovada**; os itens aprovados do
  mesmo fornecedor podem ser agrupados num só pedido. Sem aprovação na EC, a
  aba fica vazia.
- Em cada bloco:
  - itens e quantidades aprovados, com valores;
  - **instruções de faturamento**: tipo de faturamento (FLCC, FBCC, FLCA,
    FL+CCA, FBCA; ver [midia.md](midia.md#24-tipos-de-faturamento)) e **1º
    vencimento**;
  - **Editar faturamento**: condição (à vista, parcelado) e parcelas
    (vencimento, data de faturamento, valor, forma de pagamento);
  - subtotal, desconto, valor total, comissão (e **comissão negociada**),
    honorários, encargos, **valor líquido** e **valor a repassar** ao
    fornecedor;
  - **local de entrega** e **data de entrega**;
  - **observações ao fornecedor** (com texto predefinido opcional);
  - **Enviar para o financeiro** e **Reabrir faturamento**; depois do envio
    mostra quem aprovou e quando.

### 2.7 Configurações › Produção (legado + código)

| Tela | Conteúdo |
|---|---|
| **Briefings predefinidos** | Modelos de briefing de produção (`/configuracoes/producao/briefing`): título e descrição |
| **Condições de pagamento** | Textos predefinidos de condição de pagamento aos fornecedores |
| **Observações ao cliente** | Textos predefinidos para a estimativa |
| **Observações ao fornecedor** | Textos predefinidos para o pedido |
| **Encargos** | Os mesmos de Propostas: título, tipo e percentual; um padrão. Exclusão com confirmação. Hoje só "Sem encargo". |

### 2.8 Relatórios (código)

- **Produção › Pauta**.
- **Produção › Faturamento**: receitas, comissão, honorários, fornecedores,
  tipo de faturamento, subtotal, desconto geral, valor bruto e valor líquido.

---

## 3. Modelo de dados observado

### 3.1 Produção
| Campo | Tipo | Observação |
|---|---|---|
| id + sequência no projeto | inteiros | `projeto.sequência` |
| título | texto | obrigatório |
| cliente, projeto | refs | cliente obrigatório |
| empresa, contato do cliente | refs | |
| responsável, requisitante, envolvidos | usuários | |
| prazo, data de criação | datas | |
| validade da cotação | inteiro (dias) | |
| status | ref. status de produção | "não conta atraso" por status |
| situação | aberta / concluída / cancelada | |
| encargo aplicado (ref. e %) | | |
| condições de pagamento, observações ao cliente, briefing | texto | |
| valor total, valor da comissão | calculados | Aparecem na pauta |
| tem fatura (enviado ao financeiro) | flag | |
| preferências do PDF (EC e PP) | JSON | |

### 3.2 Item
sequência, título, descrição, lista de quantidades, comissão (tipo % ou
valor, valor), honorários (tipo % ou valor, valor), situação.

### 3.3 Fornecedor do item (cotação)
fornecedor (ref. pessoa), nº do orçamento, prazo, em uso, avaliação do
fornecedor **(inferido)**, grupo de itens (para juntar itens no mesmo PP),
quantidade aprovada, enviado ao financeiro.

### 3.4 Quantidade cotada (fornecedor × quantidade)
quantidade, valor unitário, valor total, valor da comissão, valor dos
honorários, **aprovada na EC** (sim/não), situação.

### 3.5 Pedido de produção / faturamento (por fornecedor)
fornecedor, grupo de itens, tipo de faturamento, parcelas (valor,
vencimento, data de faturamento, forma de pagamento, id da fatura no
financeiro), subtotal, desconto (com opção de desconto parcial fixo), valor
total, valor parcial, valor líquido, honorários, encargos, valor a repassar,
comissão negociada, observações ao fornecedor, local de entrega, data de
entrega, data-base financeira, aprovado por e em, tem fatura.

### 3.6 Apoio
encargo (título, tipo, %, padrão), textos predefinidos (condições de
pagamento, observações ao cliente e ao fornecedor, briefing).

---

## 4. Ciclo de vida

1. Criar a produção (título, cliente, projeto opcional).
2. Montar a **EC**: itens, quantidades, fornecedores e valores cotados.
3. Exportar a EC para o cliente (status "Aprovação Cliente", por exemplo).
4. Aprovar, por item, a quantidade e o fornecedor escolhidos.
5. O **PP** nasce para cada fornecedor aprovado. Preencher faturamento,
   entrega e observações e exportar o PP ao fornecedor ("Aprovado/Enviar
   PP").
6. **Enviar ao financeiro** (por fornecedor): gera as faturas e trava as
   alterações daquele fornecedor.
7. Acompanhar a entrega ("Aguardando Entrega") e **concluir**. Se houver
   fornecedor aprovado ainda não enviado ao financeiro, o sistema pede
   confirmação **(inferido: na conclusão)**.
8. Cancelar ou reabrir quando preciso.

---

## 5. Regras de negócio

1. Título e cliente são obrigatórios. Sem projeto, cria-se o projeto padrão
   do cliente.
2. O item precisa de pelo menos uma quantidade; quantidades repetidas não são
   aceitas.
3. Excluir uma quantidade remove essa quantidade de todos os fornecedores do
   item.
4. Uma só quantidade aprovada por fornecedor em cada item.
5. A comissão não pode passar do valor total da produção (validado antes de
   enviar ao financeiro).
6. Item de fornecedor já enviado ao financeiro não pode ser aprovado,
   reprovado nem removido sem antes **reabrir o faturamento**.
7. O encargo selecionado recalcula os valores; embutir encargos no PDF é
   opcional.
8. O status "Aprovado/Enviar PP" não conta atraso.
9. Reabrir uma produção de projeto arquivado exige reabrir o projeto.

---

## 6. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `projects` | Produção dentro de projeto; contadores e atrasados do projeto e da ficha do cliente |
| `crm` / cadastros | Cliente, contato do cliente e fornecedor (pessoa com papel fornecedor; pode ser criado na cotação) |
| `finance` | Faturas por fornecedor conforme o tipo de faturamento; comissão, honorários, encargos e repasse |
| Propostas | Encargos compartilhados |
| `timesheet` | Horas apontadas na produção **(inferido, como em jobs e mídia)** |
| `ai` | Ferramentas sugeridas: custo de terceiros por cliente e projeto; comparação de cotações por fornecedor |

---

## 7. Permissões

- **Produção** (`productions`): nível do módulo, como em
  [projetos.md](projetos.md#7-permissões). Vale para a pauta, o documento,
  os relatórios e os briefings predefinidos.
- Criar fornecedor na cotação depende da permissão de cadastro de
  fornecedores **(inferido)**.

---

## 8. Notas para o operador

- O módulo **não é usado desde 2023**, mas tem mais de mil documentos
  antigos. Perguntar ao usuário se a agência ainda compra produção de
  terceiros e onde controla hoje (planilha? jobs?). Se não usa, Produção fica
  fora da v1.
- Se entrar, um formato simples cobre o essencial: itens com quantidades,
  cotações por fornecedor, aprovação, PDF da estimativa e do pedido, e envio
  ao `finance`.
- Mídia e Produção repetem a mesma estrutura de faturamento (tipo de
  faturamento, comissão, honorários, parcelas, envio ao financeiro). No
  operador, vale um componente comum de **faturamento de terceiros** no
  `finance`, usado pelos dois pela interface pública.
- Nenhuma produção foi faturada pelo Operand; como em Mídia, o faturamento
  parece ser controlado fora.

---

## 9. Pendências

- Pauta e documento vistos só numa produção antiga, com um item e um
  fornecedor. Agrupamento de vários itens no mesmo PP veio do código.
- Fórmula de honorários e encargos (sobre o total ou embutidos).
- Significado exato da "avaliação" do fornecedor e do "valor parcial" no
  faturamento.
- Quais faturas cada tipo de faturamento gera (mesma pendência de Mídia).
