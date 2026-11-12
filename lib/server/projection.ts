import { Event } from './cluster';
import {
  inBrain,
  leftCenter,
  rightCenter,
  bridgeCenter,
  frontalCenter,
  occipitalCenter,
  hemiRadius,
  bridgeRadius,
  lobeRadius,
  distance3,
  yOffset,
} from '../neuronPosition';
import { cosineSimilarity } from './embeddings';

export interface SimilarityEdge {
  fromId: string;
  toId: string;
  fromPosition: [number, number, number];
  toPosition: [number, number, number];
  similarity: number;
}

// 15 distinct, well-separated anatomical locations covering front, back, top, bottom, left, right, and center
export const ANATOMICAL_15_POSITIONS: Array<[number, number, number]> = [
  [-0.7, 0.85, 0.7],    // 0: Front-top-left
  [0.7, 0.85, 0.7],     // 1: Front-top-right
  [0.0, 0.5, 1.1],      // 2: Front-center (frontal pole)
  [-0.6, -0.15, 0.6],   // 3: Front-bottom-left
  [0.6, -0.15, 0.6],    // 4: Front-bottom-right
  [-0.95, 1.05, 0.0],   // 5: Top-left cortex
  [0.95, 1.05, 0.0],    // 6: Top-right cortex
  [0.0, 1.15, 0.0],     // 7: Top-center crown
  [-0.75, 0.75, -0.75], // 8: Back-top-left
  [0.75, 0.75, -0.75],  // 9: Back-top-right
  [0.0, 0.4, -1.05],    // 10: Back-center (occipital pole)
  [-1.25, -0.2, 0.0],   // 11: Bottom-left (temporal lobe)
  [1.25, -0.2, 0.0],    // 12: Bottom-right (temporal lobe)
  [0.0, -0.4, -0.3],    // 13: Bottom-center (stem / cerebellum)
  [0.0, 0.35, 0.0],     // 14: Central core
];

export const PROJECTION_MIN_DIST = 0.50;

const BRAIN_REGIONS = [
  { center: leftCenter, radius: hemiRadius },
  { center: rightCenter, radius: hemiRadius },
  { center: frontalCenter, radius: lobeRadius },
  { center: occipitalCenter, radius: lobeRadius },
  { center: bridgeCenter, radius: bridgeRadius },
];

export function clampInsideBrain(p: [number, number, number]): [number, number, number] {
  if (inBrain(p)) return p;

  let bestDist = Infinity;
  let bestRegion = BRAIN_REGIONS[0];

  for (const region of BRAIN_REGIONS) {
    const d = distance3(p, region.center);
    if (d < bestDist) {
      bestDist = d;
      bestRegion = region;
    }
  }

  const { center, radius } = bestRegion;
  const ux = (p[0] - center[0]) / radius.x;
  const uy = (p[1] - center[1]) / radius.y;
  const uz = (p[2] - center[2]) / radius.z;
  const norm = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;

  const scale = 0.88 / norm;
  return [
    center[0] + ux * scale * radius.x,
    center[1] + uy * scale * radius.y,
    center[2] + uz * scale * radius.z,
  ];
}

/**
 * Pure PCA projection from D-dimensional space to 3D space with Power Iteration & Deflation.
 */
export function projectCentroidsWithPca(
  centroids: number[][]
): Array<[number, number, number]> {
  const n = centroids.length;
  if (n === 0) return [];
  if (n === 1) {
    return [[0, yOffset, 0]];
  }

  const dim = centroids[0].length;

  const mean = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      mean[d] += centroids[i][d];
    }
  }
  for (let d = 0; d < dim; d++) {
    mean[d] /= n;
  }

  let X: number[][] = centroids.map((row) => row.map((val, d) => val - mean[d]));
  const projected: Array<[number, number, number]> = Array.from({ length: n }, () => [0, 0, 0]);

  for (let k = 0; k < 3; k++) {
    let v = new Array(dim).fill(0).map((_, i) => Math.sin(i * 1.5 + k * 10) || 0.1);
    let vNorm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map((x) => x / (vNorm || 1));

    const iterations = 35;
    for (let it = 0; it < iterations; it++) {
      const u = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let d = 0; d < dim; d++) {
          sum += X[i][d] * v[d];
        }
        u[i] = sum;
      }

      const w = new Array(dim).fill(0);
      for (let d = 0; d < dim; d++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
          sum += X[i][d] * u[i];
        }
        w[d] = sum;
      }

      const wNorm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      if (wNorm < 1e-10) break;
      v = w.map((x) => x / wNorm);
    }

    let maxAbs = 0;
    let maxAbsVal = 0;
    for (let d = 0; d < dim; d++) {
      if (Math.abs(v[d]) > maxAbs) {
        maxAbs = Math.abs(v[d]);
        maxAbsVal = v[d];
      }
    }
    if (maxAbsVal < 0) {
      v = v.map((x) => -x);
    }

    const pk = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let d = 0; d < dim; d++) {
        sum += X[i][d] * v[d];
      }
      pk[i] = sum;
      projected[i][k] = sum;
    }

    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) {
        X[i][d] -= pk[i] * v[d];
      }
    }
  }

  return projected;
}

/**
 * Pure projection of events across the full anatomical volume of the brain.
 * When <= 15 events, maps them semantically into the 15 distinct anatomical anchor zones.
 */
export function projectEventsToBrain(
  events: Event[]
): Event[] {
  const n = events.length;
  if (n === 0) return [];
  if (n === 1) {
    const single = { ...events[0] };
    single.position = [0, yOffset, 0];
    return [single];
  }

  const centroids = events.map((e) => e.centroid);
  const rawPca = projectCentroidsWithPca(centroids);

  // If we have <= 15 events, assign each event to one of the 15 anatomical zones
  if (n <= ANATOMICAL_15_POSITIONS.length) {
    // Normalize raw PCA vectors
    const normPca = rawPca.map((p) => {
      const mag = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
      return [p[0] / mag, p[1] / mag, p[2] / mag] as [number, number, number];
    });

    const assignedPositions: Array<[number, number, number]> = new Array(n);
    const usedAnchors = new Set<number>();

    // Greedy matching based on cosine similarity between PCA direction and anchor direction
    for (let i = 0; i < n; i++) {
      const p = normPca[i];
      let bestScore = -Infinity;
      let bestAnchorIdx = -1;

      for (let a = 0; a < ANATOMICAL_15_POSITIONS.length; a++) {
        if (usedAnchors.has(a)) continue;
        const anchor = ANATOMICAL_15_POSITIONS[a];
        const aMag = Math.sqrt(anchor[0] * anchor[0] + anchor[1] * anchor[1] + anchor[2] * anchor[2]) || 1;
        const score = (p[0] * anchor[0] + p[1] * anchor[1] + p[2] * anchor[2]) / aMag;

        if (score > bestScore) {
          bestScore = score;
          bestAnchorIdx = a;
        }
      }

      if (bestAnchorIdx === -1) {
        // Fallback to first unused
        for (let a = 0; a < ANATOMICAL_15_POSITIONS.length; a++) {
          if (!usedAnchors.has(a)) {
            bestAnchorIdx = a;
            break;
          }
        }
      }

      usedAnchors.add(bestAnchorIdx);
      assignedPositions[i] = ANATOMICAL_15_POSITIONS[bestAnchorIdx];
    }

    return events.map((ev, idx) => ({
      ...ev,
      position: assignedPositions[idx],
    }));
  }

  // Fallback for > 15 events: PCA + continuous spreading
  const mean = [0, 0, 0];
  const std = [0, 0, 0];

  for (let k = 0; k < 3; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rawPca[i][k];
    mean[k] = sum / n;

    let varianceSum = 0;
    for (let i = 0; i < n; i++) {
      const diff = rawPca[i][k] - mean[k];
      varianceSum += diff * diff;
    }
    std[k] = Math.sqrt(varianceSum / n) || 1;
  }

  let positions: Array<[number, number, number]> = rawPca.map((p) => {
    const z0 = (p[0] - mean[0]) / std[0];
    const z1 = (p[1] - mean[1]) / std[1];
    const z2 = (p[2] - mean[2]) / std[2];

    const normX = Math.tanh(z0 * 1.1);
    const normY = Math.tanh(z1 * 1.1);
    const normZ = Math.tanh(z2 * 1.1);

    const x = normX * 1.6;
    const y = yOffset + normY * 0.85;
    const z = normZ * 1.35;

    return clampInsideBrain([x, y, z]);
  });

  const passes = 60;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = distance3(positions[i], positions[j]);
        if (d < PROJECTION_MIN_DIST) {
          const overlap = PROJECTION_MIN_DIST - d;
          let dx = positions[i][0] - positions[j][0];
          let dy = positions[i][1] - positions[j][1];
          let dz = positions[i][2] - positions[j][2];

          if (d < 0.001) {
            dx = Math.sin(i * 7 + pass);
            dy = Math.cos(j * 5 + pass);
            dz = Math.sin(pass * 3);
          } else {
            dx /= d;
            dy /= d;
            dz /= d;
          }

          const push = overlap * 0.52;
          positions[i] = clampInsideBrain([
            positions[i][0] + dx * push,
            positions[i][1] + dy * push,
            positions[i][2] + dz * push,
          ]);

          positions[j] = clampInsideBrain([
            positions[j][0] - dx * push,
            positions[j][1] - dy * push,
            positions[j][2] - dz * push,
          ]);
        }
      }
    }
  }

  return events.map((ev, idx) => ({
    ...ev,
    position: positions[idx],
  }));
}

/**
 * Connect each event to its top 3 most similar events (cosine >= threshold).
 */
export function computeSimilarityEdges(
  events: Event[],
  threshold: number = 0.15
): { eventsWithEdges: Event[]; edges: SimilarityEdge[] } {
  const edges: SimilarityEdge[] = [];
  const edgeSet = new Set<string>();

  const eventsWithEdges = events.map((event, i) => {
    const similarities: Array<{ id: string; index: number; similarity: number }> = [];

    for (let j = 0; j < events.length; j++) {
      if (i === j) continue;
      const sim = cosineSimilarity(event.centroid, events[j].centroid);
      if (sim >= threshold) {
        similarities.push({ id: events[j].id, index: j, similarity: sim });
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    const top3 = similarities.slice(0, 3);
    const similarEventIds = top3.map((s) => s.id);

    for (const match of top3) {
      const pairKey = [event.id, match.id].sort().join('::');
      if (!edgeSet.has(pairKey)) {
        edgeSet.add(pairKey);
        if (event.position && events[match.index].position) {
          edges.push({
            fromId: event.id,
            toId: match.id,
            fromPosition: event.position,
            toPosition: events[match.index].position!,
            similarity: Number(match.similarity.toFixed(4)),
          });
        }
      }
    }

    return {
      ...event,
      similarEventIds,
    };
  });

  return { eventsWithEdges, edges };
}
