import type { GroundMapping } from "@/lib/cart-space";

export type TrailPoint = {
  /** Document-space CSS pixels. */
  x: number;
  y: number;
  /** Heading in page space, radians. 0 points right. */
  heading: number;
  /** Distance travelled, in page pixels, for tread phase continuity. */
  distance: number;
  /** True when this point starts a new mark rather than joining the last one. */
  breakBefore?: boolean;
};

export type TrailSample = {
  points: TrailPoint[];
  /** Total distance of all dropped points. */
  distance: number;
};

export type TrailRibbonOptions = {
  width: number;
  maxPoints: number;
  minSpacing: number;
  /** Distances above this start a new mark instead of bridging the gap. */
  maxGap: number;
};

const DEFAULTS: TrailRibbonOptions = {
  width: 13,
  maxPoints: 220,
  minSpacing: 5,
  maxGap: 120,
};

export function createTrailSample(): TrailSample {
  return { points: [], distance: 0 };
}

export function clearTrail(sample: TrailSample): void {
  sample.points.length = 0;
  sample.distance = 0;
}

/**
 * Adds a wheel contact point once the wheel has moved far enough. Returns the
 * point newly appended, or null when the sample was too close to the last one.
 */
export function pushTrailPoint(
  sample: TrailSample,
  wheelX: number,
  wheelY: number,
  heading: number,
  options: Partial<TrailRibbonOptions> = {},
): TrailPoint | null {
  const { maxPoints, minSpacing, maxGap } = { ...DEFAULTS, ...options };
  const last = sample.points[sample.points.length - 1];
  const spacing = Math.max(2, minSpacing);

  if (last) {
    const distance = Math.hypot(wheelX - last.x, wheelY - last.y);
    if (distance < spacing) return null;
    if (distance <= maxGap) sample.distance += distance;
  }

  const broken = Boolean(last) && Math.hypot(wheelX - last.x, wheelY - last.y) > maxGap;
  const point: TrailPoint = {
    x: wheelX,
    y: wheelY,
    heading,
    distance: sample.distance,
    breakBefore: broken,
  };
  sample.points.push(point);

  if (sample.points.length > maxPoints) {
    sample.points.splice(0, sample.points.length - maxPoints);
  }

  return point;
}

/** Position (3) + UV (2) + fade (1) per vertex. */
export const RIBBON_FLOATS_PER_VERTEX = 6;

/** Ratio cap for a miter join. Prevents spikes on sharp reversals. */
const MITER_LIMIT = 1.7;

type Vec2 = { x: number; y: number };

function normal(from: Vec2, to: Vec2, half: number): Vec2 | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  return { x: (-dy / length) * half, y: (dx / length) * half };
}

/**
 * Miter offsets for every point. A join whose two segment normals nearly
 * cancel (a hairpin or a reversal) falls back to the incoming segment normal,
 * and the miter length is tiled to MITER_LIMIT, so the ribbon can never
 * explode into a large arc.
 */
function buildOffsets(points: TrailPoint[], half: number): Vec2[] {
  const offsets: Vec2[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    // A break means the wheel jumped; the two runs must not share a join.
    const incoming = previous && !current.breakBefore ? normal(previous, current, half) : null;
    const outgoing = next && !next.breakBefore ? normal(current, next, half) : null;

    if (!incoming && !outgoing) {
      offsets.push({ x: 0, y: 0 });
      continue;
    }
    if (!incoming || !outgoing) {
      offsets.push(incoming ?? outgoing!);
      continue;
    }

    const sumX = incoming.x + outgoing.x;
    const sumY = incoming.y + outgoing.y;
    const sumLength = Math.hypot(sumX, sumY);
    if (sumLength < 1e-3) {
      offsets.push(incoming);
      continue;
    }

    // For a straight run |incoming + outgoing| = 2 * half, so the miter is
    // exactly half a width. Sharper joints stretch it, capped by MITER_LIMIT.
    const ratio = Math.min(MITER_LIMIT, Math.max(1, (2 * half) / sumLength));
    const scale = (half * ratio) / sumLength;
    offsets.push({ x: sumX * scale, y: sumY * scale });
  }
  return offsets;
}

/**
 * Writes a ribbon into `target` (a fixed buffer) and returns the vertex count.
 * Points are document-space CSS pixels; `mapping` converts them to the shared
 * ground surface. Reusing the buffer keeps track updates allocation-free.
 */
export function writeRibbonGeometry(
  points: TrailPoint[],
  width: number,
  distanceOffset: number,
  target: Float32Array,
  mapping: GroundMapping,
): number {
  if (points.length < 2) return 0;

  const segments: Array<[number, number]> = [];
  for (let index = 1; index < points.length; index += 1) {
    if (!points[index].breakBefore) segments.push([index - 1, index]);
  }
  if (segments.length === 0) return 0;
  if (target.length < segments.length * 6 * RIBBON_FLOATS_PER_VERTEX) return 0;

  const half = width / 2;
  const offsets = buildOffsets(points, half);
  const worldX = (x: number) => (x - mapping.originX) / Math.abs(mapping.unitX);
  const worldZ = (y: number) => (y - mapping.originY) / mapping.unitZ;

  let cursor = 0;
  const write = (x: number, z: number, u: number, v: number, fade: number) => {
    target[cursor] = x;
    target[cursor + 1] = 0.8;
    target[cursor + 2] = z;
    target[cursor + 3] = u;
    target[cursor + 4] = v;
    target[cursor + 5] = fade;
    cursor += RIBBON_FLOATS_PER_VERTEX;
  };

  segments.forEach(([aIndex, bIndex], segmentIndex) => {
    const a = points[aIndex];
    const b = points[bIndex];
    const na = offsets[aIndex];
    const nb = offsets[bIndex];
    const ua = a.distance - distanceOffset;
    const ub = b.distance - distanceOffset;
    const fa = segmentIndex / segments.length;
    const fb = (segmentIndex + 1) / segments.length;

    const axL = worldX(a.x - na.x);
    const azL = worldZ(a.y - na.y);
    const axR = worldX(a.x + na.x);
    const azR = worldZ(a.y + na.y);
    const bxL = worldX(b.x - nb.x);
    const bzL = worldZ(b.y - nb.y);
    const bxR = worldX(b.x + nb.x);
    const bzR = worldZ(b.y + nb.y);

    write(axL, azL, ua, 0, fa);
    write(axR, azR, ua, 1, fa);
    write(bxR, bzR, ub, 1, fb);

    write(axL, azL, ua, 0, fa);
    write(bxR, bzR, ub, 1, fb);
    write(bxL, bzL, ub, 0, fb);
  });

  return cursor / RIBBON_FLOATS_PER_VERTEX;
}
