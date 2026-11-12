import { describe, it, expect } from 'vitest';
import { verifyClaims, normalizeForVerification, Claim } from '../lib/server/verifyCitations';
import { isPrivateOrLocalUrl, cleanArticleHtml } from '../lib/server/briefingAgent';

describe('Phase 5: Citation Verification (Pure Module)', () => {
  it('correctly marks claims with accurate quotes as verified true', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(
      0,
      'The company announced a 30% reduction in carbon emissions across all European manufacturing plants today.'
    );
    articleMap.set(
      1,
      'Officials confirmed that the project will receive fifteen million dollars in municipal funding.'
    );

    const claims: Claim[] = [
      {
        text: 'Emissions were cut by 30% in European facilities.',
        sources: [
          {
            articleIndex: 0,
            quote: '30% reduction in carbon emissions across all European manufacturing plants',
          },
        ],
      },
      {
        text: 'The initiative was granted $15M in funding.',
        sources: [
          {
            articleIndex: 1,
            quote: 'fifteen million dollars in municipal funding',
          },
        ],
      },
      {
        text: 'An unverified claim without quotes in the article text.',
        sources: [
          {
            articleIndex: 0,
            quote: 'completely fabricated statement that is nowhere in the text',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);

    expect(verifiedClaims[0].verified).toBe(true);
    expect(verifiedClaims[1].verified).toBe(true);
    expect(verifiedClaims[2].verified).toBe(false);
    expect(verifiedRatio).toBeCloseTo(2 / 3, 2);
  });

  it('handles case-insensitivity and whitespace normalization in citation quotes', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(0, 'Global   TECH  Stocks  SURGED   sharply on Wednesday morning.');

    const claims: Claim[] = [
      {
        text: 'Tech shares gained value.',
        sources: [
          {
            articleIndex: 0,
            quote: 'global tech stocks surged sharply',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);
    expect(verifiedClaims[0].verified).toBe(true);
    expect(verifiedRatio).toBe(1.0);
  });

  it('marks claims with invalid articleIndex as unverified', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(0, 'Some text here.');

    const claims: Claim[] = [
      {
        text: 'Out of bounds test',
        sources: [
          {
            articleIndex: 99,
            quote: 'Some text',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);
    expect(verifiedClaims[0].verified).toBe(false);
    expect(verifiedRatio).toBe(0);
  });
});

describe('Phase 5: Agent SSRF and HTML Sanitization Guards', () => {
  it('blocks private, link-local, and localhost addresses from being fetched', () => {
    expect(isPrivateOrLocalUrl('http://localhost:3000/secret')).toBe(true);
    expect(isPrivateOrLocalUrl('http://127.0.0.1:8080/data')).toBe(true);
    expect(isPrivateOrLocalUrl('http://10.0.0.1/admin')).toBe(true);
    expect(isPrivateOrLocalUrl('http://192.168.1.50/api')).toBe(true);
    expect(isPrivateOrLocalUrl('http://172.20.0.1/status')).toBe(true);
    expect(isPrivateOrLocalUrl('http://169.254.169.254/latest/meta-data')).toBe(true);
    expect(isPrivateOrLocalUrl('ftp://example.com')).toBe(true);

    // Valid external public addresses should be permitted
    expect(isPrivateOrLocalUrl('https://bbc.com/news/article')).toBe(false);
    expect(isPrivateOrLocalUrl('https://news.ycombinator.com/item')).toBe(false);
  });

  it('strips HTML tags, script elements, and caps text at 8KB', () => {
    const dirtyHtml = `
      <html>
        <head><script>alert('pwned');</script><style>body { color: red; }</style></head>
        <body>
          <h1>Headline</h1>
          <p>Clean paragraph text &amp; facts.</p>
        </body>
      </html>
    `;

    const cleaned = cleanArticleHtml(dirtyHtml);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<style>');
    expect(cleaned).not.toContain('<h1>');
    expect(cleaned).toContain('Headline Clean paragraph text & facts.');
    expect(cleaned.length).toBeLessThanOrEqual(8192);
  });
});

