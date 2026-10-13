# Operand: módulo Financeiro (mapeamento funcional)

> Referência funcional para o módulo `finance` do operador. Descreve **o que**
> o Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual. Exemplos usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu FINANCEIRO (Lançamentos, Contas/Conciliação, Boletos, NFS-e), Configurações › Financeiro, relatórios financeiros |
| Método | Pauta e formato dos dados vistos com sessão ativa (só leitura). Formulários, ações e regras lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea` (app4 + legado app3). |
| Uso na conta | **Praticamente nenhum**: só 3 lançamentos no total (de 2023) e 1 conta bancária. A agência não usa o financeiro do Operand no dia a dia. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(legado)** =
script/textos do front antigo; **(inferido)** = dedução.

---

## 1. Conceito

- **Lançamento** (fatura) é uma **receita** ou uma **despesa**. Tem:
  - categoria (plano de contas em árvore);
  - pessoa: o **sacado** (de quem se recebe) ou o **cedente** (a quem se paga);
  - **conta** bancária, **forma de pagamento**, **empresa** emissora;
  - datas de **vencimento**, **pagamento**, **competência** e
    **faturamento**;
  - valor, com **acréscimos/descontos**;
  - **centro de custo** (com **rateio**);
  - vínculo opcional a um cliente e a um **documento** (projeto, job,
    proposta, produção, mídia, contrato de fee).
- Lançamentos podem ser **parcelados** ou **recorrentes**. As parcelas formam
  um grupo ("parcela X de Y").
- **Transferência** entre contas gera um par saída/entrada.
- **Situação**: aberta, **quitada** (com data de pagamento) ou cancelada.
  **Status** é uma etiqueta à parte (fixos na conta: Em aberto, Enviado,
  Agendado).
- **Conciliação bancária**: importar o extrato (OFX) e casar cada linha com os
  lançamentos.
- Os outros módulos **enviam ao financeiro** as faturas que geram (propostas,
  produção, mídia, contratos de fee). Depois disso, o documento de origem
  fica travado.

---

## 2. Telas

### 2.1 Pauta de lançamentos (`/financeiro`) (vista + código)

- Barra:
  - "Financeiro / Lançamentos";
  - botões **+ Receita**, **− Despesa** e **⇄ Transferência entre contas**;
  - navegação por **mês** (anterior/próximo; também por dia, "hoje", "ir
    para"), com opção "todo o período" e "sem data definida";
  - ícone de **Resumo**.
- **Colunas**: Venc./Pagto, Data de competência, Data de faturamento,
  Categoria, Nº/Título, Relacionado a, Sacado/Cedente, Doc/NF, Status/Situação,
  Valor (R$); indicadores de **conciliado** e **NFS-e**.
- Rodapé: "Exibindo X de Y" e **saldo previsto**.
- **Resumo do período** (painel):
  - receitas e despesas, realizado × previsto;
  - transferências (entradas e saídas);
  - saldo do período, **saldo acumulado** e saldo anterior;
  - a receber, recebido, a pagar e pago;
  - aviso de faturas em aberto de meses anteriores;
  - "Atualizar saldos" e "saldo das faturas selecionadas".
- **Ações por lançamento**:
  - quitar, cancelar, reabrir;
  - desconciliar;
  - **listar relacionados** (as parcelas do grupo);
  - **gerar recibo**;
  - **boleto** (gerar/visualizar);
  - NFS-e.
- **Ações em lote**:
  - **quitar** (informando a data de pagamento);
  - alterar data de vencimento e alterar status;
  - cancelar e reabrir.

  Os selecionados precisam ser todos receita ou todos despesa.
- **Cancelar um lançamento parcelado** pergunta o alcance:
  - só este;
  - este e os próximos em aberto;
  - todos os em aberto do grupo.
- A lista se atualiza sozinha ("atualizando em…", com opção de adiar).

### 2.2 Nova receita / despesa (modal) (código)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| Título | texto | sim | |
| Sacado (receita) / Cedente (despesa) | pessoa (cliente, fornecedor, prestador, veículo, colaborador) | sim | |
| Categoria | árvore do plano de contas | sim | Categoria inativa é recusada |
| Valor (R$) | moeda | sim | > 0 |
| Acréscimos / descontos | lista (tipo, título, valor) | não | Desconto total ≤ valor. Não combina com parcelamento. |
| Vencimento, competência, pagamento, faturamento | datas | | |
| **Condição** | à vista, parcelado, semanal, quinzenal, mensal, trimestral, semestral, anual | | Parcelado: mínimo 2 parcelas e máximo conforme o valor; cada parcela com data e valor editáveis |
| Nº documento ou NF | texto | não | |
| Nº referência | texto | não | Nº de pedido, contrato etc. |
| Forma de pagamento | seleção | sim | |
| Conta | seleção | sim | |
| Empresa | seleção | | Empresa emissora |
| Referente ao cliente | cliente | não | Fixo quando a fatura veio de um documento |
| Relacionado a | documento | não | Fixo quando a fatura veio de um documento |
| Centro de custo / **rateio** | um ou vários centros, em valor ou % | não | "Dividir igualmente" e controle do "total restante" |
| Situação | aberta / quitada | | |

Botões: **Salvar**, **Salvar e adicionar novo** e **Salvar e adicionar novo
mantendo os campos**. Há um modo simples e um completo.

**Agrupar faturas**: selecionar parcelas e salvar as cancela e soma numa
**nova fatura** (o histórico aponta "cancelada para ser agrupada").

### 2.3 Lançamento aberto (modal de edição) (código)

Mesmos campos, mais as abas **Anotações**, **Anexos** e **Histórico**.

- Não dá para mudar o cliente nem o documento de origem de fatura gerada por
  um documento.
- Ao editar uma parcela: "todas as faturas relacionadas foram atualizadas".
- Sem acesso à parcela-base, não gera novas parcelas.

### 2.4 Transferência entre contas (modal) (código)

Título*, conta de origem*, conta de destino* (diferente da origem), data e
valor (> 0).
- Gera saída e entrada vinculadas.
- Com data futura, fica **agendada**.
- Não pode ser cancelada se a entrada ou a saída já foi conciliada.

### 2.5 Contas / Conciliação (`/financeiro/contas`, legado)

- Cards das **contas bancárias** com saldo e saldo de todas as contas.
- **Conciliação bancária**:
  1. Importar o **extrato OFX** da conta (com período e data de emissão).
  2. A tela lista "extrato do banco" × "extrato da conta" e **identifica**
     os lançamentos correspondentes.
  3. Conciliar um a um ("conciliar com…") ou **todas as identificadas**. Dá
     para desconciliar.
  4. Finalizar o lote quando todo o extrato estiver conciliado.
- Enviar um novo arquivo descarta as pendências do lote anterior.
- Valores incompatíveis geram erro na conciliação.

### 2.6 Boletos e NFS-e (código + legado)

- **Boletos**: integração com o serviço Boleto Simples (carteira de cobrança,
  emissão pela pauta, arquivos de remessa/retorno). Fatura com boleto não pode
  ser excluída.
- **NFS-e**: integração com um emissor de nota fiscal de serviço (configuração
  em Integrações). A pauta mostra a situação da NFS-e por lançamento.

### 2.7 Configurações › Financeiro (legado + código)

| Tela | Conteúdo |
|---|---|
| **Categorias** (plano de contas) | Árvore de receitas e despesas com subcategorias. Excluir apaga as filhas e é bloqueado se houver faturas ou se a categoria for a padrão de algum módulo. |
| **Contas bancárias** | Banco, tipo de conta, agência, conta, saldo inicial **(inferido)**, conta padrão (não pode ser inativada nem excluída); conta com faturas não pode ser excluída. |
| **Formas de pagamento** | Fixas: Boleto, Cartão, Cheque, Débito automático, Depósito, Dinheiro, Pix, Transferência. A padrão não pode ser inativada. |
| **Centros de custo** | Lista (hoje vazia); centro com faturas não pode ser excluído. |
| **Acréscimos e descontos** | Tipos pré-cadastrados (nome + acréscimo ou desconto) |
| **Ajustes de saldo** | Lançamentos de ajuste de saldo por conta e data **(legado)** |

Configuração atual da conta (útil como dados iniciais):
- **Receitas**: FEE, Job a Job, PP – Comissão, Honorário, PI – Comissão.
- **Despesas**:
  - Impostos, Aluguel, Telefone, Energia Elétrica, Água e Esgoto, Telefonia;
  - Materiais de Escritório, Limpeza, Manutenção, Equipamentos;
  - Pessoal › Benefícios, Salários, Guias, 13º Salário, Férias, Rescisão.

### 2.8 Relatórios financeiros (código)

- Fluxo de caixa **mensal** e **diário**.
- **Lançamentos**, com colunas de ID, doc/NF, vencimento, pagamento,
  competência, nº de referência, categoria, título, sacado/cedente,
  relacionado a, cliente, projeto, empresa, conta, centro de custo, forma de
  pagamento, conciliado, tipo, status, situação, valor e valor líquido.
- **Centros de custo**.
- **Demonstrativo por competência**.
- **Movimentação por cliente** e **de terceiros**.
- **Contas**.
- Faturamento de propostas, produção, mídia e contratos de fee.

---

## 3. Modelo de dados observado

### 3.1 Lançamento (fatura)
| Campo | Tipo | Observação |
|---|---|---|
| id, grupo | inteiros | Grupo une as parcelas |
| tipo | receita / despesa | Na API, `positiveValue` 1/0 |
| tipo de fatura | cliente, fornecedor… | Papel da pessoa |
| título | texto | obrigatório |
| pessoa (sacado/cedente) | ref. pessoa | obrigatória |
| categoria | ref. categoria | obrigatória |
| conta, forma de pagamento | refs | obrigatórias |
| empresa | ref. empresa | |
| valor, acréscimos, descontos, valor final | moeda | |
| vencimento, pagamento, competência, faturamento | datas | |
| parcela nº / quantidade | inteiros | |
| condição | à vista, parcelado, recorrente | |
| nº documento/NF, nº referência | texto | |
| cliente referente, documento relacionado (tipo + id), projeto | refs | Fixos se vierem de documento |
| centro(s) de custo + rateio | lista (centro, valor/%) | |
| situação | aberta / quitada / cancelada | |
| status | ref. status financeiro | Em aberto, Enviado, Agendado |
| conciliado, id da transação | flag, texto | |
| boleto (URL, situação), NFS-e (situação) | | Integrações |
| agrupado em | ref. lançamento | Quando agrupado |
| usuário, criado/atualizado em | auditoria | |

### 3.2 Transferência
título, conta de origem, conta de destino, data, valor, par de lançamentos
(saída e entrada), agendada ou realizada.

### 3.3 Apoio
categoria (nome, pai, caminho, receita/despesa, situação); conta bancária
(nome, banco, tipo, agência, conta, padrão, situação); forma de pagamento
(nome, fixa, padrão, situação); centro de custo (nome, situação);
tipo de acréscimo/desconto (nome, sinal); lote de conciliação (conta, período,
data de emissão, linhas do extrato, lançamentos conciliados).

---

## 4. Ciclo de vida

```
ABERTA ── quitar (data de pagamento) ──► QUITADA ── reabrir ──► ABERTA
ABERTA ── cancelar (só esta / esta e próximas / todas abertas) ──► CANCELADA ── reabrir ──► ABERTA
ABERTA/QUITADA ── conciliar com extrato ──► CONCILIADA ── desconciliar ──► …
Parcelas ── agrupar ──► canceladas + nova fatura com a soma
```

---

## 5. Regras de negócio

1. Título, pessoa, categoria, conta e forma de pagamento são obrigatórios;
   valor > 0.
2. Fatura parcelada não aceita acréscimos/descontos, e vice-versa. O desconto
   total não pode passar do valor.
3. Parcelado: mínimo 2 parcelas, máximo conforme o valor. A soma das parcelas
   precisa bater com o total.
4. Quitar exige a data de pagamento. Em lote, os itens precisam ser todos
   receita ou todos despesa.
5. Fatura gerada por documento não muda de cliente nem de documento de
   origem.
6. Faturas enviadas por um documento travam a edição do documento. Reabri-las
   no documento cancela as faturas, o que não é permitido se alguma já foi
   quitada (ou, na mídia, se já foi transmitida ao CENP).
7. Transferência: contas de origem e destino diferentes; com data futura,
   fica agendada; não cancela se um dos lados estiver conciliado.
8. Categoria, conta, forma de pagamento e centro de custo com faturas não
   podem ser excluídos. Conta e forma de pagamento padrão não podem ser
   inativadas.
9. Fatura com boleto não pode ser excluída.
10. Conciliação: novo extrato descarta as pendências do lote anterior; o lote
    só finaliza com tudo conciliado.
11. Categoria inativa não aceita lançamentos novos.

---

## 6. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `crm` | Clientes (sacados), fornecedores, prestadores e veículos (cedentes); propostas enviam faturas |
| `projects` | Receitas e despesas vinculadas a projetos e jobs; cancelar projeto é bloqueado com faturas |
| `crm` / contratos de fee | Parcelas do contrato enviadas ao financeiro |
| Produção e Mídia | Faturamento com comissão, bonificação e repasse a terceiros (tipos FLCC, FBCC etc.) |
| `auth` | Colaboradores como cedentes (salários, benefícios); permissões de receitas, despesas e transferências |
| Integrações | Boleto Simples, emissor de NFS-e, extrato OFX |
| `ai` | Ferramentas de leitura sugeridas: resumo financeiro do período, a receber/pagar, faturamento por cliente |

---

## 7. Permissões

- **Financeiro**: nível do módulo, como em [projetos.md](projetos.md#7-permissões).
- Permissões separadas para **Receitas**, **Despesas** e **Transferências**.
  O menu "+ Adicionar" de outros módulos só oferece receita ou despesa a quem
  tem a permissão.
- Contas/conciliação, NFS-e, boletos e acréscimos/descontos: nível 6.

---

## 8. Notas para o operador

- A agência **não usa** o financeiro do Operand hoje (3 lançamentos). Antes de
  construir tudo, confirmar com o usuário o que a v1 precisa. Sugestão de
  núcleo:
  - contas a pagar e a receber com quitação;
  - categorias em árvore;
  - contas bancárias;
  - parcelamento;
  - vínculo com cliente e projeto;
  - fluxo de caixa.
- Fora da v1 provável: conciliação OFX, boletos, NFS-e, rateio por centro de
  custo, agrupamento de faturas.
- "Enviar ao financeiro" a partir de outros módulos = os outros módulos chamam
  a interface pública do `finance` para criar faturas. O `finance` devolve os
  ids e informa a situação (quitada etc.) para as travas.
- Dados financeiros são sensíveis: no módulo `ai`, enviar só totais e
  agregados necessários à pergunta.

---

## 9. Pendências

- Pauta e resumo com dados reais (a conta quase não tem lançamentos).
- Tela de contas/conciliação e configurações financeiras vistas só pelo
  código e textos do legado.
- Formulário de conta bancária (campos exatos, saldo inicial).
