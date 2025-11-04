import { Topic } from '@/types/topic';
import { generateBrainNeurons } from './neuronPosition';

const MOCK_TOPICS: Omit<Topic, 'id' | 'position'>[] = [
  {
    name: 'AI Chip Breakthrough',
    category: 'tech',
    intensity: 0.9,
    summary: 'New neural processing units achieve 100x performance gains in machine learning tasks.',
    source: 'Reddit r/technology',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    name: 'Climate Summit 2025',
    category: 'politics',
    intensity: 0.75,
    summary: 'World leaders gather to discuss aggressive carbon reduction targets.',
    source: 'Reddit r/worldnews',
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    name: 'Taylor Swift Tour',
    category: 'entertainment',
    intensity: 0.85,
    summary: 'Record-breaking concert series announced for Asian cities.',
    source: 'Reddit r/popculture',
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    name: 'Mars Colony Progress',
    category: 'science',
    intensity: 0.7,
    summary: 'SpaceX completes successful test of life support systems for Mars mission.',
    source: 'Reddit r/space',
    timestamp: new Date(Date.now() - 5400000),
  },
  {
    name: 'Cricket World Cup',
    category: 'sports',
    intensity: 0.95,
    summary: 'India advances to finals with stunning victory over Australia.',
    source: 'Reddit r/cricket',
    timestamp: new Date(Date.now() - 900000),
  },
  {
    name: 'Quantum Computing',
    category: 'tech',
    intensity: 0.65,
    summary: 'IBM announces new quantum processor with 1000+ qubits.',
    source: 'Reddit r/Futurology',
    timestamp: new Date(Date.now() - 10800000),
  },
  {
    name: 'Electric Vehicle Sales',
    category: 'tech',
    intensity: 0.6,
    summary: 'EVs surpass 50% of new car sales in Europe for first time.',
    source: 'Reddit r/electricvehicles',
    timestamp: new Date(Date.now() - 14400000),
  },
  {
    name: 'New Movie Trailer',
    category: 'entertainment',
    intensity: 0.8,
    summary: 'Highly anticipated sci-fi sequel drops surprise trailer.',
    source: 'Reddit r/movies',
    timestamp: new Date(Date.now() - 2700000),
  },
];

export const generateMockTopics = (): Topic[] => {
  const positions = generateBrainNeurons(MOCK_TOPICS.length);
  
  return MOCK_TOPICS.map((topic, index) => ({
    ...topic,
    id: `topic-${index}`,
    position: positions[index],
  }));
};