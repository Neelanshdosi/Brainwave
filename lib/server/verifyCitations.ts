export interface SourceCitation {
  articleIndex: number;
  quote: string;
}

export interface Claim {
  text: string;
  sources: SourceCitation[];
  verified?: boolean;
}

export interface BriefingData {
  headline: string;
  summary: string;
  timeline: string[];
  framing_differences: string;
  claims: Claim[];
  caveats: string[];
  verified_ratio?: number;
}

export function normalizeForVerification(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, '') // remove quote marks
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure function: Verifies that every claim's quote actually appears in that article's text.
 * Checks articleIndex validity and quote matching with normalized whitespace and case.
 */
export function verifyClaims(
  claims: Claim[],
  articlesTextByIndex: Map<number, string>
): { verifiedClaims: Claim[]; verifiedRatio: number } {
  if (!claims || claims.length === 0) {
    return { verifiedClaims: [], verifiedRatio: 0 };
  }

  let verifiedCount = 0;

  const verifiedClaims = claims.map((claim) => {
    if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
      return { ...claim, verified: false };
    }

    let allSourcesVerified = true;

    for (const src of claim.sources) {
      const articleText = articlesTextByIndex.get(src.articleIndex);
      if (!articleText || !src.quote || src.quote.trim().length === 0) {
        allSourcesVerified = false;
        break;
      }

      const normQuote = normalizeForVerification(src.quote);
      const normArticle = normalizeForVerification(articleText);

      // Quote must be substantial and present in article text
      if (normQuote.length < 5 || !normArticle.includes(normQuote)) {
        allSourcesVerified = false;
        break;
      }
    }

    if (allSourcesVerified) {
      verifiedCount++;
    }

    return {
      ...claim,
      verified: allSourcesVerified,
    };
  });

  const verifiedRatio = Number((verifiedCount / claims.length).toFixed(4));
  return { verifiedClaims, verifiedRatio };
}

