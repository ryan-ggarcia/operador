# Operand: módulo Projetos (mapeamento funcional)

> Referência funcional para o módulo `projects` do operador. Descreve **o que** o
> Operand faz, não **como** ele faz: não reproduzir código, textos de interface,
> marca nem visual. Exemplos usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Conta da agência no Operand (menu PROJETOS e Configurações › Projetos) |
| Método | Somente leitura, em duas frentes. (1) Telas: leitura passiva da página e respostas de leitura (GET) da API. (2) Telas que exigiriam clicar em ações (formulários, confirmações, exportações): extraídas pelo **MCP `rea`**, que exportou os scripts do front carregados no navegador (`inspect_web_page` + `export_web_scripts`) para leitura estática dos componentes, mais capturas passivas de tela (`capture_web_screenshot`). Durante toda a análise, uma guarda bloqueou qualquer requisição de escrita. |
| Fora do escopo | Jobs, tarefas e aprovações têm menu próprio no Operand e vão para `docs/operand/jobs.md` |

Marcações de origem:
- sem marcação: visto na tela;
- **(código)**: extraído dos componentes do front pelo MCP, sem abrir a tela;
- **(inferido)**: dedução a partir do código, sem texto explícito.

---

## 1. Conceito

- **Projeto** é o agrupador de trabalho de **um cliente** (ex.: uma campanha,
  um evento, uma ação sazonal). Internamente o Operand chama o projeto de
  *campaign*.
- Um projeto **contém documentos** de vários módulos:
  - Jobs (módulo Jobs)
  - Propostas (módulo Propostas)
  - Produções (módulo Produção)
  - Mídias (módulo Mídia)
  - Lançamentos financeiros: receitas e despesas (módulo Financeiro)
- O projeto não tem horas nem custo próprios. Tempo, custo, prazo estimado e
  contadores são **somados a partir dos documentos** que ele contém.
- Numeração: o projeto tem um número sequencial na agência (ex.: `1234`). Os
  jobs dentro dele são numerados como `<nº do projeto>.<sequência>` (ex.:
  `1234.1`, `1234.2`).
- Todo cliente tem um projeto **"Geral"** criado pelo sistema. Documentos
  criados sem projeto caem nele (ver regras 5.10 e 5.11).

---

## 2. Telas

### 2.1 Lista de projetos (`/projetos`)

Tela principal do módulo, em **cards** (grade de 4 colunas na tela larga).

**Barra superior**
- Título "Projetos" com o botão **+ Adicionar**, que abre o modal de novo
  projeto (2.2).
- **Busca** rápida por texto.
- Ícone de **Filtros**, que abre um painel lateral (abaixo).
- Ícone de **Configurar exibição**, que abre o painel de ordenação (abaixo).

**Card do projeto**
| Elemento | Descrição |
|---|---|
| Estrela | Favoritar ou desfavoritar. Só aparece em projeto aberto. É por usuário. |
| Número + título | O título leva ao detalhe do projeto. Quebra em até 2 linhas. |
| Cliente | Nome do cliente |
| Criado em | Data e hora de criação, ou "criado pelo sistema" no projeto Geral |
| Prazo estimado | Maior prazo entre os documentos do projeto. A cor muda quando o prazo é hoje ou já passou. |
| Contadores | Quantidade de documentos por tipo (ex.: "3 Jobs", "1 Mídia") |
| Aviso de arquivamento | Quando todos os documentos estão concluídos, o card sugere arquivar o projeto e mostra um atalho **Arquivar** |
| Envolvidos | Avatares dos usuários envolvidos (foto ou inicial) |
| Status | Seletor compacto do status do projeto (vazio = "sem status"). Exige permissão nível ≥ 3 para alterar. |
| Menu ⋮ | Projeto aberto: **Selecionar projeto**, **Arquivar**, **Cancelar**. Projeto arquivado: **Selecionar projeto**, **Reabrir**, **Cancelar**. |

**Rodapé**: "Exibindo N de M". A lista carrega mais cards conforme a rolagem; o
tamanho da página depende da altura da tela.

**Painel de filtros** (botões **Filtrar** e **Limpar**)
| Filtro | Tipo | Observação |
|---|---|---|
| Busca | texto | |
| Status | multisseleção com busca | Opções: "Sem status" + status cadastrados (cor + nome) |
| Cliente | seleção | |
| Contrato | seleção | Fica desabilitado até escolher um cliente ("selecione primeiro um cliente") |
| Data de criação | intervalo de datas | Data inicial e data final |
| Situação dos projetos | 3 chaves liga/desliga | **Abertos**, **Arquivados**, **Cancelados**. Padrão: Abertos + Arquivados. |
| Visibilidade | chave | **Apenas ocultos** |
| Responsável | seletor de usuário | |
| Envolvidos | seletor de usuário | |

O filtro aplicado fica salvo como **preferência do usuário** e volta na
próxima visita.

**Configurar exibição**
- **Ordenação**: Ordenação padrão, Cliente, Data do apontamento (último
  lançamento de horas), Título ou Número do projeto, com direção
  crescente/decrescente.
- Link **Mais configurações**, que leva às configurações do módulo (2.4).

**Modo de seleção (ações em lote)**
- Entra pelo menu do card, em "Selecionar projeto". Um contador mostra "N
  selecionados".
- Ações: **Arquivar**, **Cancelar**, **Reabrir** e **Desbloquear** (este só
  para projetos do sistema).
- Cada ação pede confirmação explicando o efeito em cascata. Reabrir pergunta
  se os documentos também devem ser reabertos. **(código)**
- Projetos que já estão na situação de destino são ignorados (ver 5.5), e o
  sistema avisa isso antes de confirmar.
- Projetos criados pelo sistema ficam fora das ações em lote de
  arquivar/cancelar/reabrir.

### 2.2 Novo projeto (modal) (código)

Abre pelo **+ Adicionar** da lista, pelo cabeçalho do módulo ou pelo
"+ Adicionar › Projetos" dentro de um projeto, que já preenche o mesmo cliente.
O modal não fecha ao clicar fora nem com Esc. Título do modal: "Adicionar
projeto", ou "Adicionar projeto a partir de um template" no modo template.

| Campo | Tipo | Obrigatório | Validações e comportamento |
|---|---|---|---|
| Título | texto curto | sim | Não pode ser vazio. Remove espaços nas pontas e caracteres não imprimíveis, inclusive ao colar. |
| Cliente | seleção única (cadastro de clientes) | sim | Precisa ser um cliente válido (id ≥ 1) |
| Descrição (briefing) | texto rico | não | Editor com formatação e emoji, sem imagens. Tem seletor de **briefing predefinido** (2.4) que preenche o texto e um link para cadastrar novos. |
| Projeto oculto | liga/desliga (ícone no título do modal) | não | Só aparece para quem tem permissão de projetos ocultos. Padrão: visível. |

**Botões**: **Salvar e editar** (abre o projeto criado), **Salvar e adicionar
novo** (limpa o formulário e mantém o modal aberto) e **Salvar** (fecha). Depois
de salvar aparece um aviso com link para o projeto.

**Criar a partir de template** (ícone no título do modal; requer permissão)
- O modal vira uma tabela de templates com nome, quantidade de jobs e um
  *preview* que lista os 5 primeiros jobs e "+N".
- Tem busca por nome e rolagem infinita, e permite escolher **um** template.
- Ao escolher, título e briefing vêm do template; o cliente continua
  obrigatório.
- Salvar cria o projeto **e todos os jobs/tarefas do template** de forma
  assíncrona. O usuário recebe um aviso quando termina.
- Salvar sem escolher template mostra o aviso "selecione um template".

Na criação, o **responsável** e o **solicitante** são o próprio usuário. O
projeto nasce aberto, sem status e sem prazo desejado.

### 2.3 Detalhe do projeto (`/projetos/:id`)

**Cabeçalho**
| Elemento | Comportamento |
|---|---|
| Estrela | Favorito |
| Número | Somente leitura |
| Título | Editável na própria tela |
| Cliente | Somente leitura: o cliente não muda depois da criação |
| Avatar do responsável | Troca o responsável (ver regra 5.7). O tooltip mostra o responsável e quem criou o projeto, com a data. |
| Status | Seletor com os status cadastrados ou "sem status" |
| Botão **Arquivar** | Arquiva o projeto. No projeto arquivado vira **Reabrir**. |
| Menu ⋮ | **Arquivar**, **Cancelar**, **Duplicar**, **Alterar para projeto oculto/visível**, **Exportar simples**, **Exportar detalhado** |

**Menu ⋮ de ações (código)**

Cada ação abre um **segundo painel** no próprio menu, com:
- título;
- texto explicando o efeito;
- link para a central de ajuda;
- botões **Não** e **Sim**.

Nada acontece antes do "Sim".

| Ação | Aparece quando | Painel |
|---|---|---|
| Arquivar | projeto aberto | "Arquivar projeto": confirma arquivar o projeto e **todos** os documentos vinculados |
| Cancelar | projeto não cancelado | "Cancelar projeto": confirma cancelar o projeto e **todos** os documentos vinculados |
| Reabrir | projeto não aberto | "Reabrir projeto": confirmação + chave **"Reabrir também os documentos?"** (padrão: não) |
| Desbloquear projeto | projeto criado pelo sistema | Pergunta se o usuário quer desbloquear e **tornar-se o responsável**. Explica que, sem responsável, o projeto do sistema não pode ser arquivado, cancelado nem renomeado. |
| Duplicar | sempre | "Duplicar projeto": seletor de **cliente de destino** (obrigatório; vem preenchido com o cliente atual) e confirmação "duplicar o projeto e todos os documentos para o cliente selecionado". Durante a cópia, mostra "estamos criando os documentos do projeto, aguarde". |
| Alterar para projeto oculto / visível | usuário com permissão de projetos ocultos | Explica o efeito: oculto = só envolvidos e administradores do módulo veem; visível = outros usuários podem passar a ver. Pergunta "deseja continuar?". |
| Exportar simples | sempre | Aviso de que os filtros da página podem ser redefinidos. Ao confirmar, gera o documento descrito em 2.7. |
| Exportar detalhado | sempre | Abre o assistente descrito em 2.7 |

Bloqueios:
- Arquivar, cancelar, reabrir e ocultar ficam bloqueados se:
  - o projeto está mudando de situação naquele momento;
  - o usuário não tem escrita;
  - o projeto foi criado pelo sistema.
- Duplicar e exportar ficam bloqueados só nos dois primeiros casos.

**Indicadores** (cada um com um "?" explicativo)
| Indicador | Origem | Editável |
|---|---|---|
| Prazo desejado | Data informada pelo usuário (pode ficar vazia) | sim |
| Prazo estimado | **Calculado**: maior prazo entre todos os jobs e documentos do projeto | não |
| Tempo | **Calculado**: "realizado de estimado". Realizado = soma das horas lançadas em todos os jobs; estimado = soma das horas previstas dos jobs. Tem barra de progresso. | não |
| Budget | Valor em R$ com a estimativa de custo do projeto, pensada a partir do custo/hora dos envolvidos | sim (permissão de budget) |
| Custo | **Calculado**: soma, para cada colaborador, de valor/hora × horas lançadas nos documentos do projeto | não |
| Contrato | Link **Relacionar**: vincula um contrato de fee do cliente; as horas lançadas passam a contar nesse contrato | sim (permissão de contrato) |

Budget e Custo só aparecem para quem tem a permissão de budget de projetos.

**Contrato (código)**
- Sem contrato: link **Relacionar**, que abre um seletor com busca ("buscar
  contrato de fee"). O seletor lista só os contratos **ativos do mesmo
  cliente** e confirma com **Ok**.
- Com contrato: mostra o número do contrato com 3 dígitos (ex.: `007`).
  - Clicar no número abre o seletor para trocar o contrato.
  - Um ícone abre o contrato em outra aba (só para quem tem o módulo de
    contratos de fee).
  - Um "x" desfaz a relação.
- Quem só tem leitura vê o número ou um "Relacionar" desabilitado, com a dica
  "não há contrato relacionado".

**Documentos do projeto**
- **+ Adicionar**, um menu com: Projetos, Jobs | Propostas, Produção, Mídia |
  Receitas, Despesas.
  - Cada opção abre o cadastro do documento já com cliente e projeto
    preenchidos.
  - "Projetos" cria **outro** projeto para o mesmo cliente. Não é subprojeto.
  - Receitas e Despesas abrem o lançamento financeiro já vinculado ao projeto e
    ao cliente.
  - **(código)** O menu só mostra os tipos em que o usuário tem permissão de
    escrita. Receitas e despesas dependem também das permissões específicas do
    financeiro. O menu só aparece com o projeto aberto.
- Ícone de **template** ao lado do + Adicionar (código): abre "Selecionar
  template".
  - O modal tem busca, tabela (template, nº de jobs, preview) e os botões
    Cancelar/Salvar.
  - Salvar **insere os jobs e tarefas do template neste projeto**, de forma
    assíncrona, com aviso de "aguarde".
  - Template sem jobs gera o aviso "template sem job cadastrado".
- Uma faixa por tipo de documento existente, por exemplo
  "Jobs 8 [badge] … 0 / 8":
  - número ao lado do nome = total de documentos daquele tipo;
  - badge vermelho = quantidade de documentos **atrasados**; passar o mouse
    mostra "N atrasados";
  - "X / Y" = concluídos / total. A faixa enche de verde na proporção dos
    concluídos e ganha um ✓ quando todos estão concluídos;
  - **(código)** Durante uma ação em massa, a faixa mostra o andamento:
    atualizando contadores, concluindo, reabrindo, cancelando ou clonando
    documentos;
  - **(código)** A faixa fica desabilitada (sem clique) para quem não tem
    leitura naquele tipo de documento.
- Clicar na faixa abre a **visão de documentos** do projeto:
  - Barra lateral com os tipos e seus "concluídos / total", e o link
    **Visão geral** para voltar.
  - Lista do tipo escolhido, por exemplo "Jobs / Pauta", com + Adicionar,
    seleção, busca, filtros e configurar exibição.
  - Cada linha de job tem: número `projeto.sequência`, título, quantidade de
    tarefas abertas, responsável, prazo (vermelho se atrasado), etiqueta de
    status do job e menu ⋮.
  - Filtros dessa lista: status, data, envolvidos, solicitante, responsável e
    situação (padrão: abertos).
  - Ações em lote nos documentos: alterar prazo, responsável ou status;
    concluir, reabrir e cancelar; **mover para outro projeto**.

**Briefing**
- Editor de texto rico com salvamento automático: após uma pausa curta na
  digitação e ao sair do campo.
- Menu ⋮ para inserir um briefing predefinido. O seletor tem busca, botão Ok e
  link para cadastrar novos.
- Fica bloqueado se o projeto não está aberto ou se o usuário não tem escrita.
- **(inferido)** No detalhe o editor aceita imagem; no modal de criação, não.

**Abas laterais** (estrutura das abas Comentários, Anexos e Timesheet tirada do
código, porque os projetos consultados não tinham registros nelas)
| Aba | Conteúdo |
|---|---|
| Comentários | Lista de comentários e um campo "insira seu comentário aqui" (Esc cancela, **Enviar** envia). Detalhes abaixo. |
| Anexos (contador no título) | Área de arrastar e soltar ou procurar arquivo (só com projeto aberto) e lista de arquivos. Detalhes abaixo. |
| Timesheet | Lançamentos de horas ligados ao projeto, com o documento de cada lançamento. Cada um é marcado como **N** (horas normais) ou **RT** (retrabalho). Dá para editar (inclusive escolher a tarefa) e excluir com confirmação. Sem dados mostra "nenhum lançamento". |
| Histórico | Linha do tempo de auditoria: data, hora, usuário e ação (ex.: criou o projeto, adicionou um usuário, alterou o título de "A" para "B") |

Comentários:
- Permitem **menções**, mas só de usuários envolvidos no projeto.
- Mostram quem está digitando ("X está digitando").
- Validam limite de tamanho e caracteres inválidos.
- Dá para editar e cancelar comentários.
- Também mostram **solicitações de aprovação** feitas no documento, com
  prazo, data da solicitação, aprovado por, reprovado por ou cancelado em.
  O fluxo de aprovação é detalhado no mapeamento de Jobs.

Anexos:
- Cada arquivo tem data, indicador de descrição e situação de aprovação (em
  aprovação, aprovado, reprovado).
- Dá para baixar e excluir (com confirmação).
- O upload mostra o andamento (enviando, enviado, erro, reenviar) e respeita
  um tamanho máximo por arquivo.
- Há uma **cota de armazenamento** da conta: avisos de espaço acabando e de
  espaço esgotado, com convite para contratar mais espaço ou excluir arquivos.

**Rodapé**: "Envolvidos no projeto", com avatares e botão para adicionar
usuários.

**Projeto arquivado ou cancelado**: os campos ficam somente leitura e o botão
principal vira Reabrir.

### 2.4 Configurações do módulo (Configurações › Projetos)

| Tela | Conteúdo |
|---|---|
| **Status** | Lista de status de projeto. Cada um tem nome, cor e situação (ativo/inativo). Dá para incluir, editar, excluir, mudar a ordem arrastando e buscar. Os status são só internos (o cliente não vê). |
| **Briefings predefinidos** | Lista de modelos de briefing (título + texto rico) usados ao criar ou editar projetos. Dá para incluir, editar e excluir. |
| **Templates** | Lista de templates de projeto com nome, nº de jobs, nº de tarefas e criador. Dá para incluir, editar, excluir e buscar. Um template tem título, briefing e uma lista ordenada de jobs; cada job tem título, responsável, status, briefing e suas tarefas. Também é possível **criar template a partir de um projeto** existente. |

Configuração atual da agência (útil para dados iniciais):
- **Status de projeto**: Planejar, Executar, Aprovar, Finalizar, Entregue, nesta
  ordem e todos ativos.
- **Briefings predefinidos**: Branding, Campanha + Ação Promocional, Campanha
  Sazonal, Eventos.

### 2.5 Seletores reutilizados (código)

| Seletor | Comportamento |
|---|---|
| Status | Lista com busca: status ativos, um grupo de **inativos** e "Sem status"; confirma com Ok. Os status podem ser organizados em **grupos de status**. |
| Prazo (data) | Escolha de data, com hora opcional, ou **Sem prazo** |
| Usuários (responsável, envolvidos) | Lista de avatares com busca. Oferece "sem responsável" / "sem envolvidos" quando cabe. |
| Cliente | Lista de clientes **ativos** com busca |

### 2.6 Projeto "Geral" do cliente (visto na tela)

- Título fixo "Geral", criado pelo sistema, **sem responsável** e sem status.
- No cabeçalho não aparecem o responsável, o status nem o botão Arquivar. No
  lugar aparece o botão **Desbloquear projeto**.
- O resto da tela é igual (indicadores, documentos, abas, briefing).
- Na conta da agência existem dezenas desses projetos, um por cliente que já
  teve documento criado sem projeto.

### 2.7 Exportações (código)

**Exportar simples**
- Junta **todos** os documentos do projeto (jobs, propostas, produções, mídias
  e lançamentos) e gera um documento para **impressão/PDF**, com o cabeçalho da
  empresa padrão da agência.
- Conteúdo:

| Bloco | Campos |
|---|---|
| Cabeçalho do projeto | Cliente, data de emissão, prazo desejado, prazo estimado, tempo realizado / estimado; budget e custo só com a permissão de budget |
| Jobs | Nº, título, horas, tarefas, data de início, prazo, responsável, status |
| Propostas | Nº, título, prazo, responsável, status, valor + subtotal |
| Produções | Nº, título, prazo, responsável, status, valor + subtotal |
| Mídias | Nº, tipo, título, prazo, responsável, status, valor + subtotal |
| Lançamentos | Categoria, título, relacionado a, vencimento/pagamento, sacado/cedente, status, valor + subtotal |
| Rodapé | Total dos faturamentos e total das faturas; dados do cliente (CPF/CNPJ, endereço, CEP, contato, telefone) para quem pode ver clientes |

- No modo de seleção de documentos, também dá para exportar **só os
  selecionados**.

**Exportar detalhado** (assistente em 2 etapas)
1. **Selecionar documentos**: documentos do projeto agrupados por tipo, com
   busca e marcação individual ou de todos. Vêm todos marcados por padrão.
2. **Configurar o que vai ser impresso / PDF**:
   - **Empresa** emissora: entre as empresas ativas da agência, com a padrão
     já escolhida;
   - opções por grupo:

| Grupo | Opções |
|---|---|
| Geral | Dados do cliente, dados da empresa, lançamentos ref. projetos e jobs, assinatura do cliente, assinatura da empresa, tempo realizado/estimado, prazo desejado, prazo estimado, custo do projeto, budget |
| Jobs | Horas, data de início, responsável, tarefas, prazo |
| Propostas | Honorários, custos externos, valores totais dos itens, encargos, valores dos itens, soma dos valores dos itens (só com "valores dos itens") |
| Produção | Comissão, honorários, fornecedores, somar valores aprovados, ordenar valores do menor para o maior |
| Mídia | Comissão, desconto da comissão, honorários, bonificação, comissão/valor líquido, informação do desconto-padrão CENP (só com "comissão/valor líquido") |
| Faturas | Subtotal de faturas em aberto |

O resultado é gerado a partir de uma consulta só de leitura com os documentos
e opções escolhidos.

---

## 3. Modelo de dados observado

Tipos e nomes descritivos; os nomes de coluna do operador serão definidos na
modelagem.

### 3.1 Projeto
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id / número | inteiro sequencial | auto | Exibido como número do projeto |
| título | texto | sim | |
| cliente | ref. cliente (CRM) | sim | Não muda depois da criação |
| descrição (briefing) | texto rico (HTML) | não | |
| solicitante | ref. usuário | auto | Quem criou |
| responsável | ref. usuário | auto | Padrão: quem criou; editável |
| status | ref. status de projeto, ou nenhum | não | |
| situação | enum: `aberto`, `arquivado`, `cancelado` | auto | Ciclo de vida (seção 4) |
| oculto | booleano | não | Padrão: falso |
| prazo desejado | data | não | |
| budget | decimal (R$) | não | Padrão: 0 |
| contrato de fee | ref. contrato, ou nenhum | não | No máximo 1 por projeto |
| criado por | enum: `usuário`, `sistema` | auto | `sistema` = projeto Geral do cliente |
| concluído em | data/hora | auto | Preenchido ao arquivar |
| quem mudou a situação | ref. usuário | auto | |
| criado em / atualizado em | data/hora | auto | |
| envolvidos do projeto | lista de usuários | | Quem participa do projeto |
| favoritos | lista de usuários | | Favorito é por usuário |

**Campos calculados** (não gravados pelo usuário)
| Campo | Cálculo |
|---|---|
| prazo estimado | Maior prazo entre os documentos do projeto |
| tempo estimado | Soma das horas previstas dos jobs |
| tempo realizado | Soma das horas lançadas nos jobs |
| custo | Soma de horas lançadas × valor/hora de cada colaborador |
| contadores por tipo | Para jobs, propostas, produções, mídias e lançamentos: total, abertos e cancelados |
| atrasados por tipo | Quantidade de documentos com prazo vencido, por tipo |
| envolvidos (geral) | Envolvidos do projeto + envolvidos dos documentos |
| qtde. de anexos | |

### 3.2 Status de projeto
nome, cor (hex), ordem, ativo/inativo, excluído (exclusão lógica). Os
status são separados por tipo de documento: projeto e job têm listas próprias.

### 3.3 Briefing predefinido
título, texto rico, tipo (aqui: projeto).

### 3.4 Template de projeto
título, briefing, criador, criado/atualizado em, excluído (lógico), jobs do
template (título, responsável, status, briefing, ordem, tarefas).

### 3.5 Histórico (log)
data/hora, usuário, origem (usuário/sistema), ação (criou, alterou, cancelou,
concluiu, reabriu, adicionou, removeu, relacionou…), entidade afetada (projeto,
envolvido, arquivo, contrato…), campo, valor antigo e valor novo.

### 3.6 Comentário
documento (tipo + id), autor, texto, menções, situação (ativo/removido),
data.

---

## 4. Ciclo de vida (situação)

```
            arquivar                       cancelar
 ABERTO  ─────────────►  ARQUIVADO       ABERTO ──────► CANCELADO
   ▲                        │                ▲              │
   └──────── reabrir ───────┘                └── reabrir ───┘
                     ARQUIVADO ── cancelar ──► CANCELADO
```

- **Arquivar** = concluir o projeto. **Todos** os documentos vinculados são
  concluídos automaticamente, e os cronômetros de timesheet ativos no projeto
  são parados.
- **Cancelar** = cancela o projeto e **todos** os documentos vinculados.
- **Reabrir** volta o projeto para aberto. Pergunta se os documentos também
  devem ser reabertos (sim/não).
- **Status** (Planejar, Executar…) é independente da situação. Um job pode
  estar com status "Entregue" e continuar aberto.

---

## 5. Regras de negócio

1. Título e cliente são obrigatórios; o cliente é fixo depois da criação.
2. Quem cria vira solicitante e responsável. Trocar o responsável **adiciona**
   o novo responsável aos envolvidos do projeto.
3. Prazo estimado, tempo, custo e contadores são sempre derivados dos
   documentos e não se editam.
4. Arquivar conclui todos os documentos; cancelar cancela todos. Os dois pedem
   confirmação explicando o efeito em cascata.
5. Ações em lote ignoram projetos que já estão no estado de destino: ao
   reabrir, os já abertos; ao arquivar, os cancelados ou já arquivados; ao
   cancelar, os arquivados.
6. **Não é possível cancelar** um projeto com faturas vinculadas a ele ou aos
   seus documentos, ou com documentos já enviados ao financeiro.
7. Projeto arquivado ou cancelado fica somente leitura. Para reabrir um
   documento de um projeto fechado, é preciso reabrir o projeto antes.
8. **Duplicar** copia o projeto e **todos os seus documentos** para um cliente
   escolhido. O padrão é o mesmo cliente, e o campo é obrigatório. A cópia é
   assíncrona, com aviso de "aguarde".
9. Duplicar, adicionar ou mover documentos é bloqueado enquanto houver
   documentos em **processo de recorrência** no projeto. O sistema pede para
   tentar de novo em instantes.
10. Documentos criados sem projeto vão para o projeto **"Geral"** do cliente,
    criado pelo sistema.
11. O projeto do sistema nasce **sem responsável e bloqueado**: não pode ser
    arquivado, cancelado, reaberto nem renomeado. Duplicar e exportar
    continuam liberados. Para editar, alguém com permissão total (nível ≥ 6)
    o **desbloqueia** e vira o responsável. O desbloqueio também pode ser
    feito em lote na lista.
12. **Projeto oculto**: só os envolvidos e os administradores do módulo de
    projetos veem. Criar ou alternar exige a permissão de projetos ocultos.
    Documentos de projeto oculto não podem ser compartilhados com o cliente.
13. **Contrato de fee**: no máximo um contrato por projeto, escolhido entre os
    contratos ativos do mesmo cliente. As horas lançadas nos documentos do
    projeto passam a consumir esse contrato.
14. Budget e custo só são visíveis com a permissão de budget de projetos.
15. Favoritar só em projeto aberto. Favorito é por usuário.
16. Só usuários envolvidos podem ser mencionados nos comentários.
17. Toda alteração de campo do projeto entra no **histórico** com valor
    antigo e valor novo.
18. Quando todos os documentos de um projeto aberto estão concluídos, a lista
    sugere arquivá-lo.
19. Os filtros da lista ficam salvos por usuário.
20. Templates: criar um projeto a partir de template gera os jobs e tarefas do
    template. Também dá para salvar um projeto existente como template.
21. Um template também pode ser **aplicado a um projeto existente**: os jobs
    e tarefas do template são inseridos nele.
22. As exportações respeitam as permissões: budget e custo só saem para quem
    tem a permissão de budget; dados do cliente, só para quem pode ver
    clientes.
23. Anexos consomem uma cota de armazenamento da conta, com limite de tamanho
    por arquivo.

---

## 6. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `crm` | Cliente obrigatório, referência ao cadastro de clientes. Cada cliente tem o projeto Geral. |
| `projects` (jobs) | Projeto contém jobs. A numeração do job deriva do número do projeto. Prazos, horas e status dos jobs alimentam os indicadores do projeto. |
| `crm` / comercial (propostas) | Propostas podem ficar dentro do projeto |
| `finance` | Receitas e despesas vinculadas ao projeto. Faturas vinculadas impedem cancelar o projeto. |
| `finance` (contratos de fee) | Um contrato de fee por projeto; as horas do projeto consomem o contrato |
| `timesheet` | Horas lançadas nos documentos alimentam tempo realizado e custo (valor/hora do colaborador) |
| `auth` | Responsável, solicitante, envolvidos, favoritos e permissões |
| Produção e Mídia | Também são documentos do projeto no Operand. No operador, decidir no mapeamento desses menus se viram módulos ou ficam fora da v1. |
| Relatórios | Relatório "horas por cliente e projeto", separando horas normais e de retrabalho |
| `ai` | Ferramentas de leitura sugeridas: resumo do projeto (indicadores, contadores, atrasados), histórico e briefing |

---

## 7. Permissões

O Operand dá a cada usuário um **nível por módulo** e tem perfis prontos
(Atendimento, Criativo, Tráfego, Mídia, Produtor, Financeiro, Administrador,
Total), que podem ser personalizados por usuário. Para projetos existem 4
permissões:

| Permissão | Tipo | Controla |
|---|---|---|
| Projetos | nível (tabela abaixo) | Acesso ao módulo e edição dos projetos |
| Projetos ocultos | liga/desliga | Ver, criar e alternar projetos ocultos |
| Budget de projetos | nenhuma / ver / ver e editar | Budget e custo |
| Contrato de fee em projetos | nenhuma / ver / ver e relacionar | Contrato do projeto |

Níveis de módulo (nomes e descrições oficiais do Operand, lidos da
configuração da conta):
| Nível | Nome | Descrição | Efeito observado em Projetos |
|---|---|---|---|
| 0 | Sem acesso | Sem acesso ao módulo | — |
| 1 | Registros próprios | Cria, lê, altera e remove os registros em que está envolvido | Vê e edita só os projetos em que é envolvido |
| 2 | Leitura total | Lê todos os registros | Somente leitura |
| 3 | Leitura total + registros próprios | Lê todos e altera os registros em que está envolvido | Também pode mudar o status pela lista |
| 6 | Total | Cria, lê e altera qualquer registro | Edita todos, cria templates, desbloqueia projetos do sistema |
| 7 | Administrador | Igual a Total, com poderes de administrador do módulo | Pode editar campos especiais de projetos ocultos dos quais não é responsável |

Regras combinadas:
- Projeto oculto: quem tem nível 1, 3 ou 6 sem a permissão de projetos ocultos
  não edita.
- Campos especiais (ex.: responsável) exigem projeto aberto e:
  - projeto visível: ser o responsável ou ter nível ≥ 6;
  - projeto oculto: ter permissão de ocultos e ser o responsável ou ter nível
    7.

---

## 8. Notas para o operador

- No operador, projeto e job ficam no mesmo módulo `projects`. Os documentos
  de outros módulos (propostas, lançamentos) guardam só o id do projeto e o
  consultam pela interface pública de `projects`.
- **Situação** (aberto/arquivado/cancelado) e **status** (etapa configurável)
  devem ser campos separados.
- O efeito cascata de arquivar/cancelar precisa avisar os outros módulos por
  interface ou evento, sem gravar nas tabelas deles.
- A regra 6 (não cancelar com faturas) exige que `finance` exponha uma
  consulta do tipo "o projeto X tem faturas?".
- Candidatos a simplificar na v1: projeto Geral com bloqueio (pode virar
  "projeto opcional"), exportação detalhada e duplicação assíncrona.

---

## 9. Situação das pendências

Resolvidas pelo MCP `rea` (13/10/2026):
- Modal de **novo projeto**, painéis de **Arquivar, Cancelar, Reabrir,
  Desbloquear, Duplicar e Ocultar**, seletor de **contrato**, modal de
  **usar template** e as **duas exportações**: extraídos dos componentes do
  front (seções 2.2, 2.3 e 2.7).
- Estrutura das abas **Comentários, Anexos e Timesheet**: extraída dos
  componentes (seção 2.3).
- Nomes oficiais dos **níveis de permissão**: lidos da configuração da conta
  (seção 7).
- Projeto **Geral**: encontrado e capturado na tela (seção 2.6).

Ainda não visto **renderizado**:
- O conteúdo acima marcado **(código)**. A ferramenta de navegação interativa
  do MCP (`capture_browser_scenario`) falhou neste ambiente, e clicar em ações
  continua barrado. Para confirmar visualmente, basta abrir a tela na janela do
  Chrome sem salvar, e o MCP lê de forma passiva.
- Abas Comentários, Anexos e Timesheet **com registros reais**: os projetos
  consultados não tinham registros nelas.
