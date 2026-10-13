# Operand: módulo Mídia (mapeamento funcional)

> Referência funcional para um módulo de **mídia** no operador (ainda não
> previsto na lista da v1). Descreve **o que** o Operand faz, não **como** ele
> faz: não reproduzir código, textos de interface, marca nem visual. Exemplos
> usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu MÍDIA (pauta e documentos por tipo), Configurações › Mídia, exportações CENP e Globo Ads, relatórios de mídia |
| Método | Pauta, documentos de mídia (internet, externa, outras e TV) e formato dos dados vistos com sessão ativa (só leitura). Formulários, configurações e exportações lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea` (app4 + legado app3, onde fica a tela do documento). |
| Uso na conta | **Alto**: 6.188 mídias. Numa amostra de 600: internet 172, outras 224, externa 139, TV 33, rádio 25, jornal 4 e revista 3. Quase todas têm valor, e só 1 foi faturada pelo Operand. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(legado)** =
script/modelo do front antigo; **(inferido)** = dedução.

---

## 1. Conceito

- **Mídia** é o documento de **compra de espaço/veiculação**, o "PI" (pedido
  de inserção) que a agência fecha com um **veículo** para um **cliente**,
  dentro de um projeto. Número no formato `projeto.sequência`.
- **Tipos de mídia** (cada um com uma tela própria):
  - **TV** (TV);
  - **Rádio** (RA);
  - **Jornal** (JO);
  - **Revista** (RE);
  - **Externa / OOH** (EX);
  - **Internet** (IN);
  - **Outras** (OU), por exemplo influenciadores e carro de som.
- Estrutura comum:
  - **peças** (criativos, identificados por letra: A, B, C…);
  - **grades** (cada grade é uma praça + um período), com linhas que
    combinam peça × programa/local/formato, quantidade de **inserções**,
    valor unitário, desconto, subtotal e **bonificação**;
  - totais: total da mídia, bonificação, desconto geral, valor total,
    **comissão** da agência (e comissão negociada), **honorários**, **valor
    líquido** (o que o veículo recebe);
  - **instruções de faturamento**: quem fatura contra quem (ver 2.4).
- O veículo é um cadastro de pessoa com papel **veículo** (ver
  [cadastros.md](cadastros.md)). Ele pode ter rede, canal, praças, programas e
  tabelas de preço.
- Relação com o **CENP-Meios**: entidade do mercado publicitário para a qual as
  agências enviam os dados de mídia. As mídias precisam de classificação CENP
  e o Operand gera o arquivo de envio.

---

## 2. Telas

### 2.1 Pauta de mídia (`/midia`) (vista + código)

- **Colunas**: Tipo de mídia (sigla), Nº doc, Título, Cliente, Projeto,
  Veículo, Data de criação, Prazo. Rodapé "Exibindo X de Y".
- Filtros, ordenação e ações em lote como nas outras pautas: alterar datas,
  responsável e status; concluir, cancelar e reabrir.
- Ações exclusivas:
  - **enviar faturas ao financeiro em massa** (código);
  - **exportação CENP-Meios** (`/midia/exportacao-cenp`, nível 6);
  - **exportação para Globo Ads** (arquivo de TV);
  - **exportar mídias em lote**.
- **Status de mídia** (configuração atual da conta):
  1. Em aberto
  2. Aprovação Interna
  3. Aprovação Cliente
  4. **Aprovado/Enviar PI** (não conta atraso)
  5. **Aguardando NF** (não conta atraso)
  6. Reprovado

### 2.2 Nova mídia (modal) (código)

| Campo | Tipo | Obrigatório |
|---|---|---|
| Título | texto | sim |
| Cliente / Projeto | seleção | cliente sim |
| **Tipo de mídia** | TV, rádio, jornal, revista, externa, internet, outras | sim |
| Veículo | cadastro com papel veículo | não (definido depois) |
| Responsável | usuário | não |
| Prazo | data | não |
| Briefing | texto rico + briefing predefinido de mídia | não |

Botões: Salvar e editar, Salvar e adicionar novo, Salvar.

### 2.3 Documento de mídia (`/m<tipo>/:id`, front legado) (vista)

Tela de cima para baixo (vista em internet, externa, outras e TV):

1. **Cabeçalho**:
   - "MÍDIA <TIPO>" + etiqueta de status;
   - faixa de concluída/cancelada com "reabrir";
   - número + título;
   - **Exportar** (PDF/impressão do PI, com preferências do PDF);
   - menu ⋮ (duplicar, cancelar etc.).
2. **Dados gerais**: cliente, projeto, **target** (público-alvo) e prazo.
3. **Veículo**:
   - veículo, **contato do veículo**, **rede** (ex.: rede de TV) e **tipo de
     rede** (TV aberta, TV por assinatura, rádio, outros), canal (TV);
   - **nº do orçamento**;
   - **comissão** (% ou valor, e comissão negociada) e **honorários**.
   - Trocar o veículo (ou o canal, na TV) **apaga as grades** e mantém só as
     peças, com aviso.
4. **Peças**: lista de peças com letra e título (ex.: "A — vídeo 15s"). Peça
   em uso numa grade não pode ser removida.
5. **Grades** (uma ou várias, cada uma com **praça** e **período**).
   - Ações: adicionar peça à grade, adicionar grade, duplicar grade (para
     outra praça, preservando só os programas disponíveis lá), mover grade de
     praça, **replicar grade** para outras mídias, resumir/detalhar grade.
   - As colunas mudam por tipo:

| Tipo | Colunas da grade |
|---|---|
| TV | Peça, **Programa**, Formato (duração), **calendário do mês com inserções por dia**, Inserções, Valor unitário (da tabela de preços do programa), Desconto (%), Subtotal, Bonificação |
| Rádio | Como TV, com programas de rádio e tabela de preços de rádio **(legado)** |
| Jornal | Peça, **Seção**, **Posição**, **Cor**, formato, datas; valor unitário pela tabela do jornal **(legado)** |
| Revista | Peça, revista/edição, formato; valor pela tabela **(legado)** |
| Externa (OOH) | Peça, **Produto** (ex.: painel de LED, outdoor), **Local** (endereço), **Período** por data ou por **bi-semana**, Início, Fim, Bi-semanas, Total de inserções, Valor unitário, Desconto, Subtotal, Bonificação |
| Internet | Peça, **Posição**, **Formato**, **Tipo**, Início, Fim, Total de inserções, **Custo por** (CPM, CPC etc.), Valor unitário, Desconto, Subtotal, Bonificação |
| Outras | Peça, **Local**, **Formato** (descrição livre da entrega), Início, Fim, Total de inserções, Valor unitário, Desconto, Subtotal, Bonificação |

6. **Instruções de faturamento**: tipo de faturamento (2.4) e **1º
   vencimento**.
7. **Totais**:
   - total da mídia, bonificação, **desconto geral** e valor total;
   - **valor líquido**;
   - linhas de "quem recebe": o veículo recebe do cliente (líquido); a
     agência recebe do cliente (comissão ou comissão negociada); a agência
     recebe do cliente (honorário);
   - **Editar faturamento**.
8. **Faturamento do veículo**: "<veículo> recebe de <cliente>", condição
   (à vista, parcelado…) e parcelas (vencimento, faturamento, valor, forma
   de pagamento).
9. **Observações ao veículo** e **observações ao cliente** (saem no PI/PDF).
10. **Envolvidos**, **briefing da mídia**, **briefing do projeto** e
    **anexos**.

### 2.4 Tipos de faturamento (código)

| Sigla | Significado |
|---|---|
| FLCC | Faturar **líquido** contra o **cliente**: o veículo fatura o líquido ao cliente; a agência fatura a comissão ao cliente |
| FBCC | Faturar **bruto** contra o **cliente** |
| FLCA | Faturar **líquido** contra a **agência** |
| FL+CCA | Faturar **líquido + comissão** contra a **agência** |
| FBCA | Faturar **bruto** contra a **agência** |

A combinação define quantas faturas nascem, quem é o sacado e quem é o
cedente em cada uma, e se a comissão negociada se aplica.

### 2.5 Exportações e integrações (código)

- **CENP-Meios**:
  - por empresa: configurar o envio (ID da agência, usuário, senha e chaves
    de criptografia; ou importar o arquivo de configuração);
  - **gerar** o arquivo do período;
  - antes de gerar, a tela lista as **não conformidades**: praça sem estado,
    estado inválido, praça inválida, mídia ou veículo sem classificação CENP.
    Cada uma tem um atalho "corrigir mídia/veículo";
  - histórico com "gerado em" e "transmitido em", e **transmitir**;
  - classificações de internet: áudio, busca, social, vídeo, display e
    outros; e OOH.
- **Globo Ads**: gera o arquivo de TV para a Globo. Valida que a mídia está
  ativa, é de TV, tem veículo, uma única grade preenchida e rede GLO/GST.
  Mídias com erro podem ser puladas ou revalidadas.
- **Envio em massa ao financeiro**: processa em segundo plano (pode fechar a
  janela), trava a edição das mídias enviadas e mostra as que falharam
  (pular ou revalidar).
- Faturas de mídia já transmitidas ao CENP **não podem ser reabertas**.

### 2.6 Configurações › Mídia (código)

| Tela | Conteúdo |
|---|---|
| **Briefings predefinidos** | Modelos de briefing de mídia (hoje 1) |
| **Redes** | Rede (≤ 250 caracteres), **mnemônico** (sigla de tamanho fixo) e tipo (TV aberta, TV por assinatura, rádio, outros). Rede em uso não pode ser removida nem ter o mnemônico alterado. |
| **TV › Programas** | Nome, **mnemônico** (único por rede), rede e canal. Alterar a rede em lote. Programa usado numa tabela de preços não pode ser excluído. Hoje há 141 programas. |
| **TV › Tabelas de preços** | Por veículo: mnemônico, rede, canal, **praça** e **vigência** ("a partir de"); linhas por programa e formato. Importação por planilha, ativar/desativar. |
| **Rádio › Programas** e **Tabelas de preços** | Equivalentes aos de TV |
| **Internet › Métricas de custo** | Tipos de "custo por" (CPM, CPC etc.) **(inferido)** |
| **Praças** | Cidades/regiões de veiculação, com estado (exigido pelo CENP) |

### 2.7 Relatórios (código)

- **Mídia › Pauta**.
- **Mídia › Faturamento**: receitas, comissão, honorários, tipo de mídia,
  classificação CENP, veículo, tipo de faturamento, total da mídia,
  bonificação, desconto, valor total, valor líquido, desconto de comissão e
  valor final.
- **Veículos**: pauta.

---

## 3. Modelo de dados observado

### 3.1 Mídia
| Campo | Tipo | Observação |
|---|---|---|
| id + sequência no projeto | inteiros | `projeto.sequência` |
| título | texto | obrigatório |
| cliente, projeto | refs | cliente obrigatório |
| tipo de mídia | tv, radio, newspaper, magazine, external, internet, other | obrigatório |
| subtipo / classificação CENP | enum | internet áudio/busca/social/vídeo/display; OOH; outros |
| veículo, contato do veículo | refs | |
| rede, tipo de rede, canal | refs | TV/rádio |
| target, nº do orçamento | texto | |
| responsável, solicitante, envolvidos | usuários | |
| prazo, data do documento | datas | |
| status | ref. status de mídia | |
| situação | aberta / concluída / cancelada | |
| comissão (tipo, valor), comissão negociada, honorários (tipo, valor) | números | |
| bonificação, desconto geral (valor ou %) | números | |
| total da mídia, valor total, valor líquido | calculados | |
| tipo de faturamento, 1º vencimento, condição, parcelas | | |
| enviado ao financeiro / reabrindo | flags | Travam a edição |
| observações ao veículo e ao cliente, briefing | texto | |
| preferências do PDF | JSON | |

### 3.2 Peça
letra (índice), título.

### 3.3 Grade
praça, período (mês ou datas/bi-semanas), lista de linhas, totais
(inserções, valor, desconto, bonificação), grupo (quando replicada).

### 3.4 Linha da grade (inserção)
peça + (programa | produto e local | seção, posição e cor | posição, formato
e tipo | local e formato), datas de início e fim (ou bi-semanas, ou
calendário dia a dia na TV/rádio), quantidade de inserções, custo por,
valor unitário, desconto, subtotal, bonificação (sim/não).

### 3.5 Apoio
rede (nome, mnemônico, tipo), programa (nome, mnemônico, rede, canal),
tabela de preços (veículo, praça, rede, canal, vigência, preços por
programa/formato), praça (nome, sigla, estado), configuração CENP por empresa.

---

## 4. Regras de negócio

1. Título, cliente e tipo de mídia são obrigatórios.
2. Trocar veículo, canal, praça, produto ou revista apaga os dados
   dependentes (grades, peças da grade), com confirmação.
3. Peça usada numa grade não pode ser excluída.
4. Na TV e no rádio, só é possível inserir em dias em que o programa é
   veiculado; inserções inválidas não são salvas.
5. Bi-semana inicial antes da final; período obrigatório para duplicar
   grade.
6. A comissão não pode passar do valor total da mídia; descontos não podem
   deixar o total negativo.
7. Valor líquido = valor total − comissão (FLCC), conforme o tipo de
   faturamento.
8. Enviar ao financeiro trava a edição. Reabrir faturas não é permitido se
   houver fatura quitada ou já transmitida ao CENP.
9. CENP: a mídia ou o veículo precisa de classificação; a praça, de estado
   válido.
10. Os status "Aprovado/Enviar PI" e "Aguardando NF" não contam atraso.

---

## 5. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `projects` | Mídia dentro de projeto; contadores e atrasados do projeto |
| `crm` / cadastros | Cliente, veículo (pessoa com papel veículo) e contatos do veículo |
| `finance` | Faturas por tipo de faturamento (veículo × agência × cliente), comissão, honorários |
| `timesheet` | Horas apontadas na mídia, só com a opção "timesheet em todos os módulos" ligada (desligada na conta; ver [configuracoes.md](configuracoes.md#16-módulos-e-funções-vista--legado)) |
| Integrações | CENP-Meios (arquivo e transmissão), Globo Ads |
| `ai` | Ferramentas sugeridas: investimento por cliente, veículo e tipo de mídia; mídias aguardando PI ou NF |

---

## 6. Permissões

- **Mídia** (`medias`): nível do módulo, como em
  [projetos.md](projetos.md#7-permissões).
- Exportação CENP: nível 6.
- Veículos: permissão de cadastro de veículos.

---

## 7. Notas para o operador

- Mídia é o terceiro módulo mais usado da agência (6 mil documentos). Sugestão:
  **incluir um módulo `media` na v1**, ou pelo menos um formato simplificado:
  - mídia com veículo e peças;
  - grade com período, local/posição/formato, inserções, valor unitário,
    desconto e bonificação;
  - comissão, valor líquido e PDF do PI.
- Na amostra, os tipos mais usados são **outras**, **internet** e
  **externa**; TV, rádio, jornal e revista aparecem pouco. A grade com
  calendário de programas (TV/rádio) e as tabelas de preço por programa são
  o pedaço mais complexo e o menos usado. Candidato a depois da v1.
- CENP e Globo Ads: confirmar com o usuário se a agência transmite ao CENP.
- O faturamento quase não é usado no Operand (1 mídia faturada). Os status
  "Aprovado/Enviar PI" e "Aguardando NF" sugerem que o PI sai do Operand e a
  nota é controlada fora.

---

## 8. Pendências

- Telas de jornal, revista e rádio vistas só pelo código.
- Preferências do PDF do PI (campos exatos).
- Fórmula exata de cada tipo de faturamento (quais faturas são geradas).
- Lista de praças e veículos reais (dados de cadastro, não mapeados aqui).
