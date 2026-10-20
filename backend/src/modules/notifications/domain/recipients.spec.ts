import { recipients, safeLink } from './recipients.js';

describe('recipients', () => {
  it('tira repetidos, vazios, o autor e quem desligou o evento', () => {
    const preferences = [
      { userId: 'c', event: 'comment.mentioned', inApp: false },
      { userId: 'd', event: 'document.involved', inApp: false },
      { userId: 'e', event: 'comment.mentioned', inApp: true },
    ];
    expect(recipients(['a', 'b', 'a', null, undefined, 'c', 'd', 'e'], 'b', 'comment.mentioned', preferences)).toEqual([
      'a',
      'd',
      'e',
    ]);
  });
});

describe('safeLink', () => {
  it('aceita só caminhos internos', () => {
    expect(safeLink('/jobs/0190-ab')).toBe('/jobs/0190-ab');
    expect(safeLink('/financeiro?mes=2026-10')).toBe('/financeiro?mes=2026-10');
    expect(safeLink('https://fora.com')).toBeNull();
    expect(safeLink('//fora.com/x')).toBeNull();
    expect(safeLink('/jobs/<script>')).toBeNull();
  });
});
