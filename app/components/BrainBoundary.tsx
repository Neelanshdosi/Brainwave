'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Named constants for easy tweaking
export const BRAIN_COLOR = '#0e0820'; // very dark violet
export const BRAIN_OPACITY = 0.22;

export default function BrainBoundary() {
  const groupRef = useRef<THREE.Group>(null);

  // Load brain model from public/brain.glb
  const { scene } = useGLTF('/brain.glb');

  // Build a dark subtle silhouette of the GLB with faint edge outline
  const silhouetteGroup = useMemo(() => {
    const root = new THREE.Group();

    // Clone to avoid mutating original scene
    const clone = scene.clone(true);

    // Compute bounds to center/scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Target width so neurons fit inside nicely
    const targetWidth = 4.6; // world units
    const scaleFactor = size.x > 0 ? targetWidth / size.x : 1;

    // Traverse all meshes and apply unlit dark silhouette + faint outline edge
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh && mesh.geometry) {
        const geometry = mesh.geometry;

        // 1. Core unlit dark silhouette (renders first with renderOrder 0)
        // MeshBasicMaterial so scene lights and bloom cannot brighten it
        const surfaceMaterial = new THREE.MeshBasicMaterial({
          color: BRAIN_COLOR,
          transparent: true,
          opacity: BRAIN_OPACITY,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: true,
        });
        const surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
        surfaceMesh.applyMatrix4(mesh.matrixWorld);
        surfaceMesh.renderOrder = 0;
        root.add(surfaceMesh);

        // 2. Faint readable outline: slightly scaled 1.01x, BackSide, unlit #3b2a6b
        // Stays well below bloom threshold (no bloom contribution)
        const outlineMaterial = new THREE.MeshBasicMaterial({
          color: '#3b2a6b',
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          side: THREE.BackSide,
          toneMapped: true,
        });
        const outlineMesh = new THREE.Mesh(geometry, outlineMaterial);
        outlineMesh.applyMatrix4(mesh.matrixWorld);
        outlineMesh.scale.multiplyScalar(1.01);
        outlineMesh.renderOrder = 0;
        root.add(outlineMesh);
      }
    });

    // Center to origin and scale uniformly
    const wfBox = new THREE.Box3().setFromObject(root);
    const wfCenter = new THREE.Vector3();
    wfBox.getCenter(wfCenter);
    root.position.sub(wfCenter);
    root.scale.setScalar(scaleFactor);

    // Slight downward offset to position brain visually lower
    root.position.y -= 0.9;

    return root;
  }, [scene]);

  useFrame((state) => {
    if (groupRef.current) {
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.01;
      groupRef.current.scale.set(breathe, breathe, breathe);
    }
  });

  return (
    <group ref={groupRef} renderOrder={0}>
      <primitive object={silhouetteGroup} />
    </group>
  );
}

// Preload to avoid pop-in
useGLTF.preload('/brain.glb');
