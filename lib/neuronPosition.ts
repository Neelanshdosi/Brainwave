export const yOffset = 0.25;
export const minDist = 0.38;

export const leftCenter: [number, number, number] = [-0.95, yOffset, 0.0];
export const rightCenter: [number, number, number] = [0.95, yOffset, 0.0];
export const bridgeCenter: [number, number, number] = [0.0, yOffset, 0.0];
export const frontalCenter: [number, number, number] = [0.0, yOffset + 0.1, 0.65];
export const occipitalCenter: [number, number, number] = [0.0, yOffset, -0.65];

export const hemiRadius = { x: 1.55, y: 1.25, z: 1.35 };
export const bridgeRadius = { x: 1.1, y: 0.95, z: 1.1 };
export const lobeRadius = { x: 1.35, y: 1.05, z: 1.0 };

export const distance3 = (a: [number, number, number], b: [number, number, number]): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const insideEllipsoid = (
  p: [number, number, number],
  c: [number, number, number],
  r: { x: number; y: number; z: number }
): boolean => {
  const nx = (p[0] - c[0]) / r.x;
  const ny = (p[1] - c[1]) / r.y;
  const nz = (p[2] - c[2]) / r.z;
  return nx * nx + ny * ny + nz * nz <= 1;
};

export const inBrain = (p: [number, number, number]): boolean =>
  insideEllipsoid(p, leftCenter, hemiRadius) ||
  insideEllipsoid(p, rightCenter, hemiRadius) ||
  insideEllipsoid(p, bridgeCenter, bridgeRadius) ||
  insideEllipsoid(p, frontalCenter, lobeRadius) ||
  insideEllipsoid(p, occipitalCenter, lobeRadius);

/**
 * 32-bit FNV-1a string hashing
 */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

/**
 * Deterministic seeded PRNG (Mulberry32)
 */
export function createSeededRandom(seed: number | string): () => number {
  let s = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  if (s === 0) s = 1337;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const regions = [
  { center: [0.95, yOffset, 0.0] as [number, number, number], radius: 1.35 },  // Right hemisphere
  { center: [-0.95, yOffset, 0.0] as [number, number, number], radius: 1.35 }, // Left hemisphere
  { center: [0.0, yOffset - 0.2, 0.0] as [number, number, number], radius: 1.2 }, // Central & lower core
  { center: [0.0, yOffset + 0.1, 0.65] as [number, number, number], radius: 1.1 }, // Frontal pole
  { center: [0.0, yOffset, -0.65] as [number, number, number], radius: 1.1 }, // Occipital back
];

/**
 * Deterministically compute a 3D brain neuron coordinate from a topic ID.
 */
export function getDeterministicNeuronPosition(
  topicId: string,
  existingPoints: Array<[number, number, number]> = []
): [number, number, number] {
  const rng = createSeededRandom(topicId);
  const regionIndex = Math.floor(rng() * regions.length);
  const region = regions[regionIndex];

  let candidate: [number, number, number] = [region.center[0], region.center[1], region.center[2]];
  const maxAttempts = 300;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const radialFactor = 0.3 + 0.6 * Math.cbrt(rng());
    const r = region.radius * radialFactor;

    const x = region.center[0] + r * Math.sin(phi) * Math.cos(theta);
    const y = region.center[1] + r * Math.sin(phi) * Math.sin(theta);
    const z = region.center[2] + r * Math.cos(phi);
    const p: [number, number, number] = [x, y, z];

    if (!inBrain(p)) continue;

    const isSpaced = existingPoints.every((existing) => distance3(p, existing) >= minDist);
    if (isSpaced || attempt > 250) {
      candidate = p;
      break;
    }
  }

  return candidate;
}

/**
 * Generate brain neurons deterministically.
 */
export const generateBrainNeurons = (
  input: number | string[] = 40
): Array<[number, number, number]> => {
  const neurons: Array<[number, number, number]> = [];

  if (Array.isArray(input)) {
    for (const id of input) {
      const pos = getDeterministicNeuronPosition(id, neurons);
      neurons.push(pos);
    }
    return neurons;
  }

  const count = typeof input === 'number' ? input : 40;
  for (let i = 0; i < count; i++) {
    const id = `neuron-topic-seed-${i}`;
    const pos = getDeterministicNeuronPosition(id, neurons);
    neurons.push(pos);
  }

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
