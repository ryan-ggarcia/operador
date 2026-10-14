import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'segredo-de-teste';
process.env.DATABASE_URL ??= 'postgresql://teste:teste@localhost:5432/teste';

const { AppModule } = await import('../src/app.module.js');
const { configureApp } = await import('../src/main.js');
const { PrismaService } = await import('../src/shared/prisma/prisma.service.js');

/** Sem banco: o PrismaService é trocado por um dublê que falha nas consultas. */
const prismaStub = {
  $queryRaw: () => Promise.reject(new Error('sem banco')),
  $connect: async () => undefined,
  $disconnect: async () => undefined,
  onModuleInit: async () => undefined,
  onModuleDestroy: async () => undefined,
};

describe('App (e2e, sem banco)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde sem login e informa o banco fora do ar', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'down' });
  });

  it('rotas protegidas exigem o token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/parties').expect(401);
  });

  it('login valida o corpo antes de consultar o banco', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nao-e-email', password: '' })
      .expect(400);
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('email')]),
    );
  });

  it('campos desconhecidos são recusados', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana@agencia.com', password: 'x', admin: true })
      .expect(400);
  });
});
