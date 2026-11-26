"use client";

/*
 * React Three Fiber drives the scene imperatively from `useFrame`: camera
 * frustums, wheel pivots and shader buffers are mutated every frame by design.
 * The React Compiler immutability rules flag that pattern even though it is the
 * documented R3F approach, so they are disabled for this file only.
 */
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Environment, Lightformer } from "@react-three/drei";
import { Group, MathUtils, OrthographicCamera } from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import {
  damp,
  forwardTravel,
  headingToward,
  pageTargetFromViewport,
  rollingDelta,
  stepHeading,
  stepSpring,
  type HeadingBody,
  type SpringBody,
} from "@/lib/cart-motion";
import {
  deriveGroundMapping,
  pageToWorld,
  surfaceScrollOffset,
  type GroundMapping,
} from "@/lib/cart-space";
import {
  buildCartModel,
  CART_FOOTPRINT,
  CART_MODEL_URL,
  trackWidthForScale,
} from "./cart-model";
import {
  clearTrail,
  createTrailSample,
  pushTrailPoint,
  type TrailSample,
} from "./trail-buffer";
import { TrailMesh } from "./trail-mesh";
import { CartShadow } from "./cart-shadow";
import { createCartMotion } from "@/lib/cart-shadow";

/**
 * One world unit is one CSS pixel on the ground plane, so the cart's apparent
 * size is expressed directly in pixels. The supplied OBJ is ~18.4 model units
 * deep, which reads as a ~520px footprint on a desktop hero.
 */
const CART_SCALE = { desktop: 10, tablet: 7.4, mobile: 4 } as const;
const IS_TABLET_QUERY = "(max-width: 1023px)";
const IS_MOBILE_QUERY = "(max-width: 767px)";

const SPRING = {
  stiffness: 36,
  damping: 12.2,
  mass: 1,
  maxSpeed: 1900,
  maxAcceleration: 5200,
};

const HEADING = {
  stiffness: 42,
  damping: 10.5,
  maxAngularSpeed: 5,
  idleSpeed: 10,
};

type StageMode = "interactive" | "static";

type StageProps = {
  mode?: StageMode;
  paused?: boolean;
  onReady?: () => void;
};

type CartSceneProps = {
  mode: StageMode;
  mobile: boolean;
  scale: number;
  staticScale: number;
  mappingRef: React.RefObject<GroundMapping>;
  maxTrailPoints: number;
  onReady?: () => void;
};

type PointerState = {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  active: boolean;
};

function usePagePointer(ref: React.RefObject<PointerState>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const store = (clientX: number, clientY: number) => {
      const target = pageTargetFromViewport(clientX, clientY, window.scrollX, window.scrollY);
      ref.current.clientX = clientX;
      ref.current.clientY = clientY;
      ref.current.x = target.x;
      ref.current.y = target.y;
      ref.current.active = true;
    };

    const update = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      store(event.clientX, event.clientY);
    };

    // Scrolling moves the page under a stationary cursor, so the target has to
    // be re-projected; otherwise the cart would be left behind by the scroll.
    const onScroll = () => {
      if (!ref.current.active) return;
      store(ref.current.clientX, ref.current.clientY);
    };

    window.addEventListener("pointermove", update, { passive: true });
    window.addEventListener("pointerdown", update, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerdown", update);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled, ref]);
}

/** Keeps the render loop off while the tab is hidden or motion is disabled. */
function FrameloopControl({ mode, paused }: { mode: StageMode; paused: boolean }) {
  const setFrameloop = useThree((state) => state.setFrameloop);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (paused) {
      setFrameloop("never");
      return;
    }
    setFrameloop(mode === "static" ? "demand" : "always");
    invalidate();
  }, [invalidate, mode, paused, setFrameloop]);

  return null;
}

function CartDriver({
  mode,
  mobile,
  scale,
  staticScale,
  mappingRef,
  maxTrailPoints,
  onReady,
}: CartSceneProps) {
  const source = useLoader(OBJLoader, CART_MODEL_URL);
  const model = useMemo(() => buildCartModel(source), [source]);
  const cartRef = useRef<Group>(null);
  const leanRef = useRef<Group>(null);
  const pointerRef = useRef<PointerState>({
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
    active: false,
  });
  const bodyRef = useRef<SpringBody>({ x: 0, y: 0, vx: 0, vy: 0 });
  const headingRef = useRef<HeadingBody>({ angle: 0.55, angularVelocity: 0 });
  const initializedRef = useRef(false);
  const wheelAngleRef = useRef(0);
  const steerRef = useRef(0);
  const trailLeftRef = useRef(createTrailSample());
  const trailRightRef = useRef(createTrailSample());
  const motionRef = useRef(createCartMotion());
  const revisionRef = useRef(0);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const { size, invalidate } = useThree();
  const interactive = mode === "interactive";
  const wheelRadius = CART_FOOTPRINT.wheelRadius * scale;
  const trackWidth = trackWidthForScale(scale);

  usePagePointer(pointerRef, interactive);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  // Static mode renders on demand, so position the parked cart once and then
  // ask for a single frame rather than running a continuous loop.
  useEffect(() => {
    if (interactive || !ready) return;
    const cart = cartRef.current;
    const lean = leanRef.current;
    if (!cart || !lean) return;
    const offset = mobile ? 0 : size.width * 0.24;
    cart.position.set(offset, 0, mobile ? 70 : 40);
    cart.rotation.y = -0.55;
    Object.assign(motionRef.current, {
      x: cart.position.x,
      z: cart.position.z,
      heading: cart.rotation.y,
      speed: 0,
      vx: 0,
      vz: 0,
    });
    lean.rotation.z = 0;
    lean.scale.setScalar(staticScale);
    for (const wheel of model.wheels) {
      wheel.pivot.rotation.set(0, 0, 0);
    }
    invalidate();
  }, [interactive, invalidate, mobile, model, ready, size.width, staticScale]);

  useEffect(() => () => model.dispose(), [model]);

  useEffect(() => {
    initializedRef.current = false;
    clearTrail(trailLeftRef.current);
    clearTrail(trailRightRef.current);
    revisionRef.current += 1;
    invalidate();
  }, [invalidate, size.height, size.width]);

  useFrame((_state, delta) => {
    const cart = cartRef.current;
    const lean = leanRef.current;
    if (!cart || !lean || !interactive) return;

    const dt = Math.min(0.05, delta);
    const mapping = mappingRef.current;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const centerX = scrollX + size.width / 2;
    const centerY = scrollY + size.height / 2;
    const body = bodyRef.current;
    const heading = headingRef.current;

    if (!initializedRef.current) {
      initializedRef.current = true;
      body.x = centerX;
      body.y = centerY + size.height * 0.04;
    }

    const pointer = pointerRef.current;
    const targetX = pointer.active ? pointer.x : body.x;
    const targetY = pointer.active ? pointer.y : body.y;
    const previousX = body.x;
    const previousY = body.y;

    stepSpring(body, targetX, targetY, dt, SPRING);
    const speed = Math.hypot(body.vx, body.vy);
    if (speed > HEADING.idleSpeed) {
      stepHeading(heading, headingToward(body.vx, body.vy), speed, dt, HEADING);
    } else {
      stepHeading(heading, heading.angle, 0, dt, HEADING);
    }

    const world = pageToWorld(body.x, body.y, scrollX, scrollY, mapping);
    cart.position.set(world.x, 0, world.z);
    cart.rotation.y = heading.angle;

    const motion = motionRef.current;
    motion.x = world.x;
    motion.z = world.z;
    motion.heading = heading.angle;
    motion.speed = speed;
    motion.vx = body.vx * mapping.unitX;
    motion.vz = body.vy * mapping.unitZ;

    const dx = body.x - previousX;
    const dy = body.y - previousY;
    const forward = forwardTravel(dx, dy, heading.angle);
    wheelAngleRef.current += rollingDelta(forward, wheelRadius);

    const cos = Math.cos(heading.angle);
    const sin = Math.sin(heading.angle);
    const lateral = body.vx * cos + body.vy * sin;
    lean.rotation.z = damp(lean.rotation.z, MathUtils.clamp(lateral * 0.00003, -0.055, 0.055), 7, dt);

    steerRef.current = damp(
      steerRef.current,
      MathUtils.clamp(heading.angularVelocity * 0.13, -0.34, 0.34),
      9,
      dt,
    );

    for (const wheel of model.wheels) {
      wheel.pivot.rotation.x = wheelAngleRef.current;
      wheel.pivot.rotation.y = wheel.axle === "front" ? steerRef.current : 0;
    }

    const rearAxle = CART_FOOTPRINT.rearAxleZ * scale;
    const gauge = CART_FOOTPRINT.halfGauge * scale;
    const toPage = (localX: number, localZ: number) => ({
      x: body.x + (localX * cos + localZ * sin) * mapping.unitX,
      y: body.y + (-localX * sin + localZ * cos) * mapping.unitZ,
    });
    const left = toPage(-gauge, rearAxle);
    const right = toPage(gauge, rearAxle);
    const spacing = mobile ? 3 : 2;
    pushTrailPoint(trailLeftRef.current, left.x, left.y, heading.angle, {
      maxPoints: maxTrailPoints,
      minSpacing: spacing,
    });
    pushTrailPoint(trailRightRef.current, right.x, right.y, heading.angle, {
      maxPoints: maxTrailPoints,
      minSpacing: spacing,
    });
    revisionRef.current += 1;
  });

  return (
    <>
      <group ref={cartRef} name="FyndraCart">
        <group ref={leanRef} scale={interactive ? scale : staticScale}>
          <primitive object={model.root} />
        </group>
      </group>
      {/* The parked cart is drawn at `staticScale`, so the shadow has to use
          the same resolved scale or it no longer matches the body it grounds. */}
      <CartShadow
        motionRef={motionRef}
        scale={interactive ? scale : staticScale}
        interactive={interactive}
      />
      <TyreTracks
        leftRef={trailLeftRef}
        rightRef={trailRightRef}
        revisionRef={revisionRef}
        width={trackWidth}
        mappingRef={mappingRef}
        enabled={interactive}
      />
    </>
  );
}

function TyreTracks({
  leftRef,
  rightRef,
  revisionRef,
  width,
  mappingRef,
  enabled,
}: {
  leftRef: React.RefObject<TrailSample>;
  rightRef: React.RefObject<TrailSample>;
  revisionRef: React.RefObject<number>;
  width: number;
  mappingRef: React.RefObject<GroundMapping>;
  enabled: boolean;
}) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const offset = surfaceScrollOffset(window.scrollX, window.scrollY, mappingRef.current);
    group.position.set(offset.x, 0, offset.z);
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef} name="FyndraTyreTracks">
      <TrailMesh
        pointsRef={leftRef}
        revisionRef={revisionRef}
        width={width}
        mappingRef={mappingRef}
      />
      <TrailMesh
        pointsRef={rightRef}
        revisionRef={revisionRef}
        width={width}
        mappingRef={mappingRef}
      />
    </group>
  );
}

function OverheadCamera({
  mobile,
  mappingRef,
}: {
  mobile: boolean;
  mappingRef: React.RefObject<GroundMapping>;
}) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
    camera.position.set(0, mobile ? 2000 : 1850, mobile ? 690 : 640);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    deriveGroundMapping(camera, size.width, size.height, mappingRef.current);
    invalidate();
  }, [camera, invalidate, mappingRef, mobile, size.height, size.width]);

  return null;
}

export function CartStage({ mode = "interactive", paused = false, onReady }: StageProps) {
  const [device, setDevice] = useState<{ mobile: boolean; tablet: boolean }>({
    mobile: false,
    tablet: false,
  });
  const mappingRef = useRef<GroundMapping>({
    originX: 0,
    originY: 0,
    unitX: 1,
    unitZ: -0.945,
  });

  useEffect(() => {
    const mobileQuery = window.matchMedia(IS_MOBILE_QUERY);
    const tabletQuery = window.matchMedia(IS_TABLET_QUERY);
    const update = () =>
      setDevice({ mobile: mobileQuery.matches, tablet: tabletQuery.matches });
    update();
    mobileQuery.addEventListener("change", update);
    tabletQuery.addEventListener("change", update);
    return () => {
      mobileQuery.removeEventListener("change", update);
      tabletQuery.removeEventListener("change", update);
    };
  }, []);

  const scale = device.mobile
    ? CART_SCALE.mobile
    : device.tablet
      ? CART_SCALE.tablet
      : CART_SCALE.desktop;
  const maxTrailPoints = device.mobile ? 120 : 220;
  const staticScale = device.mobile ? 3.7 : device.tablet ? 6.4 : 8.7;

  return (
    <Canvas
      orthographic
      className="cart-stage-canvas"
      style={{ pointerEvents: "none" }}
      dpr={device.mobile ? [1, 1.4] : [1, 1.75]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 1850, 640], near: 1, far: 5000 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <FrameloopControl mode={mode} paused={paused} />
      <OverheadCamera mobile={device.mobile} mappingRef={mappingRef} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[-380, 900, 520]} intensity={2.35} color="#f4fbff" />
      <directionalLight position={[560, 640, -360]} intensity={1.05} color="#83d8ff" />
      <Suspense fallback={null}>
        <Environment resolution={device.mobile ? 128 : 256} frames={1}>
          <Lightformer form="rect" intensity={3.2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={2.1} position={[-5, 2, 1]} scale={[4, 10, 1]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={1.8} position={[5, 1, 2]} scale={[4, 10, 1]} rotation-y={-Math.PI / 2} />
          <Lightformer form="circle" intensity={2.4} position={[0, 8, 2]} scale={[6, 6, 1]} rotation-x={Math.PI / 2} />
        </Environment>
        <CartDriver
          mode={mode}
          mobile={device.mobile}
          scale={scale}
          staticScale={staticScale}
          mappingRef={mappingRef}
          maxTrailPoints={maxTrailPoints}
          onReady={onReady}
        />
      </Suspense>
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
