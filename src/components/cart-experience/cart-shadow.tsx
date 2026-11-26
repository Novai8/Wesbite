"use client";

/*
 * The cart floats a little above the page, so its shadow is what sells the
 * height. Three layers do that without a shadow map: a wide ambient pool, a
 * tighter cast blob, and one contact patch per tyre. Every layer is a single
 * quad with a radial shader, so the effect costs a handful of draw calls and no
 * render target. Motion drives it: the shadow spreads and softens with speed,
 * drifts against travel, and tightens back into a crisp contact print as it
 * settles.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, MathUtils, ShaderMaterial } from "three";
import { damp } from "@/lib/cart-motion";
import {
  LIFT_SPEED,
  LIGHT_OFFSET,
  shadowReaction,
  type CartMotion,
  worldOffsetIntoCart,
} from "@/lib/cart-shadow";
import { CART_BOUNDS, CART_FOOTPRINT } from "./cart-model";

/**
 * Every size is a multiple of the cart footprint, so the mark keeps its
 * proportions at all three breakpoints. `strength` is the peak alpha under the
 * cart and `inner` is the fraction of the radius that stays at full strength
 * before the rim feathers out. The pool is the wide ambient wash; the cast is
 * the slightly darker core sitting inside it.
 *
 * Both are deliberately shallower than the cart is long. A true projection of
 * the body would be a low-contrast streak running the full length of the
 * basket, which hides behind the cart and reads as a smear; a wide, shallow
 * blob is what actually looks like ground occlusion from this angle, and it
 * stays visible either side of the wheels while the cart is on top of it.
 */
export const SHADOW_TUNING = {
  pool: { width: 4, depth: 2.1, strength: 0.2, inner: 0.05, flatten: 1 },
  cast: { width: 2.8, depth: 1.55, strength: 0.34, inner: 0.38, flatten: 1 },
  patch: { width: 2.1, depth: 2.9, strength: 0.22, inner: 0.45, flatten: 0.95 },
} as const;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uStrength;
  uniform float uInner;
  uniform float uFlatten;
  varying vec2 vUv;

  void main() {
    // Normalised radial distance: 0 at the centre, 1 at the quad edge.
    vec2 p = (vUv - 0.5) * 2.0;
    p.y /= uFlatten;
    float d = length(p);
    // A flat plateau with a wide feather. Smoothstep reaches zero with a zero
    // gradient, so the quad edge can never show as a hard border, and the
    // plateau keeps the middle solid enough to read beside the cart.
    float alpha = (1.0 - smoothstep(uInner, 1.0, d)) * uStrength;
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(0.008, 0.022, 0.07, alpha);
  }
`;

/**
 * World-space Y of the mark, in scene units (one unit is one CSS pixel on the
 * ground plane, so scales are direct pixel sizes).
 *
 * The cart group sits at y = 0 and CART_PIVOT is exactly the model minimum Y,
 * so the tyre treads are tangent to y = 0: that plane is the contact surface
 * the cart rests on. The three quads are drawn below it, never on it.
 *
 * The offset has to clear the worst case, not the resting pose. While driving,
 * the body leans up to 0.055 rad about Z. The widest point of the basket sits
 * at x = 3.666 model units, so the lean swings it down by
 * 3.666 * sin(0.055) = 0.202 model units. At the desktop scale of 10 that is
 * 2.02 scene units below y = 0; tablet gives 1.49 and mobile 0.81. A quad at
 * ground level, or anywhere above -2.02, would slice through the falling
 * basket and paint the shadow onto it — the artefact this constant prevents.
 * -2.5 therefore clears the worst case at every breakpoint with margin.
 *
 * It costs nothing visually: the camera is orthographic and about 19 degrees
 * off vertical, so dropping the quad by 2.5 units moves its projection by
 * under a CSS pixel. The material is unlit and depthWrite is off, so the
 * height only fixes draw order relative to the cart.
 */
const SHADOW_Y = -2.5;

type ShadowLayer = {
  width: number;
  depth: number;
  strength: number;
  /** Fraction of the radius that stays at full strength before feathering. */
  inner: number;
  flatten: number;
  renderOrder: number;
};

function ShadowQuad({ layer }: { layer: ShadowLayer }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uStrength: { value: layer.strength },
          uInner: { value: layer.inner },
          uFlatten: { value: layer.flatten },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [layer],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={layer.renderOrder}>
      <planeGeometry args={[layer.width, layer.depth]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

type CartShadowProps = {
  motionRef: React.RefObject<CartMotion>;
  scale: number;
  /** Static mode parks the cart, so the shadow must not react to motion. */
  interactive: boolean;
};

export function CartShadow({ motionRef, scale, interactive }: CartShadowProps) {
  const groupRef = useRef<Group>(null);
  const poseRef = useRef({ x: Number.NaN, z: Number.NaN, lift: 0 });
  const patchesRef = useRef<Group>(null);
  const poolRef = useRef<Group>(null);
  const castRef = useRef<Group>(null);

  const gauge = CART_FOOTPRINT.halfGauge * scale;
  const bodyWidth = (CART_BOUNDS.max.x - CART_BOUNDS.min.x) * scale;
  const bodyLength = (CART_BOUNDS.max.z - CART_BOUNDS.min.z) * scale;
  // Light comes from above and slightly up-page, so the mark sits a little
  // below and to the right of the cart rather than directly under it.
  const lightOffsetX = bodyWidth * LIGHT_OFFSET.x;
  const lightOffsetZ = bodyLength * LIGHT_OFFSET.z;

  const pool = useMemo<ShadowLayer>(
    () => ({
      width: bodyWidth * SHADOW_TUNING.pool.width,
      depth: bodyLength * SHADOW_TUNING.pool.depth,
      strength: SHADOW_TUNING.pool.strength,
      inner: SHADOW_TUNING.pool.inner,
      flatten: SHADOW_TUNING.pool.flatten,
      renderOrder: -3,
    }),
    [bodyWidth, bodyLength],
  );

  const cast = useMemo<ShadowLayer>(
    () => ({
      width: bodyWidth * SHADOW_TUNING.cast.width,
      depth: bodyLength * SHADOW_TUNING.cast.depth,
      strength: SHADOW_TUNING.cast.strength,
      inner: SHADOW_TUNING.cast.inner,
      flatten: SHADOW_TUNING.cast.flatten,
      renderOrder: -2,
    }),
    [bodyWidth, bodyLength],
  );

  const patch = useMemo<ShadowLayer>(
    () => ({
      width: CART_FOOTPRINT.wheelWidth * scale * SHADOW_TUNING.patch.width,
      depth: CART_FOOTPRINT.wheelRadius * scale * SHADOW_TUNING.patch.depth,
      strength: SHADOW_TUNING.patch.strength,
      inner: SHADOW_TUNING.patch.inner,
      flatten: SHADOW_TUNING.patch.flatten,
      renderOrder: -1,
    }),
    [scale],
  );

  const patchPoints = useMemo(
    () => [
      { x: -gauge, z: CART_FOOTPRINT.rearAxleZ * scale },
      { x: gauge, z: CART_FOOTPRINT.rearAxleZ * scale },
      { x: -gauge, z: CART_FOOTPRINT.frontAxleZ * scale },
      { x: gauge, z: CART_FOOTPRINT.frontAxleZ * scale },
    ],
    [gauge, scale],
  );

  useFrame((_state, delta) => {
    const group = groupRef.current;
    const motion = motionRef.current;
    if (!group || !motion) return;

    const dt = Math.min(0.05, delta);
    const pose = poseRef.current;
    // 0 when parked, 1 at a brisk flick of the pointer.
    const lift = interactive ? MathUtils.clamp(motion.speed / LIFT_SPEED, 0, 1) : 0;

    if (!Number.isFinite(pose.x) || !interactive) {
      // Static mode renders on demand, so there is no continuous loop in which
      // a damped pose could converge. Snap instead of easing, otherwise the
      // mark freezes part-way towards the parked cart.
      pose.x = motion.x;
      pose.z = motion.z;
      pose.lift = lift;
    } else {
      pose.x = damp(pose.x, motion.x, 26, dt);
      pose.z = damp(pose.z, motion.z, 26, dt);
      pose.lift = damp(pose.lift, lift, 6, dt);
    }

    // The ambient wash stays aligned to the page rather than to the cart, so a
    // turning cart does not swing an obviously oval shadow underneath it.
    group.position.set(pose.x, SHADOW_Y, pose.z);
    group.rotation.y = 0;

    const reaction = shadowReaction(
      pose.lift,
      motion.vx,
      motion.vz,
      lightOffsetX,
      lightOffsetZ,
    );
    if (castRef.current) {
      castRef.current.position.set(reaction.castOffsetX, 0, reaction.castOffsetZ);
      castRef.current.scale.set(reaction.castSpread, 1, reaction.castSpread);
    }
    if (poolRef.current) {
      poolRef.current.scale.set(reaction.poolSpread, 1, reaction.poolSpread);
    }
    if (patchesRef.current) {
      // Contact prints do follow the cart, so their offset is a page-space
      // vector rotated into the cart frame.
      const patchLocal = worldOffsetIntoCart(
        reaction.castOffsetX * 0.4,
        reaction.castOffsetZ * 0.4,
        motion.heading,
      );
      patchesRef.current.position.set(patchLocal.x, 0, patchLocal.z);
      patchesRef.current.rotation.y = motion.heading;
      patchesRef.current.scale.setScalar(reaction.patchScale);
    }
  });

  return (
    <group ref={groupRef} name="FyndraCartShadow">
      <group ref={poolRef}>
        <ShadowQuad layer={pool} />
      </group>
      <group ref={castRef}>
        <ShadowQuad layer={cast} />
      </group>
      <group ref={patchesRef}>
        {patchPoints.map((point, index) => (
          <group key={index} position={[point.x, 0, point.z]}>
            <ShadowQuad layer={patch} />
          </group>
        ))}
      </group>
    </group>
  );
}
