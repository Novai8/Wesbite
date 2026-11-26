import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forwardTravel,
  headingToward,
  normaliseAngle,
  rollingDelta,
  stepHeading,
  stepSpring,
  type HeadingBody,
  type SpringBody,
} from "@/lib/cart-motion";
import {
  createTrailSample,
  pushTrailPoint,
  writeRibbonGeometry,
  RIBBON_FLOATS_PER_VERTEX,
} from "@/components/cart-experience/trail-buffer";
import { CART_FOOTPRINT, trackWidthForScale } from "@/components/cart-experience/cart-model";
import { LIFT_SPEED, shadowReaction, worldOffsetIntoCart } from "@/lib/cart-shadow";
import type { GroundMapping } from "@/lib/cart-space";

import "./setup.ts";

const SPRING = {
  stiffness: 36,
  damping: 12.2,
  mass: 1,
  maxSpeed: 1900,
  maxAcceleration: 5200,
};

test("spring accelerates toward the target and settles without overshooting forever", () => {
  const body: SpringBody = { x: 0, y: 0, vx: 0, vy: 0 };
  stepSpring(body, 400, 0, 1 / 60, SPRING);
  assert.ok(body.vx > 0, "cart should accelerate toward the pointer");
  assert.ok(body.x > 0 && body.x < 400, "first step should not teleport");

  for (let step = 0; step < 240; step += 1) {
    stepSpring(body, 400, 0, 1 / 60, SPRING);
  }
  assert.equal(body.x, 400);
  assert.equal(body.vx, 0);
});

test("spring caps acceleration and speed", () => {
  const body: SpringBody = { x: 0, y: 0, vx: 0, vy: 0 };
  for (let step = 0; step < 600; step += 1) {
    stepSpring(body, 100_000, 0, 1 / 60, SPRING);
    assert.ok(Math.hypot(body.vx, body.vy) <= SPRING.maxSpeed + 1e-6);
  }
});

test("heading turns smoothly instead of snapping to the travel direction", () => {
  const heading: HeadingBody = { angle: 0, angularVelocity: 0 };
  const config = { stiffness: 42, damping: 10.5, maxAngularSpeed: 5, idleSpeed: 10 };
  stepHeading(heading, Math.PI / 2, 600, 1 / 60, config);
  assert.ok(heading.angle > 0 && heading.angle < Math.PI / 2);
  for (let step = 0; step < 300; step += 1) {
    stepHeading(heading, Math.PI / 2, 600, 1 / 60, config);
  }
  assert.ok(Math.abs(normaliseAngle(heading.angle - Math.PI / 2)) < 0.02);
});

test("heading stays put when the cart is stationary", () => {
  const heading: HeadingBody = { angle: 0.4, angularVelocity: 0 };
  for (let step = 0; step < 60; step += 1) {
    stepHeading(heading, 2.5, 0, 1 / 60, {
      stiffness: 42,
      damping: 10.5,
      maxAngularSpeed: 5,
      idleSpeed: 10,
    });
  }
  assert.ok(Math.abs(heading.angle - 0.4) < 1e-6);
});

test("wheel roll is derived from travelled distance, not elapsed time", () => {
  const radius = 30;
  const oneTurn = 2 * Math.PI * radius;
  assert.ok(Math.abs(Math.abs(rollingDelta(oneTurn, radius)) - 2 * Math.PI) < 1e-9);
  assert.ok(rollingDelta(0, radius) === 0);
  assert.equal(rollingDelta(10, 0), 0);
});

test("headingToward matches the model's forward axis", () => {
  // The supplied cart drives toward its local -Z, so +Z is its rear.
  assert.ok(Math.abs(headingToward(0, -1)) < 1e-9);
  assert.ok(Math.abs(Math.abs(headingToward(1, 0)) - Math.PI / 2) < 1e-9);
});

test("forwardTravel is zero when moving sideways to the cart", () => {
  const sideways = forwardTravel(10, 0, headingToward(0, -10));
  assert.ok(Math.abs(sideways) < 1e-9);
  assert.ok(forwardTravel(0, -10, headingToward(0, -10)) > 0);
});

const mapping: GroundMapping = {
  originX: 720,
  originY: 450,
  unitX: 1,
  unitZ: -0.945,
};

test("trail points require real travel before being recorded", () => {
  const sample = createTrailSample();
  assert.ok(pushTrailPoint(sample, 100, 100, 0, { minSpacing: 5 }));
  assert.equal(pushTrailPoint(sample, 101, 100, 0, { minSpacing: 5 }), null);
  assert.ok(pushTrailPoint(sample, 110, 100, 0, { minSpacing: 5 }));
  assert.equal(sample.points.length, 2);
});

test("trail point count stays bounded", () => {
  const sample = createTrailSample();
  for (let index = 0; index < 500; index += 1) {
    pushTrailPoint(sample, index * 10, 0, 0, { maxPoints: 50, minSpacing: 5 });
  }
  assert.equal(sample.points.length, 50);
});

test("a long jump starts a new mark instead of bridging the page", () => {
  const sample = createTrailSample();
  pushTrailPoint(sample, 0, 0, 0, { maxGap: 100, minSpacing: 5 });
  pushTrailPoint(sample, 50, 0, 0, { maxGap: 100, minSpacing: 5 });
  const latest = pushTrailPoint(sample, 900, 0, 0, { maxGap: 100, minSpacing: 5 });
  assert.equal(latest?.breakBefore, true);

  const target = new Float32Array(6 * 6 * RIBBON_FLOATS_PER_VERTEX);
  const vertices = writeRibbonGeometry(sample.points, 12, 0, target, mapping);
  // Only the short run before the jump is drawn; no band bridges the gap.
  assert.equal(vertices, 6);
  const bridged = writeRibbonGeometry(
    sample.points.map((point) => ({ ...point, breakBefore: false })),
    12,
    0,
    new Float32Array(20 * 6 * RIBBON_FLOATS_PER_VERTEX),
    mapping,
  );
  assert.ok(bridged > vertices, "a bridged ribbon would have more segments");
});

test("a straight ribbon stays close to the tyre width", () => {
  const sample = createTrailSample();
  for (let index = 0; index <= 10; index += 1) {
    pushTrailPoint(sample, 100 + index * 12, 200, 0, { minSpacing: 5 });
  }
  const target = new Float32Array(20 * 6 * RIBBON_FLOATS_PER_VERTEX);
  const width = 12;
  const vertices = writeRibbonGeometry(sample.points, width, 0, target, mapping);
  assert.ok(vertices > 0);

  // Vertex 1 starts at float index 6: (x, y, z, u, v, fade).
  const edge = Math.hypot(target[6] - target[0], target[8] - target[2]);
  // One world unit is one page pixel horizontally; allow for compression.
  assert.ok(edge > width * 0.7 && edge < width * 1.4, `unexpected edge ${edge}`);
});

test("a hairpin ribbon never spikes far past its width", () => {
  const sample = createTrailSample();
  const points = [
    [400, 200],
    [300, 200],
    [400, 200],
    [300, 200],
  ] as const;
  let distance = 0;
  sample.points.push({ x: points[0][0], y: points[0][1], heading: 0, distance });
  for (let index = 1; index < points.length; index += 1) {
    distance += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    sample.points.push({ x: points[index][0], y: points[index][1], heading: 0, distance });
  }

  const target = new Float32Array(10 * 6 * RIBBON_FLOATS_PER_VERTEX);
  const vertices = writeRibbonGeometry(sample.points, 12, 0, target, mapping);
  assert.ok(vertices > 0);

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < vertices; index += 1) {
    minZ = Math.min(minZ, target[index * RIBBON_FLOATS_PER_VERTEX + 2]);
    maxZ = Math.max(maxZ, target[index * RIBBON_FLOATS_PER_VERTEX + 2]);
  }
  assert.ok(maxZ - minZ < 40, `hairpin would balloon to ${maxZ - minZ}`);
});

test("the two tyre paths cannot overlap", () => {
  for (const scale of [4, 7.4, 10]) {
    const trackWidth = trackWidthForScale(scale);
    assert.ok(
      CART_FOOTPRINT.halfGauge * 2 * scale > trackWidth,
      `tracks would overlap at scale ${scale}`,
    );
  }
});

test("a tyre mark is drawn exactly as wide as the tyre", () => {
  for (const scale of [4, 7.4, 10]) {
    assert.equal(trackWidthForScale(scale), CART_FOOTPRINT.wheelWidth * scale);
  }
});

test("a parked cart casts a tight, un-drifted shadow", () => {
  const reaction = shadowReaction(0, 0, 0, 12, 8);
  assert.equal(reaction.lift, 0);
  assert.equal(reaction.castOffsetX, 12);
  assert.equal(reaction.castOffsetZ, 8);
  assert.equal(reaction.castSpread, 1);
  assert.equal(reaction.poolSpread, 1);
  assert.equal(reaction.patchScale, 1);
});

test("speed spreads the shadow and shrinks the contact prints", () => {
  const rest = shadowReaction(0, 0, 0, 0, 0);
  const fast = shadowReaction(1, 0, 0, 0, 0);
  assert.ok(fast.castSpread > rest.castSpread, "cast should widen with speed");
  assert.ok(fast.poolSpread > rest.poolSpread, "ambient pool should widen with speed");
  assert.ok(fast.patchScale < rest.patchScale, "contact prints should shrink with speed");
});

test("the cast drifts against the direction of travel", () => {
  const rightward = shadowReaction(1, 1000, 0, 0, 0);
  assert.ok(rightward.castOffsetX < 0, "a rightward cart should trail its shadow left");
  const downward = shadowReaction(1, 0, 1000, 0, 0);
  assert.ok(downward.castOffsetZ < 0, "a down-page cart should trail its shadow up-page");
});

test("lift is clamped so a runaway velocity cannot blow the shadow up", () => {
  const wild = shadowReaction(LIFT_SPEED * 50, 0, 0, 0, 0);
  assert.equal(wild.lift, 1);
  assert.ok(wild.castSpread <= 1.18 + 1e-9);
  assert.ok(wild.patchScale >= 0.78 - 1e-9);
});

test("a fixed world-space cast offset stays fixed as the cart turns", () => {
  // Rotating by the cart heading (and back) must reproduce the offset.
  for (const heading of [0, 0.7, -1.9, Math.PI]) {
    const local = worldOffsetIntoCart(30, -45, heading);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    const backX = local.x * cos + local.z * sin;
    const backZ = -local.x * sin + local.z * cos;
    assert.ok(Math.abs(backX - 30) < 1e-9, `x drifted at heading ${heading}`);
    assert.ok(Math.abs(backZ + 45) < 1e-9, `z drifted at heading ${heading}`);
  }
});
