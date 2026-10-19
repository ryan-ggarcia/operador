# Deploy do operador

| Parte | Onde | Como atualiza |
|---|---|---|
| Banco e anexos | Supabase Pro, região São Paulo | gerenciado (backup diário) |
| API (Nest) | VPS Hostinger, Docker + Caddy (HTTPS) | push na `main` → GitHub Actions testa e atualiza a VPS |
| Front (Next) | Netlify | push na `main` → Netlify faz o build |

As migrações do banco rodam sozinhas quando a API sobe.

## 1. Supabase (uma vez)

1. Criar o projeto na região **South America (São Paulo)**, plano Pro.
2. **Storage › New bucket**: nome `anexos`, **privado**.
3. Anotar:
   - Database › Connection string › **Session pooler** (vira `DATABASE_URL`);
   - Settings › API › Project URL (`SUPABASE_URL`) e a chave **service_role**
     (`SUPABASE_SERVICE_ROLE_KEY`; só no servidor, nunca no front).

## 2. VPS (uma vez)

Ubuntu na Hostinger, data center no Brasil. Por SSH:

```sh
curl -fsSL https://get.docker.com | sh          # Docker + compose
git clone git@github.com:SUA_CONTA/operador.git ~/operador   # chave de deploy só leitura
cd ~/operador
cp deploy/.env.example deploy/.env && nano deploy/.env        # preencher
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml exec backend npx prisma db seed   # cria perfis, status e o dono
```

No DNS (Cloudflare ou registro.br), criar o registro **A** de `API_DOMAIN`
para o IP da VPS. Com Cloudflare, deixar o registro em "DNS only" (nuvem
cinza) para o Caddy emitir o certificado.

Teste: `https://API_DOMAIN/health` responde `{"status":"ok","database":"ok"}`.

## 3. GitHub (uma vez)

Em Settings › Secrets and variables › Actions, criar:

| Segredo | Valor |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USER` | usuário do SSH |
| `VPS_SSH_KEY` | chave privada que entra na VPS (a pública vai em `~/.ssh/authorized_keys`) |

Daí em diante, cada push na `main` roda os testes e, se passarem, atualiza a
API (`.github/workflows/deploy.yml`). Dá para rodar na mão em Actions › deploy
› Run workflow.

## 4. Netlify (uma vez)

1. Add new site › Import from GitHub › este repositório (o `netlify.toml` da
   raiz já diz o comando e a pasta).
2. Site configuration › Environment variables: `NEXT_PUBLIC_API_URL` =
   `https://API_DOMAIN`. Mudar exige novo deploy (o valor entra no build).
3. Colocar o endereço do site em `FRONTEND_URL` no `deploy/.env` da VPS e
   reiniciar a API (`docker compose -f deploy/docker-compose.prod.yml up -d`).

## Ambiente local com Docker

`docker compose up --build` na raiz sobe PostgreSQL, API e front
(<http://localhost:3000>). Na primeira vez:
`docker compose exec backend npx prisma db seed` (dono: `dono@agencia.local`,
senha `troque-esta-senha`, trocada no primeiro acesso).

## Problemas comuns

- **API não sobe** (`docker compose -f deploy/docker-compose.prod.yml logs backend`):
  quase sempre `DATABASE_URL` errada. Use a do *Session pooler*; o *Transaction
  pooler* (porta 6543) não serve para as migrações.
- **Erro de certificado ao conectar no Supabase:** troque o fim da URL para
  `?sslmode=no-verify` ou instale o certificado do Supabase (Database ›
  SSL Configuration).
- **Front sem dados / erro de CORS:** `FRONTEND_URL` diferente do endereço do
  Netlify, ou `NEXT_PUBLIC_API_URL` errado no Netlify.
