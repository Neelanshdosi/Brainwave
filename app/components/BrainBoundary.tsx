'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export default function BrainBoundary() {
  const groupRef = useRef<THREE.Group>(null);

  // Load brain model from public/brain.glb
  const { scene } = useGLTF('/brain.glb');

  // Build a wireframe/edges version of the GLB, scaled and centered
  const wireframeGroup = useMemo(() => {
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
    const targetWidth = 4.6; // world units (slightly tighter)
    const scaleFactor = size.x > 0 ? targetWidth / size.x : 1;

    // Traverse meshes and create wireframe materials
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh && mesh.geometry) {
        // Ensure indexed geometry for wireframe
        const geometry = mesh.geometry;

        // Translucent surface to make model appear see-through (under wireframe)
        const surfaceMaterial = new THREE.MeshBasicMaterial({
          color: '#8b5cf6',
          transparent: true,
          opacity: 0.06,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
        surfaceMesh.applyMatrix4(mesh.matrixWorld);
        root.add(surfaceMesh);
        // Note: wireframe lines and edge lines removed for clearer neuron visibility
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
    <group ref={groupRef}>
      {/* Wireframe brain boundary from GLB */}
      <primitive object={wireframeGroup} />
    </group>
  );
}

// Preload to avoid pop-in
useGLTF.preload('/brain.glb');