export const generateBrainNeurons = (count: number = 40) => {
  const neurons: Array<[number, number, number]> = [];
  const yOffset = 0.8; // shift neurons upward into the main brain volume
  const minDist = 0.36; // increase spacing between neurons to reduce clustering further
  
  // Create brain-like clusters in different regions
  // Tuned to sit well inside GLB boundary (~4.6 units width, centered at origin)
  const regions = [
    { center: [1.0, 0.2 + yOffset, 0.0], radius: 1.2, count: Math.max(6, Math.floor(count * 0.25)) },  // Right frontal
    { center: [-1.0, 0.2 + yOffset, 0.0], radius: 1.2, count: Math.max(6, Math.floor(count * 0.25)) }, // Left frontal
    { center: [0.0, -0.1 + yOffset, 0.0], radius: 1.35, count: Math.max(6, Math.floor(count * 0.30)) },   // Central core
    { center: [0.0, 0.05 + yOffset, -1.0], radius: 0.95, count: Math.max(4, count - 3 * Math.max(6, Math.floor(count * 0.25)) - Math.max(6, Math.floor(count * 0.30))) }, // Occipital/back
  ];

  const distance3 = (a: [number, number, number], b: [number, number, number]) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Strict brain boundary approximation (two ellipsoids + bridge)
  const leftCenter: [number, number, number] = [-1.0, 0.2 + yOffset, 0.0];
  const rightCenter: [number, number, number] = [1.0, 0.2 + yOffset, 0.0];
  const bridgeCenter: [number, number, number] = [0.0, 0.2 + yOffset, 0.0];
  // Tighter ellipsoid boundaries to ensure neurons stay well inside
  const hemiRadius = { x: 1.5, y: 1.3, z: 1.0 };
  const bridgeRadius = { x: 0.8, y: 0.55, z: 0.85 };

  const insideEllipsoid = (
    p: [number, number, number],
    c: [number, number, number],
    r: { x: number; y: number; z: number }
  ) => {
    const nx = (p[0] - c[0]) / r.x;
    const ny = (p[1] - c[1]) / r.y;
    const nz = (p[2] - c[2]) / r.z;
    return nx * nx + ny * ny + nz * nz <= 1;
  };

  const inBrain = (p: [number, number, number]) =>
    insideEllipsoid(p, leftCenter, hemiRadius) ||
    insideEllipsoid(p, rightCenter, hemiRadius) ||
    insideEllipsoid(p, bridgeCenter, bridgeRadius);

  regions.forEach(region => {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = region.count * 200;
    while (placed < region.count && attempts < maxAttempts) {
      attempts++;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1); // uniform on sphere
      // Sample more toward the interior to avoid boundary edges
      const radialFactor = 0.4 + 0.35 * Math.cbrt(Math.random()); // max ~0.75 of region radius, keeps points inside
      const r = region.radius * radialFactor;

      const x = region.center[0] + r * Math.sin(phi) * Math.cos(theta);
      const y = region.center[1] + r * Math.sin(phi) * Math.sin(theta);
      const z = region.center[2] + r * Math.cos(phi);
      const candidate: [number, number, number] = [x, y, z];

      // Strict containment in brain volume
      if (!inBrain(candidate)) continue;

      let ok = true;
      for (let i = 0; i < neurons.length; i++) {
        if (distance3(candidate, neurons[i]) < minDist) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      neurons.push(candidate);
      placed++;
    }
  });

  return neurons;
};

export const CATEGORY_COLORS = {
  tech: '#00d4ff',
  politics: '#ff4757',
  entertainment: '#ffa502',
  science: '#1e90ff',
  sports: '#2ed573',
  other: '#a29bfe',
};