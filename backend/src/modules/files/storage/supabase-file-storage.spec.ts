import type { ConfigService } from '@nestjs/config';
import { SupabaseFileStorage, type Fetcher } from './supabase-file-storage.js';

const env: Record<string, string> = {
  SUPABASE_URL: 'https://proj.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  SUPABASE_BUCKET: 'anexos',
};
const config = {
  get: (key: string) => env[key],
  getOrThrow: (key: string) => env[key],
} as unknown as ConfigService;

function setup(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    return responses.shift() ?? new Response(null, { status: 200 });
  };
  return { storage: new SupabaseFileStorage(config, fetcher), calls };
}

describe('SupabaseFileStorage', () => {
  it('envia o arquivo para o bucket com a chave de serviço', async () => {
    const { storage, calls } = setup([new Response('{}')]);
    await storage.put('projects/job/1/f-peça.pdf', Buffer.from('x'), 'application/pdf');
    expect(calls[0]!.url).toBe('https://proj.supabase.co/storage/v1/object/anexos/projects/job/1/f-pe%C3%A7a.pdf');
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer service-key');
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['x-upsert']).toBe('false');
  });

  it('gera link assinado, com download pelo nome original', async () => {
    const { storage, calls } = setup([new Response(JSON.stringify({ signedURL: '/object/sign/anexos/a/b.pdf?token=abc' }))]);
    const url = await storage.downloadUrl('a/b.pdf', { fileName: 'Peça.pdf', mimeType: 'application/pdf', expiresInSeconds: 300, inline: false });
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ expiresIn: 300 });
    expect(url).toBe('https://proj.supabase.co/storage/v1/object/sign/anexos/a/b.pdf?token=abc&download=Pe%C3%A7a.pdf');
  });

  it('remove em lote e trata arquivo inexistente na leitura', async () => {
    const { storage, calls } = setup([new Response('[]'), new Response('not found', { status: 400 })]);
    await storage.remove(['a', 'b']);
    expect(calls[0]!.init!.method).toBe('DELETE');
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ prefixes: ['a', 'b'] });
    expect(await storage.get('a')).toBeNull();
  });

  it('falha com a mensagem do Supabase', async () => {
    const { storage } = setup([new Response('Payload too large', { status: 413 })]);
    await expect(storage.put('a', Buffer.from('x'), 'text/plain')).rejects.toThrow('413 Payload too large');
  });
});
