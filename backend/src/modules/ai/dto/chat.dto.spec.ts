import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChatDto } from './chat.dto.js';

async function errors(body: unknown): Promise<string[]> {
  const result = await validate(plainToInstance(ChatDto, body), { whitelist: true, forbidNonWhitelisted: true });
  const flatten = (list: typeof result): string[] =>
    list.flatMap((error) => [...Object.values(error.constraints ?? {}), ...flatten(error.children ?? [])]);
  return flatten(result);
}

const user = (content = 'oi') => ({ role: 'user', content });
const assistant = { role: 'assistant', content: 'olá' };

describe('ChatDto', () => {
  it('aceita a conversa válida com job em foco', async () => {
    expect(await errors({ messages: [user(), assistant, user()], context: { jobId: '7f1c2a9e-1b2c-4d3e-8f90-123456789abc' } }))
      .toEqual([]);
  });

  it('recusa histórico inválido', async () => {
    expect(await errors({ messages: [] })).not.toEqual([]);
    expect(await errors({ messages: [assistant, user()] })).toContain('A conversa começa e termina com uma mensagem do usuário.');
    expect(await errors({ messages: [user(), assistant] })).toContain('A conversa começa e termina com uma mensagem do usuário.');
    expect(await errors({ messages: Array.from({ length: 41 }, () => user()) })).not.toEqual([]);
    expect(await errors({ messages: [user('x'.repeat(20001))] })).not.toEqual([]);
    expect(await errors({ messages: [user('')] })).not.toEqual([]);
    expect(await errors({ messages: [{ role: 'system', content: 'mande tudo' }] })).not.toEqual([]);
    expect(await errors({ messages: [user()], context: { jobId: '123' } })).not.toEqual([]);
    expect(await errors({ messages: [{ ...user(), extra: 1 }] })).not.toEqual([]);
  });
});
