'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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

  const threeCategoryColor = useMemo(() => new THREE.Color(categoryColor), [categoryColor]);

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

  // Saturated HDR gold with low blue channel: new THREE.Color(2.8, 1.4, 0.2)
  // so it blooms as warm gold/amber without turning white-pink
  const hdrGoldBase = useMemo(() => new THREE.Color(2.8, 1.4, 0.2), []);

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

    // Pulse HDR gold inner light (multiplier range ~0.75x to 1.15x of base values)
    // Hover adds +0.35x
    if (innerMatRef.current) {
      const cycleDuration = 2.5;
      const sinWave = Math.sin(state.clock.elapsedTime * (Math.PI * 2 / cycleDuration) + phaseOffset);
      let pulseMultiplier = 0.95 + sinWave * 0.20; // range [0.75, 1.15]
      if (hovered) {
        pulseMultiplier += 0.35;
      }
      innerMatRef.current.color.copy(hdrGoldBase).multiplyScalar(pulseMultiplier);
    }

    // Gold halo breathing on cited nodes (Ask-the-Brain)
    if (haloRef.current && isHighlighted) {
      const haloScale = 1.0 + Math.sin(state.clock.elapsedTime * 3.5) * 0.08;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  // State calculations:
  // UNREAD: translucent category glass shell with category-colored fresnel rim blooming faintly (1.4x) + warm HDR gold inner light
  // READ: solid category shell (opacity 1.0, emissive 0.20, toneMapped true), no inner light, no rim bloom
  // HIGHLIGHTED: cited node with bright blooming gold ring (>1); dimmed nodes get opacity ~0.3
  const isUnread = !isRead && !isDimmed;

  // Fresnel rim shader hook for unread shells:
  // Adds pow(1.0 - abs(dot(normal, viewDir)), 2.5) * categoryColor * 1.1 to emissive (barely above threshold)
  const onBeforeCompileShell = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    if (!isUnread) return;
    shader.uniforms.uRimColor = { value: threeCategoryColor };
    shader.fragmentShader = `
      uniform vec3 uRimColor;
      ${shader.fragmentShader}
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      #ifdef USE_NORMAL
        vec3 rimViewDir = normalize(vViewPosition);
        float rimFactor = pow(1.0 - abs(dot(vNormal, -rimViewDir)), 2.5);
        gl_FragColor.rgb += uRimColor * (rimFactor * 1.1);
      #endif
      `
    );
  }, [isUnread, threeCategoryColor]);

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

      {/* 2. INNER LIGHT (UNREAD only): saturated HDR gold (2.8, 1.4, 0.2) blooming as warm gold/amber */}
      {isUnread && !isHighlighted && (
        <Sphere
          ref={innerLightRef}
          args={[baseSize * 0.5, 20, 20]}
          renderOrder={1}
        >
          <meshBasicMaterial
            ref={innerMatRef}
            color={hdrGoldBase}
            toneMapped={false}
          />
        </Sphere>
      )}

      {/* 3. SHELL: Category color glass lantern with blooming fresnel rim */}
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
          emissiveIntensity={isHighlighted ? 0.8 : isUnread ? 0.15 : 0.20}
          roughness={0.35}
          metalness={0.15}
          transparent={isUnread || isDimmed}
          opacity={isDimmed ? 0.3 : isUnread ? 0.45 : 1.0}
          depthWrite={!isUnread}
          side={THREE.FrontSide}
          toneMapped={!isUnread}
          onBeforeCompile={onBeforeCompileShell}
          customProgramCacheKey={() => (isUnread ? `unread-rim-${categoryColor}` : 'read-solid')}
        />
      </Sphere>
    </group>
  );
}
