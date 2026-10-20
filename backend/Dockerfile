# API do operador. Build a partir da raiz do repositório (npm workspaces):
#   docker build -f backend/Dockerfile .
FROM node:26-alpine
# O motor de migrações do Prisma precisa do OpenSSL no Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

# O lockfile é da raiz e cita os dois workspaces; só o backend é instalado.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend

COPY backend backend
# O prisma.config.ts lê DATABASE_URL; o generate não conecta, então serve um valor qualquer.
RUN DATABASE_URL=postgresql://build@localhost/build npm run db:generate --workspace backend \
 && npm run build --workspace backend

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3001
# Aplica as migrações pendentes antes de subir.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
