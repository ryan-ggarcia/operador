---
name: mapear-operand
description: Mapear um módulo do Operand (sistema de referência) para docs/operand/, só leitura, usando o MCP rea e a base local C:\Users\Iberika\operand-rea. Usar quando o usuário pedir para mapear, analisar ou extrair telas, campos, regras ou permissões de um módulo do Operand.
---

# Mapear um módulo do Operand

Base local: `C:\Users\Iberika\operand-rea` (leia o `README.md` de lá). Ela tem o front
inteiro do Operand já baixado (`front/`), índices (`indice/`), evidências do `rea`
(`rea/`) e as ferramentas de leitura (`ferramentas/`). Ela fica fora do repositório
de propósito: código do Operand não entra no `operador`.

## Regras

- Só leitura. Nunca criar, editar ou excluir nada no Operand. Enquanto o navegador
  estiver conectado, manter `node ferramentas/guard.js 120` rodando em segundo plano.
- Não clicar em ações (Adicionar, Salvar, Duplicar, Arquivar…): o modo automático
  recusa, e não é necessário. Formulários, modais e confirmações são lidos do código.
- Não copiar código, textos longos, marca nem visual. Não colocar dados reais de
  clientes ou usuários nos documentos.

## Passos

1. **Escopo**: achar as rotas do módulo em `indice/rotas.json` (com permissão e nível
   mínimo) e os modais em `indice/modais.json`.
2. **Tela real (passivo)**: `ferramentas/iniciar-chrome.ps1`; se cair no login, pedir
   ao usuário para entrar na janela. Ler com o `rea` (`list_browser_targets`,
   `inspect_web_page`, `capture_web_screenshot` + `ferramentas/reashot.js`) e com
   `node ferramentas/cdp.js nav|dump|text|shot`. Formato dos dados:
   `node ferramentas/cdp.js apis <url> <ms> <nome>` (só GET; guarda só o formato).
3. **Telas que exigiriam clique**: ler os scripts em `front/app4/js` com
   `ferramentas/labels.js`, `region.js` e `i18n.js` (textos pt-BR resolvidos); para
   fluxo de dados, usar o grafo do `rea` (`import_evidence_bundle` do arquivo em
   `rea/`, ou `analyze_javascript_application` em `front/app4/js`, depois
   `trace_application_feature` / `trace_javascript_semantics`).
4. **Configurações do módulo**: telas legadas em `app3.operand.com.br/configuracao/...`
   (scripts em `front/app3/js`). Endpoints de leitura úteis:
   `/configuracao/permissoes/getLevels` (níveis de permissão).
5. **Documento**: `docs/operand/<modulo>.md`, no formato de `projetos.md` e `jobs.md`
   (conceito, telas, modelo de dados, ciclo de vida, regras, relações, permissões,
   notas para o operador, pendências), marcando o que veio do código com "(código)"
   e deduções com "(inferido)". Atualizar o status no `CLAUDE.md`.
