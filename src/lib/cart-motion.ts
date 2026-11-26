export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass: number;
  maxSpeed: number;
  maxAcceleration: number;
};

export type SpringBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type HeadingBody = {
  angle: number;
  angularVelocity: number;
};

const MAX_SUBSTEP = 1 / 120;

function limitVector(x: number, y: number, max: number): [number, number] {
  const length = Math.hypot(x, y);
  if (length <= max || length === 0) return [x, y];
  const scale = max / length;
  return [x * scale, y * scale];
}

export function stepSpring(
  body: SpringBody,
  targetX: number,
  targetY: number,
  dt: number,
  config: SpringConfig,
): number {
  if (!(dt > 0)) return Math.hypot(body.vx, body.vy);

  const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  const step = dt / steps;

  for (let index = 0; index < steps; index += 1) {
    let ax = ((targetX - body.x) * config.stiffness - body.vx * config.damping) / config.mass;
    let az = ((targetY - body.y) * config.stiffness - body.vy * config.damping) / config.mass;
    [ax, az] = limitVector(ax, az, config.maxAcceleration);

    body.vx += ax * step;
    body.vy += az * step;
    [body.vx, body.vy] = limitVector(body.vx, body.vy, config.maxSpeed);

    body.x += body.vx * step;
    body.y += body.vy * step;
  }

  const offsetX = targetX - body.x;
  const offsetY = targetY - body.y;
  if (Math.hypot(offsetX, offsetY) < 0.8 && Math.hypot(body.vx, body.vy) < 10) {
    body.x = targetX;
    body.y = targetY;
    body.vx = 0;
    body.vy = 0;
  }

  return Math.hypot(body.vx, body.vy);
}

export function normaliseAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value <= -Math.PI) value += Math.PI * 2;
  return value;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function stepHeading(
  body: HeadingBody,
  targetAngle: number,
  speed: number,
  dt: number,
  config: { stiffness: number; damping: number; maxAngularSpeed: number; idleSpeed: number },
): void {
  if (!(dt > 0)) return;

  if (speed < config.idleSpeed) {
    body.angularVelocity *= Math.exp(-config.damping * 0.7 * dt);
    body.angle = normaliseAngle(body.angle + body.angularVelocity * dt);
    return;
  }

  // Scale the steering force with speed: at a crawl the cart should not snap
  // around, and the same spring yields predictable arcs at cruising speed.
  const speedFactor = Math.min(1, (speed - config.idleSpeed) / 260);
  const error = normaliseAngle(targetAngle - body.angle);
  let acceleration =
    error * config.stiffness * speedFactor - body.angularVelocity * config.damping;
  acceleration = Math.max(-45, Math.min(45, acceleration));

  body.angularVelocity += acceleration * dt;
  body.angularVelocity = Math.max(
    -config.maxAngularSpeed,
    Math.min(config.maxAngularSpeed, body.angularVelocity),
  );
  body.angle = normaliseAngle(body.angle + body.angularVelocity * dt);
}

/** Wheel rotation for travel along the wheel's own forward axis, in radians. */
export function rollingDelta(forwardDistance: number, radius: number): number {
  if (radius <= 0) return 0;
  return -forwardDistance / radius;
}

export type PointerTarget = {
  /** Page-space target in CSS pixels. */
  x: number;
  y: number;
};

export function pageTargetFromViewport(
  clientX: number,
  clientY: number,
  scrollX: number,
  scrollY: number,
): PointerTarget {
  return { x: clientX + scrollX, y: clientY + scrollY };
}

/**
 * Signed distance travelled along the cart's forward axis. The supplied model
 * drives toward local -Z, so at heading 0 forward points up the page. Positive
 * values mean the cart is moving in the direction it is facing.
 */
export function forwardTravel(dx: number, dy: number, heading: number): number {
  return -dx * Math.sin(heading) - dy * Math.cos(heading);
}

/**
 * Rotation for the cart. The supplied model's handle points toward +Z and its
 * basket front toward -Z, so the handle trails behind travel. `dx`/`dz` are
 * world velocity components (page +x / page +y).
 */
export function headingToward(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function turnAngle(current: number, target: number): number {
  return normaliseAngle(target - current);
}
