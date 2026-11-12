import { useState, useEffect, useCallback } from 'react';
import { Topic, SimilarityEdgeData } from '@/types/topic';

interface EventsApiResponse {
  events: Topic[];
  edges: SimilarityEdgeData[];
  updatedAt: string;
}

export const useTrendingTopics = (refreshInterval = 300000) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [edges, setEdges] = useState<SimilarityEdgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/events', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data: EventsApiResponse = await response.json();

      const eventsWithDates: Topic[] = data.events.map((ev) => ({
        ...ev,
        timestamp: new Date(ev.timestamp),
      }));

      setTopics(eventsWithDates);
      setEdges(data.edges || []);
      setLastUpdate(new Date(data.updatedAt));
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();

    const interval = setInterval(fetchEvents, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchEvents, refreshInterval]);

  return { topics, edges, loading, error, lastUpdate, refetch: fetchEvents };
};
