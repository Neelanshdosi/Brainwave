export interface SourceCitation {
  articleIndex: number;
  quote: string;
}

export type ClaimVerificationStatus =
  | 'verified'
  | 'unverified'
  | 'unverified: no full text';

export interface Claim {
  text: string;
  sources: SourceCitation[];
  verified?: boolean;
  status?: ClaimVerificationStatus;
  rejectionReason?: string;
}

export interface BriefingData {
  headline: string;
  summary: string;
  timeline: string[];
  framing_differences: string;
  claims: Claim[];
  caveats: string[];
  verified_ratio?: number;
  checkable_claims?: number;
  total_claims?: number;
}

export interface VerifyClaimsResult {
  verifiedClaims: Claim[];
  verifiedRatio: number;
  checkableCount: number;
  totalClaims: number;
  verifiedCount: number;
}

export function normalizeForVerification(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[“”"'‘’]/g, '') // remove quote marks
    .replace(/[.,;:!?()[\]{}]/g, ' ') // normalize sentence & phrase punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether an event is eligible for briefing generation.
 * An event is "briefable" ONLY if:
 * 1. It has at least 2 distinct sources, OR
 * 2. It has at least one article with fetchable body text of 500+ characters.
 */
export function isEventBriefable(event: {
  articles?: Array<{ source?: string; body?: string; description?: string; url?: string }>;
}): { briefable: boolean; reason?: string } {
  if (!event || !event.articles || event.articles.length === 0) {
    return { briefable: false, reason: 'Single source, no full text available' };
  }

  const distinctSources = new Set(
    event.articles
      .map((a) => (a.source || '').trim().toLowerCase())
      .filter((s) => s.length > 0)
  );

  if (distinctSources.size >= 2) {
    return { briefable: true };
  }

  // Single source: check if at least one article has body text of 500+ characters
  const hasSubstantialBody = event.articles.some((a) => {
    const bodyLen = (a.body || '').trim().length;
    return bodyLen >= 500;
  });

  if (hasSubstantialBody) {
    return { briefable: true };
  }

  return { briefable: false, reason: 'Single source, no full text available' };
}

/**
 * Pure function: Verifies claims strictly against article BODY text.
 *
 * Rules:
 * 1. Quotes are verified ONLY against article BODY text (fetched content), never titles or snippets.
 * 2. If no body text was fetched for a cited article, the claim is marked "unverified: no full text", verified: false.
 * 3. A claim whose text equals its quote (after normalization) is rejected.
 * 4. Quotes shorter than 40 characters are rejected.
 * 5. verified_ratio is computed strictly over checkable claims (claims where full body was available).
 */
export function verifyClaims(
  claims: Claim[],
  articleBodiesByIndex: Map<number, string>
): VerifyClaimsResult {
  if (!claims || claims.length === 0) {
    return {
      verifiedClaims: [],
      verifiedRatio: 0,
      checkableCount: 0,
      totalClaims: 0,
      verifiedCount: 0,
    };
  }

  let verifiedCount = 0;
  let checkableCount = 0;

  const verifiedClaims: Claim[] = claims.map((claim) => {
    if (!claim.sources || !Array.isArray(claim.sources) || claim.sources.length === 0) {
      return {
        ...claim,
        verified: false,
        status: 'unverified',
        rejectionReason: 'No source citations provided',
      };
    }

    // First check if any cited source is missing body text
    let missingBody = false;
    for (const src of claim.sources) {
      const bodyText = articleBodiesByIndex.get(src.articleIndex);
      if (!bodyText || bodyText.trim().length === 0) {
        missingBody = true;
        break;
      }
    }

    if (missingBody) {
      return {
        ...claim,
        verified: false,
        status: 'unverified: no full text',
        rejectionReason: 'No full body text fetched for cited article',
      };
    }

    // All cited articles have body text, so this claim is checkable
    checkableCount++;

    const normClaim = normalizeForVerification(claim.text);
    let allSourcesValid = true;
    let failureReason: string | undefined;

    for (const src of claim.sources) {
      const bodyText = articleBodiesByIndex.get(src.articleIndex)!;
      const rawQuote = src.quote || '';
      const normQuote = normalizeForVerification(rawQuote);

      // Rejection rule 1: Quotes shorter than 40 characters
      if (rawQuote.trim().length < 40 || normQuote.length < 40) {
        allSourcesValid = false;
        failureReason = 'Quote is shorter than 40 characters';
        break;
      }

      // Rejection rule 2: Claim text equals quote after normalization
      if (normClaim === normQuote) {
        allSourcesValid = false;
        failureReason = 'Claim text is identical to citation quote';
        break;
      }

      // Rejection rule 3: Quote must appear verbatim in article body text
      const normBody = normalizeForVerification(bodyText);
      if (!normBody.includes(normQuote)) {
        allSourcesValid = false;
        failureReason = 'Quote does not appear in fetched article body text';
        break;
      }
    }

    if (allSourcesValid) {
      verifiedCount++;
      return {
        ...claim,
        verified: true,
        status: 'verified',
      };
    }

    return {
      ...claim,
      verified: false,
      status: 'unverified',
      rejectionReason: failureReason,
    };
  });

  const verifiedRatio =
    checkableCount > 0 ? Number((verifiedCount / checkableCount).toFixed(4)) : 0;

  return {
    verifiedClaims,
    verifiedRatio,
    checkableCount,
    totalClaims: claims.length,
    verifiedCount,
  };
}
