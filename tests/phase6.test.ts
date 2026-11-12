import { describe, it, expect } from 'vitest';
import { parseAndValidateEventCitations } from '../lib/server/askCitations';

describe('Phase 6: Ask the Brain Citation Parsing', () => {
  const retrievedEvents = [
    { id: 'evt-ai-breakthrough' }, // E1
    { id: 'evt-quantum-processor' }, // E2
    { id: 'evt-space-telescope' }, // E3
    { id: 'evt-clean-energy' }, // E4
    { id: 'evt-economic-summit' }, // E5
  ];

  it('validates and maps legitimate [E#] tags to corresponding event IDs', () => {
    const rawAnswer =
      'Major advances in transformer architecture were announced [E1], while hardware tests occurred at quantum labs [E2].';

    const result = parseAndValidateEventCitations(rawAnswer, retrievedEvents);

    expect(result.cleanedAnswer).toBe(rawAnswer);
    expect(result.citedEventIds).toEqual(['evt-ai-breakthrough', 'evt-quantum-processor']);
  });

  it('strips invalid [E#] tags that are out of bounds', () => {
    const rawAnswer =
      'Astronomers reported new findings [E3], but hypothetical claims [E9] and [E12] are unsupported.';

    const result = parseAndValidateEventCitations(rawAnswer, retrievedEvents);

    expect(result.cleanedAnswer).toContain('[E3]');
    expect(result.cleanedAnswer).not.toContain('[E9]');
    expect(result.cleanedAnswer).not.toContain('[E12]');
    expect(result.citedEventIds).toEqual(['evt-space-telescope']);
  });

  it('deduplicates cited event IDs when the same [E#] is referenced multiple times', () => {
    const rawAnswer =
      'Quantum technology shows promise [E2]. Further experiments confirmed these results [E2].';

    const result = parseAndValidateEventCitations(rawAnswer, retrievedEvents);

    expect(result.citedEventIds.length).toBe(1);
    expect(result.citedEventIds[0]).toBe('evt-quantum-processor');
  });

  it('handles answers with no citations gracefully', () => {
    const rawAnswer = 'not covered by current news';
    const result = parseAndValidateEventCitations(rawAnswer, retrievedEvents);

    expect(result.cleanedAnswer).toBe('not covered by current news');
    expect(result.citedEventIds).toEqual([]);
  });
});

