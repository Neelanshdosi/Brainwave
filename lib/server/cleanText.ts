/**
 * Shared text cleaning and HTML sanitization utility.
 * Strips HTML tags, decodes named and numeric HTML entities,
 * removes "Continue reading..." boilerplate, collapses whitespace,
 * and handles nested/encoded markup (e.g. Guardian RSS descriptions).
 */

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    // Standard named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    // Common typography & punctuation entities
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&hellip;/g, '…')
    .replace(/&bull;/g, '•')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    // Hexadecimal numeric entities: &#xNNN;
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    // Decimal numeric entities: &#NNN;
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        const char = String.fromCodePoint(parseInt(dec, 10));
        // Normalize curly quotes from numeric entities to straight quotes
        if (char === '‘' || char === '’') return "'";
        if (char === '“' || char === '”') return '"';
        return char;
      } catch {
        return '';
      }
    });
}

/**
 * Cleans raw text from feeds or article markup:
 * 1. Strips CDATA blocks
 * 2. Removes <script>, <style>, <noscript>, <nav>, <header>, <footer>
 * 3. Removes "Continue reading..." links & anchors
 * 4. Strips HTML tags & decodes entities (with multi-pass for entity-encoded tags)
 * 5. Collapses whitespace & trims
 */
export function cleanText(raw: string = ''): string {
  if (!raw) return '';

  let text = String(raw);

  // 1. Unwrap CDATA
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

  // 2. Remove script, style, and noscript blocks completely
  text = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

  // 3. Remove "Continue reading..." links (both raw HTML <a ...> and entity-encoded &lt;a ...&gt;)
  text = text
    .replace(/<a\b[^>]*>[\s\S]*?continue\s+reading[\s\S]*?<\/a>/gi, ' ')
    .replace(/&lt;a\b[^&]*&gt;[\s\S]*?continue\s+reading[\s\S]*?&lt;\/a&gt;/gi, ' ');

  // 4. Multi-pass tag removal & entity decoding to prevent escaped HTML (e.g. &lt;p&gt;) from surviving
  // Pass A: Strip existing HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Pass B: Decode HTML entities
  text = decodeHtmlEntities(text);

  // Pass C: Strip any tags that were revealed by decoding entities (e.g. &lt;ul&gt;&lt;li&gt;)
  text = text.replace(/<[^>]+>/g, ' ');

  // Pass D: Decode any secondary entities (e.g. double-encoded &amp;quot;)
  text = decodeHtmlEntities(text);

  // Pass E: Strip any residual tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. Remove any leftover standalone "Continue reading..." text or trailing link artifacts
  text = text
    .replace(/continue\s+reading(\.\.\.|…)?/gi, ' ')
    .replace(/\[\s*\.\.\.\s*\]/g, ' ')
    .replace(/\[\s*continue\s+reading\s*\]/gi, ' ');

  // 6. Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}
