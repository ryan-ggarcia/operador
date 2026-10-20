# Front do operador, só para o ambiente local (em produção o Netlify faz o build).
#   docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 .
FROM node:26-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend

COPY frontend frontend
# Embutido no build do Next: mudar exige novo build.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace frontend

WORKDIR /app/frontend
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
