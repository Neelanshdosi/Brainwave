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

    // Gentle pulse of inner gold light (+/-10% scale and opacity over ~2.5s cycle)
    if (innerLightRef.current && innerMatRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * (Math.PI * 2 / 2.5) + phaseOffset);
      const innerScale = 1.0 + pulse * 0.10;
      innerLightRef.current.scale.setScalar(innerScale);

      const targetOpacity = (hovered ? 1.0 : 0.95) + pulse * 0.04;
      innerMatRef.current.opacity = Math.max(0.85, Math.min(1.0, targetOpacity));
    }

    // Gold halo breathing on cited nodes
    if (haloRef.current && isHighlighted) {
      const haloScale = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  // State calculations:
  // UNREAD: translucent category glass shell (opacity 0.7, renderOrder 2) with inner gold sphere (renderOrder 1)
  // READ: solid category shell (opacity 1.0, renderOrder 0), no inner light
  // HIGHLIGHTED: cited node with gold ring/halo (only place gold ring appears)
  const isUnread = !isRead && !isDimmed;

  return (
    <group ref={groupRef} position={position}>
      {/* 1. ASK-THE-BRAIN HIGHLIGHT: Gold ring on cited nodes (only place gold ring appears) */}
      {isHighlighted && (
        <Sphere ref={haloRef} args={[baseSize * 1.45, 24, 24]}>
          <meshBasicMaterial
            color="#ffd700"
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </Sphere>
      )}

      {/* 2. INNER LIGHT (UNREAD only): small gold sphere at same position showing through translucent glass */}
      {isUnread && !isHighlighted && (
        <Sphere
          ref={innerLightRef}
          args={[baseSize * 0.45, 18, 18]}
          renderOrder={1}
        >
          <meshBasicMaterial
            ref={innerMatRef}
            color="#ffc83d"
            toneMapped={false}
            transparent
            opacity={hovered ? 1.0 : 0.95}
          />
        </Sphere>
      )}

      {/* 3. OUTER SHELL: Category color glass lantern */}
      <Sphere
        args={[baseSize, 28, 28]}
        castShadow
        renderOrder={isUnread ? 2 : 0}
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
          emissiveIntensity={isHighlighted ? 2.5 : 0.20} // Low emissive intensity keeps color rich and saturated
          roughness={0.35}
          metalness={0.15}
          transparent={isUnread || isDimmed}
          opacity={isDimmed ? 0.3 : isUnread ? 0.7 : 1.0}
          depthWrite={!isUnread}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </Sphere>
    </group>
  );
}
