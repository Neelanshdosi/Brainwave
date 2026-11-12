export interface ParsedAskResult {
  cleanedAnswer: string;
  citedEventIds: string[];
}

/**
 * Pure function: Verifies that every [E#] in the answer maps to a valid retrieved event.
 * Strips invalid [E#] tags and returns deduplicated valid citedEventIds.
 */
export function parseAndValidateEventCitations(
  rawAnswer: string,
  retrievedEvents: Array<{ id: string }>
): ParsedAskResult {
  if (!rawAnswer) {
    return { cleanedAnswer: '', citedEventIds: [] };
  }

  const validIdsSet = new Set<string>();
  const totalEvents = retrievedEvents.length;

  // Replace each [E(\d+)]
  const cleanedAnswer = rawAnswer.replace(/\[E(\d+)\]/g, (match, digits) => {
    const num = parseInt(digits, 10);
    const index = num - 1;

    if (index >= 0 && index < totalEvents) {
      const eventId = retrievedEvents[index].id;
      validIdsSet.add(eventId);
      return match; // Keep valid tag
    } else {
      // Strip invalid [E#]
      return '';
    }
  });

  return {
    cleanedAnswer: cleanedAnswer.replace(/\s{2,}/g, ' ').trim(),
    citedEventIds: Array.from(validIdsSet),
  };
}

