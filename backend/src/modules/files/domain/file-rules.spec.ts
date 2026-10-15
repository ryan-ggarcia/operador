import {
  checkUpload,
  contentDisposition,
  fixUploadName,
  formatBytes,
  safeFileName,
  signGrant,
  storageKey,
  verifyGrant,
} from './file-rules.js';

describe('file-rules', () => {
  it('desfaz o nome embaralhado pelo multer e mantém o que já está certo', () => {
    const garbled = Buffer.from('Peça ção.pdf', 'utf8').toString('latin1');
    expect(fixUploadName(garbled)).toBe('Peça ção.pdf');
    expect(fixUploadName('plain.pdf')).toBe('plain.pdf');
    expect(fixUploadName('café')).toBe('café');
  });

  it('gera nome e chave seguros para o storage', () => {
    expect(safeFileName('Peça final (v2).PDF')).toBe('Peca-final-v2.PDF');
    expect(safeFileName('../../etc/passwd')).toBe('etc-passwd');
    expect(safeFileName('***')).toBe('arquivo');
    expect(storageKey({ module: 'projects', type: 'job', id: 'j1' }, 'f1', 'a b.png')).toBe('projects/job/j1/f1-a-b.png');
  });

  it('barra arquivo grande demais e cota esgotada', () => {
    expect(() => checkUpload({ sizes: [], maxFileBytes: 10, usedBytes: 0, quotaBytes: null })).toThrow('pelo menos um');
    expect(() => checkUpload({ sizes: [11], maxFileBytes: 10, usedBytes: 0, quotaBytes: null })).toThrow('no máximo');
    expect(() => checkUpload({ sizes: [5, 5], maxFileBytes: 10, usedBytes: 91, quotaBytes: 100 })).toThrow('esgotado');
    expect(() => checkUpload({ sizes: [5, 4], maxFileBytes: 10, usedBytes: 91, quotaBytes: 100 })).not.toThrow();
    expect(() => checkUpload({ sizes: [10], maxFileBytes: 10, usedBytes: 10 ** 12, quotaBytes: null })).not.toThrow();
  });

  it('formata tamanhos', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(45 * 1024 ** 3)).toBe('45 GB');
  });

  it('assina e confere links do storage local', () => {
    const grant = { key: 'a/b', name: 'x.pdf', mimeType: 'application/pdf', expiresAt: 2000, inline: true };
    const token = signGrant(grant, 'segredo');
    expect(verifyGrant(token, 'segredo', 1000)).toEqual(grant);
    expect(verifyGrant(token, 'segredo', 2001)).toBeNull();
    expect(verifyGrant(token, 'outro', 1000)).toBeNull();
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...grant, key: 'c/d' })).toString('base64url');
    expect(verifyGrant(`${forged}.${signature}`, 'segredo', 1000)).toBeNull();
    expect(verifyGrant(`${payload}`, 'segredo', 1000)).toBeNull();
  });

  it('monta Content-Disposition com nome UTF-8', () => {
    expect(contentDisposition('Peça "1".pdf', false)).toBe(
      `attachment; filename="Peca _1_.pdf"; filename*=UTF-8''Pe%C3%A7a%20%221%22.pdf`,
    );
  });
});
