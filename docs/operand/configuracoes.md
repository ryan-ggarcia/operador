# Operand: Configurações gerais (mapeamento funcional)

> Referência funcional para as configurações do operador: perfil do usuário,
> notificações, dados da agência, usuários e permissões, equipes, módulos,
> integrações, acesso do cliente e preferências gerais. Descreve **o que** o
> Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual. Não há nomes nem e-mails reais aqui.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu CONFIGURAÇÕES (Meu Plano, Meu Perfil, Empresas, Usuários e Permissões, Acesso Cliente, Equipes, Módulos e Funções, Integrações, Webhooks, Geral) |
| Método | Telas vistas com sessão ativa (só leitura) e leituras GET das definições de perfis e níveis de permissão. Formulários e telas que exigem clique lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea` (app4 e legado app3). |
| Situação na conta | 1 empresa; **38 usuários ativos** (todas as 38 licenças em uso) e 57 inativos; 1 equipe ("Mídia", 25 usuários); 1 jornada de trabalho; nenhum webhook; Acesso Cliente, CENP-Meios, API e Timesheet Automático **desligados**. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(legado)** =
script do front antigo; **(inferido)** = dedução.

As configurações **por módulo** (Projetos, Jobs, Propostas, Produção, Mídia,
Financeiro, Cadastros) estão nos documentos de cada módulo. Conversas e Agenda
ainda não foram mapeados.

---

## 1. Telas

### 1.1 Meu perfil (vista + legado)

| Item | Conteúdo |
|---|---|
| Foto | PNG, JPG ou GIF, até 1 MB |
| Dados | Nome, e-mail de acesso, nome de usuário |
| Senha | Alterar senha; **redefinir senha por e-mail** |
| Cor do sistema | Tema de cores da interface |
| **Assinatura de documentos** | Imagem da assinatura do usuário, usada nos PDFs (propostas, EC/PP de produção, PI de mídia) com a opção "assinatura digitalizada". Tamanho mínimo em pixels. |
| Notificações | Ver 1.2 |
| Permissões | Só leitura: perfil de acesso e nível em cada módulo |

Há também a confirmação de e-mail da conta: aviso para confirmar o e-mail,
reenviar o link ou trocar o e-mail.

### 1.2 Notificações (vista)

Cada item pode ser ligado ou desligado em dois canais: **no sistema** e **por
e-mail**.

| Grupo | Eventos |
|---|---|
| Agenda | Alterações em eventos; padrão de notificação dos eventos; tempo padrão do lembrete (5, 10 ou 15 min, 1 h, 1 dia) |
| Comentários | Quando fui mencionado; quando comentam em projeto ou documento de que sou responsável; quando mencionam "todos os envolvidos" |
| Aprovação de peças | Quando sou envolvido numa aprovação; quando a peça é aprovada; quando é reprovada |
| Projetos, documentos e conversas | Quando sou envolvido; quando reabrem algo em que estou envolvido; quando concluem algo de que sou responsável (ou conversa que criei); quando tarefas bloqueadas de que sou responsável são liberadas; quando todas as tarefas de um job meu são concluídas; quando sou mencionado no briefing |
| Financeiro | Nova anotação em fatura; envio ou reabertura de faturamento de documento; criar, quitar, cancelar ou reabrir fatura; edição de fatura quitada |

### 1.3 Empresas (vista + legado)

São as **empresas emissoras da agência** (CNPJs que aparecem em documentos e
faturas), não clientes. A conta tem uma.

- Lista: nome fantasia, **padrão** (sim/não) e situação (ativa/inativa).
- Formulário:

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| Tipo de pessoa | PJ / PF | sim | Muda os rótulos dos documentos |
| Nome fantasia | texto | sim | Único entre as empresas |
| Razão social / nome civil | texto | | |
| CNPJ / CPF | texto com máscara | | Dígitos válidos |
| Inscrição estadual / RG, inscrição municipal | texto | | |
| E-mail, telefone | texto | | E-mail válido |
| Endereço | CEP (preenche o resto), logradouro, nº, complemento, bairro, cidade, UF, país | | |
| Logo | imagem | | Usada nos PDFs |

- Regras: só uma empresa **padrão**; a padrão **não pode ser desativada**.
  Empresas são ativadas e desativadas, não excluídas.

### 1.4 Usuários e permissões (vista + legado)

- Topo: licenças disponíveis e total do plano. Sem licença livre, não dá para
  criar nem reativar usuário.
- Lista de usuários **ativos** e, separada, de **inativos**: nome, e-mail,
  perfil de acesso; filtro por equipe. O dono da conta aparece como
  "responsável da conta".
- **Novo usuário**: só para quem já está cadastrado como **colaborador**
  (dá para criar o colaborador ali mesmo).

| Campo | Obrigatório | Observação |
|---|---|---|
| Colaborador | sim | Seleção entre os colaboradores |
| E-mail de acesso | sim | Único no sistema |
| Perfil de acesso inicial | sim | Um dos perfis da tabela abaixo |
| Jornada de trabalho | sim | Vem com a jornada padrão |
| Equipes | não | Várias |

  Ao salvar, o usuário recebe um e-mail com as instruções de acesso.
- **Editar usuário**:
  - trocar o perfil ou personalizar o nível de cada módulo (vira
    "Personalizado");
  - permissões extras: projetos ocultos, budget de projetos, contrato de fee
    em projetos, financeiro por tipo (receitas, despesas, transferências);
  - jornada e equipes; redefinir senha por e-mail; excluir a foto;
  - **ativar/desativar o acesso**. Usuário não é excluído.
  - Precisa de acesso a pelo menos um módulo.
- Ação em massa: excluir as fotos de todos os inativos.

**Níveis por módulo**: Sem acesso (0), Registros próprios (1), Leitura total
(2), Leitura total + registros próprios (3), Total (6) e Administrador (7).
Significado em [projetos.md](projetos.md#7-permissões).

**Perfis prontos** (definição atual da conta):

| Módulo | Atendimento | Criativo | Tráfego | Mídia | Produtor | Financeiro | Administrador | Total | Conversa |
|---|---|---|---|---|---|---|---|---|---|
| Propostas | 3 | 0 | 0 | 0 | 0 | 2 | 7 | 6 | 0 |
| Contratos de fee | 3 | 0 | 0 | 0 | 0 | 2 | 7 | 6 | 0 |
| Projetos | 6 | 0 | 6 | 0 | 0 | 0 | 7 | 6 | 0 |
| Budget de projetos | ver e editar | — | ver e editar | — | — | — | ver e editar | ver e editar | — |
| Contrato de fee em projetos | sim | — | sim | — | — | — | sim | sim | — |
| Projetos ocultos | — | — | — | — | — | — | sim | — | — |
| Jobs, Produção, Mídia | 3 | 3 | 6 | 3 | 3 | 2 | 7 | 6 | 0 |
| Financeiro | 1 | 0 | 0 | 1 | 1 | 6 | 7 | 6 | 0 |
| Receitas, despesas, transferências | sim | — | — | sim | sim | sim | sim | sim | — |
| Clientes | 6 | 0 | 6 | 6 | 6 | 6 | 7 | 6 | 0 |
| Fornecedores | 6 | 0 | 2 | 0 | 6 | 6 | 7 | 6 | 0 |
| Veículos | 6 | 0 | 2 | 6 | 0 | 6 | 7 | 6 | 0 |
| Prestadores | 0 | 0 | 0 | 0 | 0 | 6 | 7 | 6 | 0 |
| Colaboradores | 0 | 0 | 0 | 0 | 0 | 6 | 7 | 6 | 0 |
| Conversas | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 6 | 1 |
| Agenda | 1 | 1 | 1 | 1 | 1 | 1 | 7 | 6 | 0 |

**Uso na conta** (38 ativos): Total 19, Criativo 11, Administrador 4,
Atendimento 2, Mídia 1, Produtor 1.

### 1.5 Equipes (vista + legado)

- Lista de equipes com a quantidade de usuários; expandir mostra os membros.
- Criar e renomear equipe (nome obrigatório); incluir e remover usuários.
- Usos: filtro de usuários, filtros de pautas e relatórios, custo médio por
  equipe nos contratos de fee (ver [propostas.md](propostas.md)).

### 1.6 Módulos e funções (vista + legado)

Liga e desliga módulos e funções extras. Desligar um módulo com integração
ativa exige desligar a integração antes.

| Módulo / função | Na conta |
|---|---|
| Propostas, Produção, Mídia, Financeiro, Agenda | ligados |
| Pauta Timeline (linha do tempo da pauta de jobs) | ligada |
| Conversas | ligada |
| CENP-Meios | desligado |
| Acesso Cliente | desligado |

Outras opções da conta (lidas da configuração): **Timesheet Automático**
(desligado), **timesheet em todos os módulos** (desligado: só se aponta horas
em jobs), **encargos na produção** (desligado), API pública (desligada).

### 1.7 Integrações e webhooks (vista + código)

| Integração | O que faz |
|---|---|
| Hype Social | Ferramenta de gestão de redes sociais (conectar/desconectar) |
| **MCP** | "Conectar o Operand a qualquer IA" por token (gerar, ver, revogar). Exige contratar a API do Operand; não aparece nesta conta. |
| API Operand | Token de acesso à API pública (gerar novo token invalida o anterior; inativar) |
| Boleto bancário e NFS-e | Ver [financeiro.md](financeiro.md) |
| Google Agenda | Sincroniza a Agenda |
| CENP-Meios | Ver [midia.md](midia.md) |

**Webhooks** (só administrador):
- Campos: título*, URL* (http/https, única), situação (ativo/inativo) e um
  **hash** de assinatura, que pode ser copiado.
- Eventos: projeto, job e tarefa **criado**, **alterado** e **excluído**.
- Um webhook que falha repetidas vezes é desativado sozinho, e o sistema
  avisa.
- Hoje não há nenhum.

### 1.8 Acesso Cliente (código; desligado na conta)

Portal para o **cliente** acompanhar e pedir jobs.

- **Ativar** o módulo e, para cada cliente, um assistente:
  1. **Cliente** que terá acesso (um perfil por cliente; o cliente precisa
     estar ativo).
  2. **Usuários do cliente**: nome e e-mail corporativo. Cada um recebe um
     convite por e-mail (pendente até aceitar). Usuário externo **consome
     licença**. E-mail não pode repetir.
  3. **Equipe de atendimento**: usuários da agência ligados ao cliente e o
     **responsável padrão** dos jobs que o cliente abrir. Pelo menos um.
  4. **O que o cliente pode ver e fazer**:

| Item | Opções |
|---|---|
| Jobs | Criar/editar (abrir pedido, sugerir prazo) ou só visualizar |
| Tarefas, responsáveis, prazos, status, timesheet | Só visualizar, cada um ligado ou não |
| Briefing | Criar/editar ou visualizar |
| Anexos e aprovações | Ver, enviar e baixar; o cliente só exclui o que ele enviou; pedir aprovação |
| Comentários | Todos os comentários do job, ou só aqueles em que foi mencionado |
| Conversas | Participar de conversas |

- Pauta de acessos: busca por cliente, usuários de cada perfil, situação,
  **reenviar convite**, ativar e inativar usuário ou perfil.
- **Visão do cliente** ("Minha pauta"): jobs compartilhados com ele, com
  título, prazo, projeto, status (os status do Acesso Cliente), data de
  criação, data do último comentário, envolvidos e requisitante. O cliente
  pode abrir job (título, responsável, prazo, briefing) e cancelar um job que
  ele criou.
- A agência escolhe, no job, o que compartilhar (ver
  [jobs.md](jobs.md)); job de projeto oculto não pode ser compartilhado.
- Briefings predefinidos para o cliente preencher ao pedir job.

### 1.9 Geral (vista + legado)

| Seção | Conteúdo |
|---|---|
| **Timesheet** | Alerta ao concluir tarefa sem apontamento: pede confirmação, mas não bloqueia (desligado na conta). Regras do Timesheet Automático. |
| **Jornada de trabalho** | Ver [timesheet.md](timesheet.md). Na conta: uma jornada padrão de 42h30 por semana, 170 h por mês, meta produtiva de 8h30 por dia, 38 usuários. |
| **Localização, moeda e idioma** | País, fuso horário, moeda e idioma; usados pelo Timesheet Automático e pela Agenda |
| **Configurações da conta** | Transferir a propriedade da conta para outro usuário (pede senha); trocar o tipo da conta entre "agência" e "marketing interno", o que muda os recursos. A conta é do tipo agência. |
| **Backup** | Pedir um backup completo; ele é gerado em segundo plano e avisado por e-mail. Um pedido por vez. |
| Limpar dados de navegação | Limpa o cache do sistema no navegador |
| Excluir dados | Apaga todos os dados para recomeçar; bloqueado em contas com mais de 90 dias de uso ou mais de 1 GB |

### 1.10 Meu plano (vista)

Assinatura do Operand: plano, licenças (38), espaço para anexos (45 GB),
cobrança, renovação, forma de pagamento, faturas e chamados. Só o dono da
conta acessa. **Não se aplica ao operador**, que não é SaaS.

---

## 2. Modelo de dados observado

| Entidade | Campos |
|---|---|
| Usuário | colaborador (ref.), e-mail de acesso, senha, perfil de acesso (ref.) ou personalizado, níveis por módulo (JSON), permissões extras, jornada (ref.), equipes, cor, foto, assinatura, situação, dono da conta (sim/não), tipo (interno ou externo/cliente) |
| Perfil de acesso | nome, níveis por módulo |
| Preferência de notificação | usuário, evento, no sistema (sim/não), por e-mail (sim/não), tempo do lembrete |
| Empresa | PJ/PF, nome fantasia (único), razão social, documentos, contato, endereço, logo, padrão, situação |
| Equipe | nome, usuários |
| Webhook | título, URL (única), hash, eventos, situação, tentativas com falha |
| Perfil de acesso do cliente | cliente (único), permissões (jobs, tarefas, briefing, anexos, comentários, conversas), usuários da agência, responsável padrão, situação |
| Usuário externo | nome, e-mail, perfil do cliente (ref.), convite pendente, situação |
| Configuração da conta | módulos ligados, tipo da conta, país, fuso, moeda, idioma, alerta de timesheet |

---

## 3. Regras de negócio

1. Todo usuário é um colaborador. O e-mail de acesso é único.
2. O usuário precisa de acesso a pelo menos um módulo.
3. Usuários são desativados, não excluídos. No Operand, criar e reativar
   depende de licença livre.
4. Só uma empresa padrão, e ela não pode ser desativada.
5. Mudar o usuário de jornada vale a partir do dia seguinte.
6. Um perfil de Acesso Cliente por cliente; o cliente precisa estar ativo, e o
   perfil precisa de pelo menos um usuário da agência.
7. Webhook: URL única, http/https; é desativado sozinho depois de muitas
   falhas.
8. Desligar um módulo com integração ativa exige desligar a integração antes.

---

## 4. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `auth` | Usuários, perfis e níveis por módulo, equipes, senha, notificações |
| `crm` / cadastros | Usuário ligado ao colaborador; perfis de Acesso Cliente ligados a clientes |
| `timesheet` | Jornada por usuário, alerta de tarefa sem apontamento, Timesheet Automático |
| `projects` | Notificações; webhooks de projeto, job e tarefa; compartilhamento com o cliente |
| `finance` | Empresas emissoras; permissões de receitas, despesas e transferências |
| PDFs (propostas, produção, mídia) | Logo e dados da empresa; assinatura do usuário |
| `ai` | O próprio Operand já oferece um conector MCP pago; no operador, o módulo `ai` cumpre esse papel |

---

## 5. Permissões

| Tela | Quem acessa |
|---|---|
| Meu plano | Dono da conta |
| Usuários e permissões, Acesso Cliente, Jornada, Webhooks | Administrador |
| Meu perfil, notificações | Cada usuário |
| Integrações | Todos veem; conectar depende da integração |

---

## 6. Notas para o operador

- **Permissões**: o modelo de nível por módulo (0, 1, 2, 3, 6, 7) com perfis
  prontos funciona e é conhecido pela equipe. Sugestão para o `auth`:
  - perfis com níveis por módulo, com personalização por usuário;
  - flags extras (projetos ocultos, budget, financeiro por tipo);
  - simplificar os níveis para nenhum, próprios, leitura, leitura + próprios,
    total e administrador.
- **Empresa**: o operador é de uma agência só. Em vez de "Empresas", basta uma
  tela de **dados da agência** (razão social, CNPJ, endereço, logo) usada nos
  PDFs. Se a agência faturar por mais de um CNPJ, aí vale a lista.
- **Usuários**: 38 ativos hoje. Sem licenças no operador, mas convém manter
  "desativar em vez de excluir".
- **Notificações**: começar pelas principais no sistema e por e-mail
  (menção, envolvido, aprovação de peça, conclusão). O resto pode vir depois.
- **Webhooks e API**: não são usados; ficam fora da v1.
- **Acesso Cliente**: desligado, mas a ideia (cliente abre jobs e aprova
  peças) pode valer numa versão futura.
- **Backup**: no operador, o backup diário do Supabase cobre isso. Uma
  exportação sob demanda pode vir depois.
- **MCP**: o Operand vende uma integração com IA por MCP. Isso confirma o
  valor do módulo `ai` do operador, que já faz parte do produto.

---

## 7. Pendências

- Tela de edição de um usuário (nível por módulo e permissões extras) vista só
  pelo código; o formato dos níveis veio da leitura das definições dos perfis.
- Seções de Geral que abrem com clique (Timesheet, Localização, Conta) vistas
  só pelo código.
- Telas do Acesso Cliente vistas só pelo código (módulo desligado).
- Conversas (incluindo usuários externos) e Agenda: ainda não mapeados.
