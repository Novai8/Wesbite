/**
 * Shadow behaviour for the floating cart. Kept free of React and three.js
 * scene objects so the response curve can be reasoned about and unit tested
 * on its own; `cart-shadow.tsx` only applies the numbers to scene nodes.
 */

export type CartMotion = {
  /** World-space cart position on the ground plane. */
  x: number;
  z: number;
  heading: number;
  /** Travel speed in page pixels per second. */
  speed: number;
  /** World-space velocity, used to drift the shadow against travel. */
  vx: number;
  vz: number;
};

export function createCartMotion(): CartMotion {
  return { x: 0, z: 0, heading: 0.55, speed: 0, vx: 0, vz: 0 };
}

/** Speed, in page pixels per second, at which the shadow reaches full lift. */
export const LIFT_SPEED = 1500;

/**
 * The camera looks almost straight down, so the tall basket covers the ground
 * directly beneath it. The cast is therefore nudged a few percent down-page and
 * to the right, which is where a key light above and up-page would throw it,
 * and that is just enough to stay visible around the silhouette. Values are
 * fractions of the body footprint; `z` is positive down-page in scene space.
 */
export const LIGHT_OFFSET = { x: 0.05, z: 0.22 } as const;

export type ShadowReaction = {
  /** 0 while parked, 1 at full lift. */
  lift: number;
  castOffsetX: number;
  castOffsetZ: number;
  castSpread: number;
  poolSpread: number;
  patchScale: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Pure response curve for the shadow: the cast drifts against the direction of
 * travel and spreads as the cart speeds up, while the contact prints shrink.
 * Together that reads as the cart lifting off the page mid-glide and settling
 * back into a crisp contact print at rest.
 */
export function shadowReaction(
  lift: number,
  velocityX: number,
  velocityZ: number,
  castOffsetX: number,
  castOffsetZ: number,
): ShadowReaction {
  const clamped = clamp01(lift);
  const driftX = -velocityX * 0.012 * clamped;
  const driftZ = -velocityZ * 0.012 * clamped;
  return {
    lift: clamped,
    castOffsetX: castOffsetX + driftX * 0.55,
    castOffsetZ: castOffsetZ + driftZ * 0.55,
    castSpread: 1 + clamped * 0.18,
    poolSpread: 1 + clamped * 0.3,
    patchScale: 1 - clamped * 0.22,
  };
}

/**
 * The light is fixed in the world, but the shadow group inherits the cart
 * heading. Rotating the world-space offset by -heading keeps the cast pointing
 * the same way on screen while the cart turns on the spot.
 */
export function worldOffsetIntoCart(
  offsetX: number,
  offsetZ: number,
  heading: number,
): { x: number; z: number } {
  const cos = Math.cos(-heading);
  const sin = Math.sin(-heading);
  return {
    x: offsetX * cos + offsetZ * sin,
    z: -offsetX * sin + offsetZ * cos,
  };
}
