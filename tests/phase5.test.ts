import { describe, it, expect } from 'vitest';
import { verifyClaims, normalizeForVerification, isEventBriefable, Claim } from '../lib/server/verifyCitations';
import { isPrivateOrLocalUrl, extractArticleBody, cleanArticleHtml } from '../lib/server/briefingAgent';
import { cleanText, decodeHtmlEntities } from '../lib/server/cleanText';

describe('Phase 5: Citation Verification (Pure Module)', () => {
  it('correctly marks claims with accurate quotes (>=40 chars) as verified true', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(
      0,
      'The company announced a 30% reduction in carbon emissions across all European manufacturing plants today.'
    );
    articleMap.set(
      1,
      'Officials confirmed that the project will receive fifteen million dollars in municipal funding from local council.'
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
            quote: 'fifteen million dollars in municipal funding from local council',
          },
        ],
      },
      {
        text: 'An unverified claim without quotes in the article text.',
        sources: [
          {
            articleIndex: 0,
            quote: 'completely fabricated statement that is nowhere in the text of the article',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio, checkableCount } = verifyClaims(claims, articleMap);

    expect(verifiedClaims[0].verified).toBe(true);
    expect(verifiedClaims[0].status).toBe('verified');
    expect(verifiedClaims[1].verified).toBe(true);
    expect(verifiedClaims[1].status).toBe('verified');
    expect(verifiedClaims[2].verified).toBe(false);
    expect(verifiedClaims[2].status).toBe('unverified');
    expect(checkableCount).toBe(3);
    expect(verifiedRatio).toBeCloseTo(2 / 3, 2);
  });

  it('rejects quotes shorter than 40 characters', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(0, 'The quarterly financial report highlighted exceptional revenue growth across all units.');

    const claims: Claim[] = [
      {
        text: 'Revenue grew during the quarter.',
        sources: [
          {
            articleIndex: 0,
            quote: 'exceptional revenue growth', // 26 chars < 40 chars
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio, checkableCount } = verifyClaims(claims, articleMap);

    expect(verifiedClaims[0].verified).toBe(false);
    expect(verifiedClaims[0].status).toBe('unverified');
    expect(verifiedClaims[0].rejectionReason).toContain('shorter than 40 characters');
    expect(checkableCount).toBe(1);
    expect(verifiedRatio).toBe(0);
  });

  it('rejects claims whose text equals its quote after normalization', () => {
    const articleMap = new Map<number, string>();
    const statement = 'The high court ruled that international agreements must be ratified by parliament.';
    articleMap.set(0, statement);

    const claims: Claim[] = [
      {
        // Claim text is identical to quote
        text: 'The high court ruled that international agreements must be ratified by parliament.',
        sources: [
          {
            articleIndex: 0,
            quote: 'the high court ruled that international agreements must be ratified by parliament',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);

    expect(verifiedClaims[0].verified).toBe(false);
    expect(verifiedClaims[0].status).toBe('unverified');
    expect(verifiedClaims[0].rejectionReason).toContain('identical to citation quote');
    expect(verifiedRatio).toBe(0);
  });

  it('rejects quotes that only match the headline or snippet but are NOT in the fetched body text', () => {
    const headline = 'Headline: Major breakthrough in quantum computing announced';
    const fetchedBody =
      'Researchers at the laboratory achieved quantum coherence for over 15 minutes at room temperature under laboratory conditions.';

    // articleMap strictly contains fetched body text
    const articleMap = new Map<number, string>();
    articleMap.set(0, fetchedBody);

    const claims: Claim[] = [
      {
        text: 'A breakthrough was announced today.',
        sources: [
          {
            articleIndex: 0,
            quote: 'Major breakthrough in quantum computing announced today by the research team', // in headline, not in body
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);

    expect(verifiedClaims[0].verified).toBe(false);
    expect(verifiedClaims[0].status).toBe('unverified');
    expect(verifiedClaims[0].rejectionReason).toContain('does not appear in fetched article body text');
    expect(verifiedRatio).toBe(0);
  });

  it('marks claims as "unverified: no full text" when no body was fetched for the cited article', () => {
    const articleMap = new Map<number, string>();
    // Article 0 has body, Article 1 has NO body text fetched
    articleMap.set(
      0,
      'Astronomers observed a supernova explosion occurring approximately 50 million light years away.'
    );

    const claims: Claim[] = [
      {
        text: 'A distant supernova was observed by scientists.',
        sources: [
          {
            articleIndex: 0,
            quote: 'supernova explosion occurring approximately 50 million light years away',
          },
        ],
      },
      {
        text: 'Secondary reporting confirmed the observation details.',
        sources: [
          {
            articleIndex: 1, // NO body text
            quote: 'telescope arrays across three continents coordinated measurements',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio, checkableCount, totalClaims } = verifyClaims(
      claims,
      articleMap
    );

    // Claim 0 is verified
    expect(verifiedClaims[0].verified).toBe(true);
    expect(verifiedClaims[0].status).toBe('verified');

    // Claim 1 cited article 1 which had no body fetched
    expect(verifiedClaims[1].verified).toBe(false);
    expect(verifiedClaims[1].status).toBe('unverified: no full text');
    expect(verifiedClaims[1].rejectionReason).toContain('No full body text fetched');

    // verified_ratio must be computed ONLY over checkable claims (1 checkable claim, which is verified -> 1.0)
    expect(checkableCount).toBe(1);
    expect(totalClaims).toBe(2);
    expect(verifiedRatio).toBe(1.0);
  });

  it('computes verified_ratio strictly as 0 and 0 checkable claims when all bodies are missing', () => {
    const articleMap = new Map<number, string>(); // Empty: no bodies fetched

    const claims: Claim[] = [
      {
        text: 'First uncheckable claim from news snippet.',
        sources: [
          {
            articleIndex: 0,
            quote: 'first uncheckable quote that cannot be validated without full text',
          },
        ],
      },
      {
        text: 'Second uncheckable claim from news snippet.',
        sources: [
          {
            articleIndex: 1,
            quote: 'second uncheckable quote that cannot be validated without full text',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio, checkableCount, totalClaims } = verifyClaims(
      claims,
      articleMap
    );

    expect(checkableCount).toBe(0);
    expect(totalClaims).toBe(2);
    expect(verifiedRatio).toBe(0);
    expect(verifiedClaims.every((c) => c.status === 'unverified: no full text')).toBe(true);
    expect(verifiedClaims.every((c) => c.verified === false)).toBe(true);
  });

  it('handles case-insensitivity and whitespace normalization with quotes >=40 chars', () => {
    const articleMap = new Map<number, string>();
    articleMap.set(0, 'Global   TECH  Stocks  SURGED   sharply on Wednesday morning following earnings.');

    const claims: Claim[] = [
      {
        text: 'Tech shares gained value.',
        sources: [
          {
            articleIndex: 0,
            quote: 'global tech stocks surged sharply on wednesday morning',
          },
        ],
      },
    ];

    const { verifiedClaims, verifiedRatio } = verifyClaims(claims, articleMap);
    expect(verifiedClaims[0].verified).toBe(true);
    expect(verifiedRatio).toBe(1.0);
  });
});

describe('Phase 5: Guardian-Style HTML Cleaning and Entity Decoding (cleanText)', () => {
  it('strips Guardian-style encoded RSS descriptions with ul/li, p, a href, and Continue reading...', () => {
    const guardianXmlDesc = `&lt;p&gt;Ministers are preparing to announce new emergency measures to address water company pollution across the UK.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;&lt;a href=&quot;https://www.theguardian.com/environment/2026/nov/bills&quot;&gt;Water bills set to rise under new proposals&lt;/a&gt;&lt;/li&gt;&lt;li&gt;&lt;a href=&quot;https://www.theguardian.com/environment/2026/nov/fines&quot;&gt;Fines for executives increased&lt;/a&gt;&lt;/li&gt;&lt;/ul&gt;&lt;p&gt;&lt;a href=&quot;https://www.theguardian.com/environment/2026/nov/water-pollution&quot;&gt;Continue reading...&lt;/a&gt;&lt;/p&gt;`;

    const cleaned = cleanText(guardianXmlDesc);

    // Tags should be stripped completely
    expect(cleaned).not.toContain('<p>');
    expect(cleaned).not.toContain('</p>');
    expect(cleaned).not.toContain('<ul>');
    expect(cleaned).not.toContain('<li>');
    expect(cleaned).not.toContain('<a href');
    expect(cleaned).not.toContain('&lt;');
    expect(cleaned).not.toContain('&gt;');
    expect(cleaned).not.toContain('&quot;');

    // "Continue reading..." boilerplate must be removed
    expect(cleaned).not.toContain('Continue reading');

    // Desired textual content is preserved
    expect(cleaned).toContain('Ministers are preparing to announce new emergency measures');
    expect(cleaned).toContain('Water bills set to rise under new proposals');
    expect(cleaned).toContain('Fines for executives increased');
  });

  it('decodes HTML entities including &amp;, &#39;, &quot;, &nbsp;, and numeric entities', () => {
    const raw = `Starmer&#39;s &amp; Reeves&#39; &quot;growth plan&quot; under fire&nbsp;&#8212; economists warn of &#8216;risks&#8217;.`;
    const cleaned = cleanText(raw);

    expect(cleaned).toBe(`Starmer's & Reeves' "growth plan" under fire — economists warn of 'risks'.`);
  });

  it('cleans CDATA wrapped descriptions containing embedded links and ellipses', () => {
    const raw = `<![CDATA[<p>The tech giant reported quarterly earnings beating expectations &amp; forecasts. <a href="https://example.com/read">Continue reading…</a></p>]]>`;
    const cleaned = cleanText(raw);

    expect(cleaned).toBe('The tech giant reported quarterly earnings beating expectations & forecasts.');
    expect(cleaned).not.toContain('Continue reading');
    expect(cleaned).not.toContain('<p>');
  });
});

describe('Phase 5: Agent SSRF, Semantic Extraction, and Content Guards', () => {
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

  it('prefers <article> or <main> over nav, script, style, header, and footer', () => {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script>console.log("analytics tracking code");</script>
          <style>.nav { display: flex; }</style>
        </head>
        <body>
          <header><nav><a href="/">Home</a><a href="/news">News</a></nav></header>
          <aside><p>Sponsored advertisement</p></aside>
          <article>
            <h1>Key Headline Here</h1>
            <p>This is the genuine body of the article containing core journalistic reporting.</p>
            <p>Second paragraph providing factual background and statistics.</p>
          </article>
          <footer><p>Copyright 2026. All rights reserved.</p></footer>
        </body>
      </html>
    `;

    const extracted = extractArticleBody(fullHtml);

    expect(extracted).not.toContain('analytics tracking');
    expect(extracted).not.toContain('Sponsored advertisement');
    expect(extracted).not.toContain('Home News');
    expect(extracted).not.toContain('Copyright 2026');
    expect(extracted).toContain('Key Headline Here');
    expect(extracted).toContain('This is the genuine body of the article');
  });

  it('caps extracted article text at 8KB', () => {
    const longHtml = `<article><p>${'A'.repeat(12000)}</p></article>`;
    const extracted = extractArticleBody(longHtml);
    expect(extracted.length).toBeLessThanOrEqual(8192);
  });
});

describe('Phase 5: Briefable Event Gating & Unavailable Error Handling', () => {
  it('allows briefing when event has at least 2 distinct sources', () => {
    const multiSourceEvent = {
      articles: [
        { source: 'The Guardian', url: 'https://theguardian.com/1' },
        { source: 'BBC News', url: 'https://bbc.com/1' },
      ],
    };

    const result = isEventBriefable(multiSourceEvent);
    expect(result.briefable).toBe(true);
  });

  it('allows briefing for a single-source event if at least one article has body text of 500+ characters', () => {
    const singleSourceWithLongBody = {
      articles: [
        {
          source: 'Hacker News',
          body: 'A'.repeat(520), // 520 chars >= 500 chars
          url: 'https://news.ycombinator.com/item?id=123',
        },
      ],
    };

    const result = isEventBriefable(singleSourceWithLongBody);
    expect(result.briefable).toBe(true);
  });

  it('rejects briefing for a single-source event without 500+ characters body text', () => {
    const singleSourceShort = {
      articles: [
        {
          source: 'Hacker News',
          body: 'Short Ask HN question text',
          description: 'Short Ask HN question text',
          url: 'https://news.ycombinator.com/item?id=123',
        },
      ],
    };

    const result = isEventBriefable(singleSourceShort);
    expect(result.briefable).toBe(false);
    expect(result.reason).toBe('Single source, no full text available');
  });

  it('returns explicit { status: "unavailable", reason } when API key is missing without fabricating content', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;

      const mockEvent: any = {
        id: 'evt-test',
        title: 'Multi-Source Event for Testing',
        category: 'tech',
        articles: [
          { source: 'Source 1', url: 'https://s1.com', title: 'T1' },
          { source: 'Source 2', url: 'https://s2.com', title: 'T2' },
        ],
      };

      const { generateEventBriefing } = await import('../lib/server/briefingAgent');
      const response = await generateEventBriefing(mockEvent);

      expect('status' in response).toBe(true);
      if ('status' in response) {
        expect(response.status).toBe('unavailable');
        expect(response.reason).toContain('GEMINI_API_KEY');
      }
    } finally {
      if (prevKey) {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });
});
