'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Topic, SimilarityEdgeData } from '@/types/topic';
import { CATEGORY_COLORS } from '@/lib/neuronPosition';

interface NeuralConnectionsProps {
  topics: Topic[];
  edges?: SimilarityEdgeData[];
}

export default function NeuralConnections({ topics, edges = [] }: NeuralConnectionsProps) {
  const renderedEdges = useMemo(() => {
    // 1. If explicit real similarity edges are provided from /api/events, use them!
    if (edges && edges.length > 0) {
      const topicMap = new Map<string, Topic>();
      topics.forEach((t) => topicMap.set(t.id, t));

      return edges.flatMap((edge) => {
        const fromTopic = topicMap.get(edge.fromId);
        const toTopic = topicMap.get(edge.toId);
        // Only render if both endpoints are currently visible in filtered topics
        if (!fromTopic || !toTopic) return [];

        const color =
          fromTopic.category === toTopic.category
            ? CATEGORY_COLORS[fromTopic.category] || '#8b5cf6'
            : '#8b5cf6';

        return [
          {
            start: edge.fromPosition,
            end: edge.toPosition,
            strength: edge.similarity,
            color,
          },
        ];
      });
    }

    // 2. Otherwise use similarEventIds from topics
    const lines: Array<{
      start: [number, number, number];
      end: [number, number, number];
      strength: number;
      color: string;
    }> = [];

    const topicMap = new Map<string, Topic>();
    topics.forEach((t) => topicMap.set(t.id, t));

    const drawnPairs = new Set<string>();

    for (const t of topics) {
      if (!t.similarEventIds) continue;
      for (const targetId of t.similarEventIds) {
        const target = topicMap.get(targetId);
        if (!target) continue;

        const pairKey = [t.id, target.id].sort().join('::');
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const color =
          t.category === target.category
            ? CATEGORY_COLORS[t.category] || '#8b5cf6'
            : '#8b5cf6';

        lines.push({
          start: t.position,
          end: target.position,
          strength: 0.7,
          color,
        });
      }
    }

    return lines;
  }, [topics, edges]);

  return (
    <>
      {renderedEdges.map((edge, index) => (
        <Line
          key={`edge-${index}`}
          points={[edge.start, edge.end]}
          color={edge.color}
          lineWidth={1.3}
          transparent
          opacity={Math.min(0.65, Math.max(0.15, edge.strength * 0.5))}
          dashed={false}
        />
      ))}
    </>
  );
}
