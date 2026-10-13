// Configuração do Prisma CLI. O schema fica dividido em um arquivo por módulo
// em prisma/schema/ (ver docs/modelo-de-dados.md).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
