import { useState, useEffect, useCallback } from 'react';
import { Topic } from '@/types/topic';
import { generateBrainNeurons } from './neuronPosition';

interface TrendsResponse {
  topics: Omit<Topic, 'position'>[];
  updatedAt: string;
}

export const useTrendingTopics = (region: string = 'global', refreshInterval = 300000) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTopics = useCallback(async () => {
  try {
    setError(null);
    console.log('🔄 Fetching topics for region:', region);
    
    const response = await fetch(`/api/trends?region=${region}`, {
      cache: 'no-store'
    });
    
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`Failed to fetch trends: ${response.status} - ${errorText}`);
    }

    const data: TrendsResponse = await response.json();
    console.log('✅ Received topics:', data.topics.length);
    
    const positions = generateBrainNeurons(data.topics.length);
    
    const topicsWithPositions: Topic[] = data.topics.map((topic, index) => ({
      ...topic,
      position: positions[index],
      timestamp: new Date(topic.timestamp),
    }));

    setTopics(topicsWithPositions);
    setLastUpdate(new Date());
    setLoading(false);
  } catch (err) {
    console.error('❌ Error fetching topics:', err);
    setError(err instanceof Error ? err.message : 'Unknown error');
    setLoading(false);
  }
 }, [region]);

  useEffect(() => {
    fetchTopics();
    
    const interval = setInterval(fetchTopics, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchTopics, refreshInterval]);

  return { topics, loading, error, lastUpdate, refetch: fetchTopics };
};