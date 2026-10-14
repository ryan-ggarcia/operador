import { sanitizeRichText } from './sanitize.js';

describe('sanitizeRichText', () => {
  it('mantém formatação básica e remove script e atributos perigosos', () => {
    const html = '<p onclick="x()">Olá <strong>mundo</strong><script>alert(1)</script></p>';
    expect(sanitizeRichText(html)).toBe('<p>Olá <strong>mundo</strong></p>');
  });

  it('força links seguros e recusa javascript:', () => {
    expect(sanitizeRichText('<a href="https://a.com">a</a>')).toBe(
      '<a href="https://a.com" rel="noopener noreferrer" target="_blank">a</a>',
    );
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a rel="noopener noreferrer" target="_blank">x</a>',
    );
  });

  it('texto vazio vira nulo', () => {
    expect(sanitizeRichText('  <p></p> ')).toBeNull();
    expect(sanitizeRichText('   ')).toBeNull();
    expect(sanitizeRichText(null)).toBeNull();
  });
});
