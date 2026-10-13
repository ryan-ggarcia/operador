# Operand: módulo Agenda (mapeamento funcional)

> Referência funcional para uma possível **agenda** no operador. Descreve
> **o que** o Operand faz, não **como** ele faz: não reproduzir código, textos
> de interface, marca nem visual.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu AGENDA (calendário), integração com o Google Agenda e notificações da agenda |
| Método | Calendário visto com sessão ativa (só leitura); contagem e formato dos eventos lidos por GET. Modais de evento e de agenda lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea`. |
| Uso na conta | **Baixo**: 1 agenda; 64 eventos em 2024, 2 em 2025 e nenhum em 2026. Nenhum evento recorrente, de dia inteiro ou sincronizado com o Google. |

Marcações: **(código)** = extraído do front, sem ver a tela; **(inferido)** =
dedução.

---

## 1. Conceito

- **Agenda** é um calendário compartilhado da agência para **reuniões e
  eventos**, com convites para colaboradores e para pessoas de fora (por
  e-mail).
- Pode haver **várias agendas** (ex.: uma por área ou sala), cada uma com cor
  própria. Cada agenda pode ser **sincronizada com uma agenda do Google**.
- Não é ligada a jobs nem a projetos: é um módulo à parte.

---

## 2. Telas

### 2.1 Calendário (`/agenda/<ano-mês>`) (vista + código)

- Visões **mês**, **semana** e **dia**; "ir para hoje".
- Lista lateral de **agendas** com cor, para mostrar ou esconder cada uma, e
  as ações **editar/sincronizar**, **desconectar a conta Google** e
  **excluir agenda** (com confirmação).
- Arrastar ou alterar um evento atualiza as datas **(código)**.

### 2.2 Nova agenda / editar agenda (código)

| Campo | Observação |
|---|---|
| Título | Obrigatório **(inferido)** |
| Cor | |
| Sincronizar com o Google | Login com a conta Google e escolha de uma agenda de lá. Depois disso, os eventos são sincronizados. Desconectar mantém os eventos passados. |

### 2.3 Novo evento (modal) (código)

| Campo | Tipo | Observação |
|---|---|---|
| Agenda | seleção | |
| Título | texto | Recusa caracteres inválidos |
| Videoconferência do Google Meet | liga/desliga | Cria a sala automaticamente (precisa da agenda sincronizada) |
| Data | data e hora inicial, data final opcional | Dá para adicionar **várias datas**, que geram vários eventos |
| Lembretes | lista | X minutos, horas ou dias antes, ou na hora do evento; por e-mail, sistema ou ambos. Até 28 dias de antecedência; sem lembrete repetido. |
| Descrição | texto | |
| Convidados | usuários da agência e e-mails externos | |

### 2.4 Evento aberto (código)

- Mesmos campos, editáveis por quem tem acesso.
- **Resposta do convidado**: confirmar, talvez, recusar. O evento mostra
  "recusado" para quem recusou.
- **Cancelar evento** (com confirmação). Evento cancelado continua visível
  como cancelado.
- Usuário sem acesso ao evento vê um aviso.

---

## 3. Modelo de dados observado

| Entidade | Campos |
|---|---|
| Agenda | id, título, cor, responsável, agenda do Google vinculada, conta Google (nome, e-mail, foto), criada por, situação |
| Evento | id, agenda, título, descrição, cor, início, fim, responsável, convidados internos, convidados que recusaram, resposta do usuário, convidados externos (e-mail e resposta), videoconferência, lembretes, situação, sincronizado com o Google |

---

## 4. Regras de negócio

1. Lembrete: até 28 dias antes, sem repetir o mesmo lembrete.
2. Google Meet só com agenda sincronizada com o Google **(inferido)**.
3. Desconectar a conta Google não apaga os eventos passados.
4. Notificações da agenda (alteração de evento, padrão de lembrete) são
   configuradas por usuário (ver
   [configuracoes.md](configuracoes.md#12-notificações-vista)).

---

## 5. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `auth` | Convidados internos; permissão "Agenda" |
| Integrações | Google Agenda e Google Meet |
| Dashboard | Card "Agenda" com os próximos eventos **(inferido)** |

---

## 6. Permissões

- **Agenda** (`calendars`): todos os perfis prontos têm pelo menos
  "registros próprios"; Total e Administrador veem tudo.

---

## 7. Notas para o operador

- Pouco usada e parada desde 2025. A equipe provavelmente usa o Google
  Agenda direto. **Fora da v1**; se precisar, um link para o Google Agenda
  basta.

---

## 8. Pendências

- Modais de agenda e de evento vistos só pelo código.
