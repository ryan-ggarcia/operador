// Teste de arquitetura do monolito modular (CLAUDE.md, regra 2): um módulo só
// usa outro pela pasta public/ dele. Rodar com `npm run lint:arch`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modulo-so-pela-fachada',
      comment:
        'Um módulo só importa de outro pela pasta public/ dele (fachada e tokens). ' +
        'Repositórios, services e domínio de outro módulo são internos.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/public/'],
      },
    },
    {
      name: 'shared-nao-depende-de-modulo',
      comment: 'src/shared é infraestrutura comum: não conhece os módulos de negócio.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'sem-ciclos-entre-modulos',
      comment: 'Dois módulos não podem depender um do outro (dificulta virar microsserviço).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        circular: true,
        path: '^src/modules/[^/]+/',
        pathNot: '^src/modules/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'src/generated'] },
    exclude: { path: ['src/generated'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
