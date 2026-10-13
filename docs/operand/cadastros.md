# Operand: módulo Cadastros (mapeamento funcional)

> Referência funcional para os cadastros do operador: clientes e contatos
> (`crm`), colaboradores (`auth`), fornecedores, prestadores e veículos (usados
> por `finance` e pelos módulos de produção e mídia). Descreve **o que** o
> Operand faz, não **como** ele faz: não reproduzir código, textos de
> interface, marca nem visual. Exemplos usam dados fictícios.

| Item | Valor |
|---|---|
| Data do mapeamento | 13/10/2026 |
| Fonte | Menu CADASTROS (Clientes, Colaboradores, Fornecedores, Prestadores de serviço, Veículos) e Configurações › Cadastros |
| Método | Pautas e fichas de cliente e de colaborador vistas na tela (sessão ativa) + respostas de leitura da API. Formulários lidos do front pelo MCP `rea` e da base local `C:\Users\Iberika\operand-rea`. Fichas no front legado (app3). |
| Volume na conta | 78 clientes ativos, 49 colaboradores, 4 funções, nenhum grupo de clientes |

Marcações: **(código)** = extraído do front, sem ver a tela; **(legado)** =
script ou modelo do front antigo; **(inferido)** = dedução.

---

## 1. Conceito

- Existe **um cadastro único de pessoas**. Cada pessoa tem **papéis** que
  podem se acumular: **cliente**, **fornecedor**, **prestador de serviço**,
  **veículo** (de mídia) e **colaborador**.
  - Uma mesma empresa pode ser cliente e fornecedor ao mesmo tempo.
  - A importação avisa quando o CNPJ já existe com outro papel e oferece
    "cadastrar também como…".
- Pessoa é **jurídica (PJ)** ou **física (PF)**. Isso muda os documentos: CNPJ
  e I.E. ou CPF e RG.
- Clientes e fornecedores têm **contatos** (pessoas de contato) organizados por
  **departamento**.
- **Colaborador** é a pessoa da equipe da agência. Pode ter um **usuário** de
  acesso ao sistema e guarda dados de RH: admissão, salário, **valor/hora**,
  função e benefícios. O valor/hora alimenta o custo de projetos e contratos.
- Nada é excluído: os cadastros são **ativados ou desativados** (situação).

---

## 2. Telas

### 2.1 Pautas de cadastro (`/cadastros/<tipo>`) (vista + código)

Uma aba para cada papel: **Clientes**, **Veículos**, **Fornecedores**,
**Prestadores de serviço** e **Colaboradores**.

| Coluna | Tipos |
|---|---|
| Nome (fantasia) | todos |
| CNPJ / CPF | todos |
| Contato (primeiro contato, telefone, e-mail) | clientes, fornecedores, prestadores, veículos |
| Localização (cidade/UF) | todos |
| Situação (ativo/inativo) | todos |
| Usuário (tem acesso?), Função, Aniversário, Tempo de empresa, **Acesso** | colaboradores |

- Busca, ordenação e filtro de **situação** (ativos/inativos).
- **Ações em lote**: ativar e desativar.
- Colaborador sem usuário mostra **"Adicionar acesso"**, que cria o usuário.
  Com usuário ativo, aparece o aviso "este colaborador possui um usuário
  ativo".
- **+ Adicionar** abre o modal do tipo (2.2 ou 2.3).

### 2.2 Novo cliente / fornecedor / prestador / veículo (modal) (código)

| Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|
| Nome fantasia | texto | sim | |
| E-mail | e-mail | não | Formato válido |
| Papéis | marcações: cliente, veículo, fornecedor, prestador | — | Já vem marcado o tipo da aba; pode acumular |
| Tipo de pessoa | PJ / PF | — | |

**Salvar e editar** leva à ficha completa (2.4). Também há **Salvar e
adicionar novo** e **Salvar**.

### 2.3 Novo colaborador (modal) (código)

| Grupo | Campos | Validação |
|---|---|---|
| Identificação | Nome*, PF/PJ, **CPF*** ou **CNPJ*** (valida dígitos), RG ou I.E., razão social | |
| Contato | Telefone(s), e-mail do colaborador | E-mail válido |
| Pessoal | Data de nascimento | |
| Endereço | CEP, logradouro, nº, complemento, bairro, UF, cidade, país | |
| Contrato | Data de admissão, data de demissão, **salário bruto**, **valor total** (custo total), **valor/hora**, **função**, **benefícios** (lista com descrição e valor) | |
| Outros | Link do CV/portfólio | |
| Dados bancários | Banco, tipo de conta, agência, conta, variação/posto, **chaves PIX** (várias, uma padrão) | |
| Observações | texto | |

### 2.4 Ficha do cliente (`/cliente/:id`, front legado) (vista)

1. **Identificação**: avatar, nome fantasia, razão social, CNPJ, endereço
   completo e CEP. Link **Editar informações** (formulário completo, ver 3.1).
2. **Na pauta**: para Propostas, Jobs, Produção e Mídia, a quantidade de
   documentos **não concluídos** e **atrasados** do cliente, com link para a
   pauta filtrada.
3. **Faturamento realizado / previsto** do cliente (gráfico).
4. **Abas**:
   - **Contatos**: lista com enviar e-mail, editar e excluir, e o botão
     **Adicionar contato** (ver 3.2);
   - **Anotações** (registro livre);
   - **Timesheet** (horas apontadas para o cliente);
   - **Anexos**.
5. Botão "+" para criar documentos do cliente (job, proposta etc.).

Fornecedor, prestador e veículo têm fichas equivalentes **(legado)**.

### 2.5 Ficha do colaborador (`/colaborador/:id`, front legado) (vista)

- Nome, CPF, **Editar informações**, **Função**.
- **Informações**: data de aniversário, **vencimento de férias** e **tempo de
  empresa** (anos e meses, calculado pela admissão).
- **Horas do mês**: gráfico mensal de horas do timesheet, com navegação por
  mês ("não há apontamentos realizados neste período").
- Abas: **Anotações**, **Timesheet** e **Anexos**.

### 2.6 Configurações › Cadastros (código)

| Tela | Conteúdo | Exige |
|---|---|---|
| **Departamentos** | Departamentos dos contatos de clientes, fornecedores etc. | — |
| **Grupos de clientes** | Grupos com nome e clientes; usados para filtrar relatórios. Dá para criar, renomear, incluir e remover clientes e excluir. | Clientes nível 6 |
| **Funções** | Funções dos colaboradores (hoje: CEO/Diretor, Mídia, Atendimento, Planejamento). Criar, renomear e excluir; nome único. | Colaboradores nível 6 |
| **Importação de cadastros** | Assistente em 3 passos (ver abaixo) | Cadastros nível 7 |

**Importação**:
1. Baixar os modelos de planilha (um por tipo — clientes, veículos,
   prestadores, fornecedores — e por PF/PJ), sem alterar colunas.
2. Escolher o tipo e PF/PJ e enviar a planilha. Colunas: razão social ou nome
   civil, CPF/CNPJ, RG/I.E., nome fantasia, e-mail, I.M., telefone, CEP,
   endereço, nº, complemento, bairro, UF, cidade, país e site.
3. Revisar numa tabela editável. Linhas com erro mostram o motivo e podem ser
   corrigidas, descartadas ("não cadastrar") ou reenviadas. Registros com CNPJ
   já existente em outro tipo podem ser "cadastrados também como" o novo tipo.
   No fim, mostra o total cadastrado e o total com erro.

Colunas fora do modelo ou em quantidade diferente são recusadas.

### 2.7 Relatórios de cadastros (código)

Pautas de clientes, colaboradores, prestadores, fornecedores e veículos.
Exigem nível 6 no cadastro correspondente.

---

## 3. Modelo de dados observado

### 3.1 Pessoa
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| nome (fantasia) | texto | sim | |
| razão social / nome civil | texto | não | |
| tipo | PJ / PF | sim | |
| CPF ou CNPJ | texto | não (sim para colaborador) | Valida dígitos |
| RG ou I.E., I.M. | texto | não | |
| e-mail, telefone 1, telefone 2, site | texto | não | |
| endereço | CEP, logradouro, nº, complemento, bairro, cidade, UF, país | não | Busca pelo CEP **(inferido)** |
| papéis | cliente, fornecedor, prestador, veículo, colaborador | pelo menos um | Flags acumuláveis |
| grupo de clientes | ref. | não | Só clientes |
| tags | lista | não | Hoje sem uso |
| situação | ativo / inativo | auto | Desativar no lugar de excluir |
| anotações, anexos | | | |

### 3.2 Contato (de cliente/fornecedor)
nome, e-mail, departamento, telefone 1, telefone 2, data de nascimento.

### 3.3 Colaborador (extensão da pessoa)
usuário vinculado (e se é administrador), função, data de admissão, data de
demissão, data de nascimento, vencimento de férias, salário bruto, valor
total, **valor/hora**, benefícios (descrição, valor), link de CV, dados
bancários (banco, tipo, agência, conta, variação, chaves PIX), observações,
cor e avatar (do usuário), situação.

### 3.4 Apoio
departamento (nome); grupo de clientes (nome, clientes); função (nome único).

---

## 4. Regras de negócio

1. Uma pessoa pode ter vários papéis; o mesmo CNPJ não deve virar dois
   cadastros. A importação detecta e oferece acumular o papel.
2. CPF e CNPJ são validados. No colaborador, o documento é obrigatório.
3. Cadastros não são excluídos: são desativados e reativados, também em lote.
4. Ao criar jobs e propostas, só aparecem os **clientes ativos**.
5. Colaborador pode ter um usuário de acesso; criar acesso a partir da pauta.
6. O tempo de empresa é calculado pela data de admissão.
7. Função e grupo de clientes têm nome único; excluir pede confirmação.
8. A importação recusa planilhas fora do modelo e permite corrigir linha a
   linha antes de gravar.

---

## 5. Relações com outros módulos

| Módulo do operador | Relação |
|---|---|
| `crm` | Dono de clientes, contatos, departamentos e grupos de clientes |
| `auth` | Colaborador ↔ usuário; função; equipes; valor/hora (ou em `timesheet`) |
| `projects` | Cliente obrigatório em projeto e job; ficha do cliente mostra jobs abertos e atrasados |
| `finance` | Fornecedores, prestadores e veículos como favorecidos; faturamento do cliente; dados bancários |
| `timesheet` | Horas por cliente (aba da ficha) e por colaborador (gráfico mensal) |
| Mídia e Produção | Veículos (mídia) e fornecedores (produção) |

---

## 6. Permissões

Cada papel tem a sua permissão, com os níveis de
[projetos.md](projetos.md#7-permissões):
- **Clientes**, **Colaboradores**, **Fornecedores**, **Prestadores**,
  **Veículos**;
- Configurações de grupos e funções: nível 6 do papel;
- Importação: nível 7.

---

## 7. Notas para o operador

- Modelar **pessoa + papéis** em vez de tabelas separadas evita CNPJ duplicado
  entre cliente e fornecedor. Porém, a regra de arquitetura do operador exige
  que cada módulo seja dono das suas tabelas. Sugestão: pessoa/cliente/contato
  no `crm`, e colaborador no `auth` (ou num módulo `people`); `finance`
  referencia por id e consulta pela interface pública.
- Dados de RH (salário, benefícios, dados bancários, PIX) são sensíveis:
  restringir por permissão e não enviar ao Claude no módulo `ai`.
- Importação por planilha é útil para a carga inicial (78 clientes, 49
  colaboradores).

---

## 8. Pendências

- Formulário completo de **Editar informações** do cliente/fornecedor (modal
  do legado, só abre com clique). Os campos vieram do modelo de importação e
  do formulário de colaborador.
- Fichas de fornecedor, prestador e veículo não foram vistas na tela.
- Origem do "vencimento de férias" (calculado pela admissão ou informado).
