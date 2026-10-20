import sanitizeHtml from 'sanitize-html';

/**
 * Higieniza o texto rico (briefings, comentários, observações) antes de
 * gravar: só formatação básica, links e listas; nada de script, estilo ou
 * imagem embutida.
 */
export function sanitizeRichText(html: string | null | undefined): string | null {
  if (html == null) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'code', 'pre', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['data-mention-id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  }).trim();
  // Editor vazio costuma mandar "<p></p>": sem texto, grava nulo.
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim();
  return text === '' ? null : clean;
}

/** Texto puro do texto rico, com quebra de linha no fim de cada bloco. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|li|h\d|blockquote|pre)>|<br\s*\/?>/gi, '$&\n'), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
