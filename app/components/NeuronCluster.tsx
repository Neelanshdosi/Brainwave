'use client';

import { useRef, useState, useEffect } from 'react';
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
  isVisited?: boolean;
}

export default function Neuron({
  position,
  topic,
  onClick,
  onHover,
  isHighlighted = false,
  isDimmed = false,
  isVisited = false,
}: NeuronProps) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Proportional neuron size
  const trendScore = topic?.trend?.finalScore ?? topic?.intensity ?? 0.5;
  const baseSize = 0.11 + trendScore * 0.05;

  // Pulse speed based on story velocity
  const rawVelocity = topic?.trend?.velocity;
  const numVelocity = typeof rawVelocity === 'number' ? rawVelocity : 0.5;
  const pulseSpeed = 1.0 + numVelocity * 3.0;

  // True original category color (Red for politics, Cyan for tech, etc.)
  const categoryColor = topic ? CATEGORY_COLORS[topic.category] || '#a29bfe' : '#666666';

  // Golden glow is active while unvisited; disappears completely once clicked
  const isGlowing = !isVisited && !isDimmed;

  // Position lerping target
  const targetPos = useRef(new THREE.Vector3(...position));
  useEffect(() => {
    targetPos.current.set(...position);
  }, [position]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 5));

      // Active breathing pulse
      if (isGlowing || isHighlighted) {
        const pulseMagnitude = isHighlighted ? 0.09 : 0.045;
        const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed + trendScore * 3) * pulseMagnitude;
        groupRef.current.scale.setScalar(1 + pulse);
      } else {
        groupRef.current.scale.setScalar(1.0);
      }
    }

    // Gentle halo breathing
    if (haloRef.current && isGlowing) {
      const haloScale = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* 1. Point Light: Casts genuine radiant golden light into the surrounding 3D space */}
      {isGlowing && (
        <pointLight
          color="#ffb700"
          intensity={hovered ? 2.5 : 1.4}
          distance={1.6}
          decay={2}
        />
      )}

      {/* 2. Soft Golden Halo Aura: Additive blending glow corona around the node */}
      {isGlowing && (
        <Sphere ref={haloRef} args={[baseSize * 1.35, 20, 20]}>
          <meshBasicMaterial
            color="#ffa200"
            transparent
            opacity={hovered ? 0.45 : 0.28}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </Sphere>
      )}

      {/* 3. Main Sphere: Node's original category color, infused with golden center emission when unread */}
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
          color={categoryColor}
          emissive={
            isHighlighted
              ? '#ffd700'
              : isGlowing
              ? '#ff9900' // Golden amber center glow
              : categoryColor // Reverts to original category color when clicked!
          }
          emissiveIntensity={
            isHighlighted
              ? 2.8
              : hovered
              ? 2.0
              : isGlowing
              ? 1.5 + trendScore * 0.5 // Intense visible glow
              : 0.25 // Normal settled category emission once clicked
          }
          roughness={isGlowing ? 0.2 : 0.4}
          metalness={isGlowing ? 0.6 : 0.3}
          transparent={isDimmed}
          opacity={isDimmed ? 0.25 : 1.0}
          toneMapped={false}
          envMapIntensity={isGlowing ? 1.0 : 0.4}
        />
      </Sphere>

      {/* 4. Glowing Golden Inner Beacon: Core light shining through */}
      {isGlowing && (
        <Sphere args={[baseSize * 0.42, 16, 16]}>
          <meshBasicMaterial
            color="#fff275"
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </Sphere>
      )}
    </group>
  );
}
