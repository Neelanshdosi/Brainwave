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

// Global texture cache for radial gradient textures to prevent recreation
const gradientTextureCache = new Map<string, THREE.CanvasTexture>();

function getRadialGradientTexture(color: string, centerColor?: string): THREE.CanvasTexture {
  const key = `${color}-${centerColor || ''}`;
  if (gradientTextureCache.has(key)) {
    return gradientTextureCache.get(key)!;
  }

  if (typeof document === 'undefined') {
    // SSR fallback dummy texture
    const dummy = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
    return dummy;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, centerColor || color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  gradientTextureCache.set(key, texture);
  return texture;
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
  const auraSpriteRef = useRef<THREE.Sprite>(null);
  const innerLightSpriteRef = useRef<THREE.Sprite>(null);
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

  // Textures: category aura texture & gold inner light texture
  const auraTexture = useMemo(() => {
    return getRadialGradientTexture(categoryColor);
  }, [categoryColor]);

  const goldTexture = useMemo(() => {
    return getRadialGradientTexture('#ffc83d', '#fff3c4');
  }, []);

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

    // Pulse inner gold light (+/-12% scale and opacity over 2 to 3 second cycle, phase offset by id hash)
    if (innerLightSpriteRef.current) {
      const cycleDuration = 2.5;
      const pulse = Math.sin(state.clock.elapsedTime * (Math.PI * 2 / cycleDuration) + phaseOffset);
      const innerScale = (baseSize * 1.3) * (1.0 + pulse * 0.12);
      innerLightSpriteRef.current.scale.set(innerScale, innerScale, 1);

      const baseOpacity = hovered ? 1.0 : 0.95;
      const targetOpacity = Math.max(0.7, Math.min(1.0, baseOpacity + pulse * 0.12));
      const mat = innerLightSpriteRef.current.material as THREE.SpriteMaterial;
      if (mat) {
        mat.opacity = targetOpacity;
      }
    }

    // Aura sprite scale & opacity
    if (auraSpriteRef.current) {
      const auraScale = baseSize * 3.2;
      auraSpriteRef.current.scale.set(auraScale, auraScale, 1);
      const mat = auraSpriteRef.current.material as THREE.SpriteMaterial;
      if (mat) {
        mat.opacity = hovered ? 0.45 : 0.35;
      }
    }

    // Gold halo breathing on cited nodes
    if (haloRef.current && isHighlighted) {
      const haloScale = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  // State calculations:
  // UNREAD: outer category aura sprite + translucent category shell (opacity 0.5) + inner gold light sprite
  // READ: solid category shell (opacity 1.0), no aura or inner light sprites
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

      {/* 2. UNREAD LAYER 1: OUTER AURA (Category color gradient sprite fading into dark space) */}
      {isUnread && !isHighlighted && (
        <sprite ref={auraSpriteRef} renderOrder={1}>
          <spriteMaterial
            map={auraTexture}
            transparent
            opacity={hovered ? 0.45 : 0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}

      {/* 3. UNREAD LAYER 2 / NORMAL NODE: SHELL in category color */}
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
          opacity={isDimmed ? 0.3 : isUnread ? 0.5 : 1.0}
          depthWrite={!isUnread}
          side={THREE.FrontSide}
        />
      </Sphere>

      {/* 4. UNREAD LAYER 3: INNER LIGHT (Gold gradient sprite fading out smoothly) */}
      {isUnread && !isHighlighted && (
        <sprite ref={innerLightSpriteRef} renderOrder={3}>
          <spriteMaterial
            map={goldTexture}
            transparent
            opacity={hovered ? 1.0 : 0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  );
}
