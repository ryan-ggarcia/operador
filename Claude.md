# Projeto: operador

Este arquivo é o contexto de trabalho do projeto. O Claude Code é o único
agente usado neste repositório. O usuário escreve em português, então responda
em português.

---

## Parte 1 — Stack e arquitetura do aplicativo

### Stack
- **Back-end:** Nest.js (TypeScript)
- **Front-end:** Next.js com TypeScript (componentes `.tsx`)
- **Runtime:** Node v26.10.0, npm 11.19.1

### Regras de arquitetura (obrigatórias)
1. **Front e back separados.** Cada um tem sua própria pasta, com
   `package.json`, dependências e configuração próprios. O front nunca importa
   código do back, e vice-versa: os dois se comunicam só por HTTP/API.
2. **Monolito modular no back-end.** O back-end é uma única aplicação Nest.js,
   dividida em módulos de negócio isolados:
   - Cada módulo é dono das suas tabelas (um schema PostgreSQL por módulo).
     Nenhum módulo lê ou grava tabelas de outro.
   - Um módulo só usa outro pela interface pública que ele exporta (um
     service de fachada definido por interface), nunca importando arquivos
     internos dele.
   - Objetivo: qualquer módulo poder virar um microsserviço no futuro sem
     reescrever o resto.
3. **Princípios SOLID** em todo o código:
   - **S (responsabilidade única):** controllers só tratam HTTP, services
     contêm regra de negócio, repositories cuidam do acesso a dados.
   - **O (aberto/fechado):** estenda o comportamento com novas implementações
     de interfaces, em vez de alterar código que já funciona.
   - **L (substituição de Liskov):** qualquer implementação de uma interface
     deve funcionar no lugar de outra sem quebrar quem a usa.
   - **I (segregação de interfaces):** prefira interfaces pequenas e
     específicas a uma interface grande e genérica.
   - **D (inversão de dependência):** dependa de abstrações. No Nest, injete
     dependências por interface/token via injeção de dependência, nunca
     instanciando classes concretas com `new` dentro de outra classe. No
     front, isole o acesso à API em uma camada de serviços, em vez de chamar
     `fetch` direto nos componentes.

### O produto
O "operador" é um sucessor do Operand: um sistema de gestão para agências de
comunicação e publicidade, feito **sob medida para a agência do usuário**
(uma empresa só, não é SaaS). O usuário cadastra os dados da agência ele mesmo.

A única funcionalidade nova em relação ao Operand é a **integração com o
Claude**: analisar jobs, relatórios e os demais dados do sistema.

### Decisões tomadas
| Tema | Decisão |
|---|---|
| Arquitetura | Monolito modular (trocado de microsserviços a pedido do usuário) |
| Modelo de uso | Uma agência só (trocado de SaaS a pedido do usuário): sem `tenantId` nem cadastro de empresas |
| Banco de dados | Um PostgreSQL, com um schema por módulo |
| ORM | Prisma |
| Autenticação | E-mail e senha, com token JWT |
| Front → back | HTTP/REST |
| Visual do front | Tailwind CSS + shadcn/ui |
| Pacotes | npm, um `package.json` no front e outro no back |
| Infra local | Docker Compose sobe o PostgreSQL, o back e o front |
| IA | Claude API pelo SDK oficial `@anthropic-ai/sdk`, modelo `claude-opus-5-5` |
| Testes | Escritos desde o início, junto com o código: unitários das regras de negócio com Jest (padrão do Nest) |

### Módulos (primeira versão)
| Módulo | Responsabilidade |
|---|---|
| `auth` | Usuários da agência, perfis de acesso, login e emissão de JWT |
| `projects` | Projetos, jobs, tarefas, prazos e aprovações |
| `timesheet` | Horas trabalhadas por pessoa, job e cliente |
| `finance` | Orçamentos, contas a pagar e receber, faturamento e fluxo de caixa |
| `crm` | Clientes, contatos, oportunidades e propostas comerciais |
| `ai` | Integração com o Claude: análise de jobs, relatórios e dados dos outros módulos |

A lista pode mudar depois do mapeamento do Operand.

### Estrutura de pastas
```
operador/
├── docker-compose.yml
├── docs/operand/        # mapeamento funcional do Operand, um arquivo por módulo
├── frontend/            # Next.js (TypeScript, .tsx), Tailwind + shadcn/ui
└── backend/             # um app Nest.js
    ├── prisma/          # schema do Prisma, um schema PostgreSQL por módulo
    └── src/
        ├── shared/      # autenticação JWT, utilitários
        └── modules/
            ├── auth/
            ├── projects/
            ├── timesheet/
            ├── finance/
            ├── crm/
            └── ai/
```

### Módulo `ai` (integração com o Claude)
- Chama a Claude API com o SDK oficial `@anthropic-ai/sdk`; modelo padrão
  `claude-opus-5-5`.
- O Claude acessa os dados por **ferramentas (tool use)** que chamam as
  interfaces públicas dos outros módulos (ex.: buscar job, listar horas de um
  job, resumo financeiro). Nunca acessa o banco diretamente, e as ferramentas
  são só de leitura.
- Respostas longas usam streaming até o front.
- A chave `ANTHROPIC_API_KEY` fica só no back-end, em variável de ambiente.
- Os dados enviados para análise saem da infraestrutura da agência e vão para
  a Anthropic; enviar só o necessário para cada pergunta.

### Deploy
Objetivo do usuário: custo baixo sem dor de cabeça com manutenção. Hoje o
Operand custa cerca de R$ 2.000/mês, e a meta é reduzir esse valor.

| Parte | Onde |
|---|---|
| Front-end | Netlify (plano gratuito; deploy automático pelo GitHub) |
| Back-end | VPS da Hostinger com Docker, data center no Brasil |
| Banco | Supabase Pro (PostgreSQL gerenciado com backup diário), região São Paulo |
| DNS | Cloudflare (plano gratuito), opcional |

- Custo estimado: R$ 250 a 550/mês no total (VPS R$ 40–80, Supabase Pro
  cerca de US$ 25, Claude API R$ 50–300 conforme o uso, domínio cerca de
  R$ 4). Valores aproximados, a confirmar na contratação.
- Descartados: Cloudflare para o back-end (Nest.js + Prisma não rodam bem em
  Cloudflare Workers) e o banco MySQL remoto que o usuário já tem.
- Evitar hospedagem compartilhada; o back precisa de VPS.
- O deploy do back deve ser automatizado (GitHub → VPS) e documentado, para o
  usuário não precisar mexer no servidor.

### Mapeamento do Operand
O usuário quer o esqueleto completo do sistema, com regras de negócio, telas,
campos e fluxos, usando o Operand como referência. Os dados da agência serão
cadastrados pelo próprio usuário; não é preciso extrair nem migrar dados.
- **Como:** navegar pelo Operand no Chrome do usuário (extensão Claude in
  Chrome, com o login dele), um módulo por vez.
- **Saída:** um arquivo por módulo em `docs/operand/`, com telas, campos (nome,
  tipo, obrigatoriedade, validações), fluxos, regras de negócio, relações com
  outros módulos e permissões.
- **Limite:** usar o Operand só como referência funcional. Não copiar código,
  textos, marca, logos nem visual; o "operador" tem implementação e identidade
  próprias.
- **Cuidado:** só ler. Nunca criar, editar ou excluir nada no Operand, e não
  colocar nos documentos dados reais de clientes da agência.

### Status e próximos passos
1. **Agora:** o usuário vai instalar a extensão Claude in Chrome. Ao retomar,
   verificar se as ferramentas do Chrome estão disponíveis na sessão; se não
   estiverem, pedir para reiniciar o Claude Code.
2. Perguntar por qual módulo do Operand começar e mapear um módulo por vez em
   `docs/operand/`.
3. Depois do mapeamento, revisar a lista de módulos e modelar o banco.
4. Só então criar o esqueleto do código (`frontend/`, `backend/`,
   `docker-compose.yml`).
5. Ainda não há código do aplicativo. O repositório tem só `README.md`,
   `.gitignore` e este arquivo, nada commitado além do commit inicial.

---

## Parte 2 — Handoff: instalação do REA

### O que é
O REA (https://github.com/morluto/rea) é um servidor MCP de engenharia reversa
(pacote npm `rea-agents`, comando `rea`). Ele analisa localmente binários
nativos, apps JavaScript/Electron, assemblies .NET, sites, firmware e apps
Android (via ADB). Os resultados vêm com evidências e limitações. Não faz
parte do código do aplicativo: é uma ferramenta do agente.

### Estado atual
- O REA 6.4.0 está instalado globalmente (`npm install --global rea-agents`).
- MCP `rea` registrado só no Claude Code, em `C:\Users\Iberika\.claude.json`
  (backup em `.claude.json.rea.backup`), apontando para a instalação global.
  Para reconfigurar: `rea setup --client claude_code --yes` (com sublinhado;
  `--all-detected` recriaria registros para outros agentes).
- Skill `reverse-engineer-anything` instalada em `C:\Users\Iberika\.claude\skills`.
- O MCP `rea` conecta no Claude Code e expõe mais de 150 ferramentas (ex.:
  analyze_javascript_application, open_binary, binary_overview,
  inspect_managed_artifact, analyze_web_bundle, compare_application_versions).
- Os registros que o setup criou para outros agentes (Gemini CLI, Copilot CLI
  e o `mcp.json` do VS Code) foram removidos. Ainda resta uma cópia da skill em
  `C:\Users\Iberika\.agents\skills\reverse-engineer-anything`, que não é usada.
- A instalação local antiga foi removida do repositório.
