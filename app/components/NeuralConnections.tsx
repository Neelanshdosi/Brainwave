'use client';

import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Topic } from '@/types/topic';
import { CATEGORY_COLORS } from '@/lib/neuronPosition';
import * as THREE from 'three';

interface NeuralConnectionsProps {
  topics: Topic[];
}

// Calculate similarity between two topics
function calculateSimilarity(topic1: Topic, topic2: Topic): number {
  let score = 0;

  // Same category = strong connection
  if (topic1.category === topic2.category) {
    score += 0.6;
  }

  // Similar source (subreddit proximity)
  if (topic1.source === topic2.source) {
    score += 0.3;
  }

  // Similar intensity = related trending
  const intensityDiff = Math.abs(topic1.intensity - topic2.intensity);
  if (intensityDiff < 0.2) {
    score += 0.1;
  }

  return score;
}

export default function NeuralConnections({ topics }: NeuralConnectionsProps) {
  const validTopics = useMemo(() => {
    return (topics || []).filter((t) => {
      const p = t?.position as unknown;
      return (
        Array.isArray(p) &&
        p.length === 3 &&
        p.every((v) => Number.isFinite(v as number))
      );
    });
  }, [topics]);

  const connections = useMemo(() => {
    const lines: Array<{
      start: [number, number, number];
      end: [number, number, number];
      strength: number;
      color: string;
    }> = [];

    // Generate connections between related topics
    for (let i = 0; i < validTopics.length; i++) {
      for (let j = i + 1; j < validTopics.length; j++) {
        const a = validTopics[i];
        const b = validTopics[j];
        const similarity = calculateSimilarity(a, b);

        // Only show strong connections (>= 0.6)
        if (similarity >= 0.6) {
          const distance = Math.sqrt(
            Math.pow(a.position[0] - b.position[0], 2) +
            Math.pow(a.position[1] - b.position[1], 2) +
            Math.pow(a.position[2] - b.position[2], 2)
          );

          // Only connect nearby neurons (distance < 4)
          if (distance < 4) {
            const catA = a.category;
            const catB = b.category;
            let color = '#8b5cf6';
            if (catA === catB) {
              color = CATEGORY_COLORS[catA as keyof typeof CATEGORY_COLORS];
            } else {
              // Blend two category colors 50/50 for cross-category links
              const hexToRgb = (hex: string) => {
                const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
                return {
                  r: parseInt(m[1], 16),
                  g: parseInt(m[2], 16),
                  b: parseInt(m[3], 16),
                };
              };
              const rgbToHex = (r: number, g: number, b: number) =>
                '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
              const a = hexToRgb(CATEGORY_COLORS[catA as keyof typeof CATEGORY_COLORS]);
              const b = hexToRgb(CATEGORY_COLORS[catB as keyof typeof CATEGORY_COLORS]);
              color = rgbToHex(
                Math.round((a.r + b.r) / 2),
                Math.round((a.g + b.g) / 2),
                Math.round((a.b + b.b) / 2)
              );
            }
            lines.push({
              start: a.position,
              end: b.position,
              strength: similarity,
              color,
            });
          }
        }
      }
    }

    return lines;
  }, [validTopics]);

  return (
    <>
      {connections.map((connection, index) => (
        <Line
          key={`connection-${index}`}
          points={[connection.start, connection.end]}
          color={connection.color}
          lineWidth={1.25}
          transparent
          opacity={Math.min(0.6, connection.strength * 0.45)}
          dashed={false}
        />
      ))}
    </>
  );
}