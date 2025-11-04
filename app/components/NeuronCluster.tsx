'use client';

import { useRef, useState } from 'react';
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
}

export default function Neuron({ position, topic, onClick, onHover }: NeuronProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const baseSize = topic ? 0.065 + (topic.intensity * 0.09) : 0.05;
  const color = topic ? CATEGORY_COLORS[topic.category] : '#666666';

  // Pulsing animation based on intensity
  useFrame((state) => {
    if (meshRef.current && topic) {
      const pulse = Math.sin(state.clock.elapsedTime * 2 + topic.intensity * 5) * 0.02;
      meshRef.current.scale.setScalar(1 + pulse);
    }
  });

  return (
    <Sphere
      ref={meshRef}
      position={position}
      args={[baseSize, 16, 16]}
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
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.8 : topic ? topic.intensity * 0.5 : 0.1}
        roughness={0.3}
        metalness={0.7}
        toneMapped
        envMapIntensity={0.6}
      />
    </Sphere>
  );
}