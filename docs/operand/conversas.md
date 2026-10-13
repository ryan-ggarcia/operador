# Operand: módulo Conversas (mapeamento funcional)

> Referência funcional para um possível módulo de **conversas** no operador.
> Descreve **o que** o Operand faz, não **como** ele faz: não reproduzir
> código, textos de interface, marca nem visual.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu CONVERSAS (pauta e conversa aberta) e Configurações › Conversas › Usuários externos |
| Método | Pauta e configuração vistas com sessão ativa (só leitura); formato dos dados lido por GET. Modais de criação e edição lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea`. |
| Uso na conta | **Praticamente nenhum**: 1 conversa em toda a conta (um teste de 2022, já concluída); nenhum usuário externo (5 acessos disponíveis). |

Marcações: **(código)** = extraído do front, sem ver a tela; **(inferido)** =
dedução.

---

## 1. Conceito

- **Conversa** é um tópico de discussão **fora de projetos e jobs**: um título,
  pessoas envolvidas e uma linha de comentários com anexos. Serve para
  alinhar assuntos, pedir algo à equipe ou aprovar layouts com o cliente ou
  fornecedor.
- Pode incluir **usuários externos** (cliente ou fornecedor), com acesso
  limitado às conversas de que participam.
- Tem situação **aberta** ou **concluída**, como os outros documentos.

---

## 2. Telas

### 2.1 Pauta de conversas (`/conversas/minhasconversas`) (vista + código)

- **Colunas**: título, envolvidos, usuários externos e data do último
  comentário.
- Filtros: situação, requisitante, data de criação; "configurar exibição".
- Ações em lote: **concluir** e **reabrir**.
- Lista vazia mostra um convite para criar a primeira conversa.

### 2.2 Nova conversa (modal) (código)

| Campo | Obrigatório | Observação |
|---|---|---|
| Título | sim | Espaços nas pontas são removidos |
| Envolvidos | não | Usuários internos e externos |
| Requisitante | não | Usuário |

Botões: Salvar, Salvar e adicionar novo, Salvar e editar.

### 2.3 Conversa aberta (código)

- Cabeçalho: título (editável), "criado em … por …", **concluir** e
  **reabrir**.
- Envolvidos internos e externos.
- Abas **Comentários** e **Anexos**:
  - comentários com menção a pessoas, anexos e edição;
  - anexo com visualizador (imagem, vídeo), download, **marcadores na
    imagem** e **pedido de aprovação** (aprovar ou reprovar com motivo, prazo
    e usuários que aprovam), igual à aprovação de peças dos jobs (ver
    [jobs.md](jobs.md#24-aprovação-de-arquivos-código)).

### 2.4 Usuários externos (Configurações › Conversas) (vista + código)

- Contador de **acessos externos** (a conta tem 5, nenhum em uso).
- Novo usuário externo: nome, **e-mail profissional** e **usuários
  relacionados** (equipe da agência que fala com ele). Recebe um **convite**
  por e-mail.
- Editar: nome, e-mail, ativar ou desativar o acesso, **redefinir senha por
  e-mail**.
- O e-mail não pode já ter conta no Operand.

---

## 3. Modelo de dados observado

| Entidade | Campos |
|---|---|
| Conversa | id, identificador público (UUID), título, requisitante, envolvidos (usuários), usuários externos, grupo, situação (aberta/concluída), quem mudou a situação, data do último comentário, criada em, alterada em |
| Comentário | conversa, autor, texto com menções, anexos, datas **(inferido, mesmo componente dos jobs)** |
| Anexo | arquivo, autor, data, marcadores, pedido de aprovação (aprovadores, prazo, situação, motivo da reprovação) |
| Usuário externo | nome, e-mail, usuários relacionados, situação, convite pendente |

---

## 4. Regras de negócio

1. Título obrigatório.
2. Usuário externo só vê as conversas em que é envolvido **(inferido)**.
3. Cada usuário externo consome um acesso do pacote; sem acesso livre, não
   dá para convidar.
4. E-mail do usuário externo é único no sistema.
5. Notificações: ser envolvido, reabertura, conclusão de conversa que criei
   (ver [configuracoes.md](configuracoes.md#12-notificações-vista)).

---

## 5. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `auth` | Usuários internos e externos; permissão "Conversas" (perfil "Conversa" só acessa este módulo) |
| `projects` | Mesmo componente de comentários, anexos e aprovação de peças |
| Acesso Cliente | Usuários do cliente também podem participar de conversas |

---

## 6. Permissões

- **Conversas** (`conversations`): níveis de módulo (ver
  [projetos.md](projetos.md#7-permissões)). Na configuração atual, só os
  perfis Administrador, Total e "Conversa" têm acesso.

---

## 7. Notas para o operador

- O módulo não é usado. **Fora da v1.** Se a agência quiser discutir algo fora
  de um job, os comentários do job ou do projeto já cobrem a maior parte.
- Se um dia entrar, reaproveita o componente de comentários e aprovação de
  peças dos jobs.

---

## 8. Pendências

- Tela da conversa aberta vista só pelo código (a única conversa é de teste).
