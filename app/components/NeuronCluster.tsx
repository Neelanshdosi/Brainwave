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
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Proportional neuron size
  const trendScore = topic?.trend?.finalScore ?? topic?.intensity ?? 0.5;
  const baseSize = 0.11 + trendScore * 0.05;

  // Category color from single source of truth
  const categoryColor = useMemo(() => {
    if (!topic) return '#666666';
    return (CATEGORY_COLORS as Record<string, string>)[topic.category] || CATEGORY_COLORS.other;
  }, [topic?.category]);

  // Warmed emissive for UNREAD state: blend 15% toward warm white/gold
  const warmedEmissive = useMemo(() => {
    const col = new THREE.Color(categoryColor);
    const warmWhite = new THREE.Color('#fff4e0'); // subtle warm tint
    return col.lerp(warmWhite, 0.15);
  }, [categoryColor]);

  // Position lerping target
  const targetPos = useRef(new THREE.Vector3(...position));
  useEffect(() => {
    targetPos.current.set(...position);
  }, [position]);

  // Random phase offset based on position to avoid artificial sync across nodes
  const phaseOffset = useMemo(
    () => (position[0] * 3.1 + position[1] * 7.3 + position[2] * 11.7) % (Math.PI * 2),
    [position]
  );

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 5));

      // Scale pulse
      let targetScale = 1.0;
      if (hovered) {
        targetScale = 1.1; // Hover: 1.1x scale
      } else if (isHighlighted) {
        // Gold highlight pulse for cited nodes
        const pulse = Math.sin(state.clock.elapsedTime * 4.0) * 0.1;
        targetScale = 1.0 + pulse;
      }
      groupRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        Math.min(1, delta * 8)
      );
    }

    // Dynamic emissive pulsing for unread nodes
    if (coreMatRef.current) {
      if (isHighlighted) {
        coreMatRef.current.emissiveIntensity = hovered ? 3.0 : 2.5;
      } else if (!isRead && !isDimmed) {
        // UNREAD: emissive pulsing slowly between ~0.9 and ~1.4
        const pulse = (Math.sin(state.clock.elapsedTime * 1.8 + phaseOffset) + 1) * 0.5; // [0, 1]
        const baseIntensity = 0.9 + pulse * 0.5; // [0.9, 1.4]
        coreMatRef.current.emissiveIntensity = baseIntensity + (hovered ? 0.3 : 0);
      } else {
        // READ or DIMMED: subtle emissive intensity (0.15 to 0.3)
        const baseIntensity = isDimmed ? 0.08 : 0.22;
        coreMatRef.current.emissiveIntensity = baseIntensity + (hovered ? 0.3 : 0);
      }
    }

    // Gold halo breathing when highlighted
    if (haloRef.current && isHighlighted) {
      const haloScale = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  // State definitions:
  // 1. ASK-THE-BRAIN highlight: only state where gold appears
  // 2. UNREAD: category color core with warmed emissive + outer transparent glow sphere in category color
  // 3. READ: category color core with subtle emissive, NO glow sphere
  const isUnread = !isRead && !isDimmed;

  return (
    <group ref={groupRef} position={position}>
      {/* 1. ASK-THE-BRAIN Highlight: Gold Ring / Halo (ONLY PLACE GOLD MAY APPEAR) */}
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

      {/* 2. UNREAD Inner Glow Sphere: slightly larger transparent sphere (1.5x) in CATEGORY color */}
      {isUnread && !isHighlighted && (
        <Sphere args={[baseSize * 1.5, 20, 20]}>
          <meshBasicMaterial
            color={categoryColor}
            transparent
            opacity={hovered ? 0.26 : 0.18}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Sphere>
      )}

      {/* 3. Main Core Sphere: Category Color */}
      <Sphere
        args={[baseSize, 28, 28]}
        castShadow
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
          ref={coreMatRef}
          color={isHighlighted ? '#ffd700' : categoryColor}
          emissive={
            isHighlighted
              ? '#ffd700'
              : isUnread
              ? warmedEmissive
              : categoryColor
          }
          emissiveIntensity={isHighlighted ? 2.5 : isUnread ? 1.15 : 0.22}
          roughness={isUnread || isHighlighted ? 0.25 : 0.45}
          metalness={isUnread ? 0.4 : 0.2}
          transparent={isDimmed}
          opacity={isDimmed ? 0.3 : 1.0}
          toneMapped={false}
        />
      </Sphere>
    </group>
  );
}
