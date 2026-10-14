import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // O Claude Code usa o CLAUDE.md da raiz; não gerar AGENTS.md aqui.
  agentRules: false,
  experimental: {
    // As telas dependem da sessão guardada no navegador: o layout (app) só
    // renderiza a página no cliente, então não há shell estático para validar.
    // Valida só as rotas que exportarem `instant`.
    instantInsights: { validationLevel: 'manual-warning' },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
