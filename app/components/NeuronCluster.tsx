'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { Topic } from '@/types/topic';
import { CATEGORY_COLORS } from '@/lib/neuronPosition';

interface NeuronProps {
  position: [number, number, number];
  topic: Topic | null;
  onClick: (topic: Topic) => void;
  onHover: (topic: Topic | null) => void;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isRead?: boolean;
}

export default function Neuron({
  position,
  topic,
  onClick,
  onHover,
  isHighlighted = false,
  isDimmed = false,
  isRead = false,
}: NeuronProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerLightRef = useRef<THREE.Mesh>(null);
  const innerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Proportional neuron size
  const trendScore = topic?.trend?.finalScore ?? topic?.intensity ?? 0.5;
  const baseSize = 0.11 + trendScore * 0.05;

  // Category color from single source of truth
  const categoryColor = useMemo(() => {
    if (!topic) return '#3b82f6';
    return (CATEGORY_COLORS as Record<string, string>)[topic.category] || CATEGORY_COLORS.politics;
  }, [topic?.category]);

  // Phase offset per node derived deterministically from topic id or coordinates
  const phaseOffset = useMemo(() => {
    if (topic?.id) {
      let hash = 0;
      for (let i = 0; i < topic.id.length; i++) {
        hash = (hash * 31 + topic.id.charCodeAt(i)) & 0xffffffff;
      }
      return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;
    }
    return (position[0] * 3.1 + position[1] * 7.3 + position[2] * 11.7) % (Math.PI * 2);
  }, [topic?.id, position]);

  // Position lerping target
  const targetPos = useRef(new THREE.Vector3(...position));
  useEffect(() => {
    targetPos.current.set(...position);
  }, [position]);

  // Base gold color for inner light: '#ffc83d'
  const baseGoldColor = useMemo(() => new THREE.Color('#ffc83d'), []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 5));

      // Hover: scale 1.1x. Highlight: breathing pulse
      let targetScale = 1.0;
      if (hovered) {
        targetScale = 1.1;
      } else if (isHighlighted) {
        targetScale = 1.0 + Math.sin(state.clock.elapsedTime * 4.0) * 0.1;
      }
      groupRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        Math.min(1, delta * 8)
      );
    }

    // Pulse inner gold light above bloom threshold:
    // Base multiplier pulses between ~2.2 and ~3.4 on a 2 to 3 second cycle.
    // Hover adds +1.0 to the multiplier.
    if (innerMatRef.current) {
      const cycleDuration = 2.5;
      const sinWave = Math.sin(state.clock.elapsedTime * (Math.PI * 2 / cycleDuration) + phaseOffset);
      let multiplier = 2.8 + sinWave * 0.6;
      if (hovered) {
        multiplier += 1.0;
      }
      innerMatRef.current.color.copy(baseGoldColor).multiplyScalar(multiplier);
    }

    // Gold halo breathing on cited nodes (Ask-the-Brain)
    if (haloRef.current && isHighlighted) {
      const haloScale = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  // State calculations:
  // UNREAD: translucent category glass shell (opacity 0.45, emissive 0.15, toneMapped true) + inner bloom light sphere (radius 0.4x, gold * multiplier > 1, toneMapped false)
  // READ: solid category shell (opacity 1.0, emissive 0.20, toneMapped true), no inner light
  // HIGHLIGHTED: cited node with bright blooming gold ring (>1); dimmed nodes get opacity ~0.3
  const isUnread = !isRead && !isDimmed;

  return (
    <group ref={groupRef} position={position}>
      {/* 1. ASK-THE-BRAIN HIGHLIGHT: Gold ring on cited nodes (blooms > 1.0) */}
      {isHighlighted && (
        <Sphere ref={haloRef} args={[baseSize * 1.45, 24, 24]}>
          <meshBasicMaterial
            color={new THREE.Color('#ffd700').multiplyScalar(2.5)}
            toneMapped={false}
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </Sphere>
      )}

      {/* 2. INNER LIGHT (UNREAD only): blooms > 1.0 through the colored glass */}
      {isUnread && !isHighlighted && (
        <Sphere
          ref={innerLightRef}
          args={[baseSize * 0.4, 20, 20]}
          renderOrder={1}
        >
          <meshBasicMaterial
            ref={innerMatRef}
            color={new THREE.Color('#ffc83d').multiplyScalar(hovered ? 3.8 : 2.8)}
            toneMapped={false}
          />
        </Sphere>
      )}

      {/* 3. SHELL: Category color glass lantern */}
      <Sphere
        args={[baseSize, 28, 28]}
        castShadow
        renderOrder={isUnread ? 2 : 1}
        onClick={() => topic && onClick(topic)}
        onPointerOver={() => {
          setHovered(true);
          topic && onHover(topic);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
        }}
      >
        <meshStandardMaterial
          color={categoryColor}
          emissive={isHighlighted ? '#ffd700' : categoryColor}
          emissiveIntensity={isHighlighted ? 0.8 : isUnread ? 0.15 : 0.20}
          roughness={0.35}
          metalness={0.15}
          transparent={isUnread || isDimmed}
          opacity={isDimmed ? 0.3 : isUnread ? 0.45 : 1.0}
          depthWrite={!isUnread}
          side={THREE.FrontSide}
          toneMapped={true}
        />
      </Sphere>
    </group>
  );
}
