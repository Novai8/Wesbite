"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, ShaderMaterial } from "three";
import { RIBBON_FLOATS_PER_VERTEX, writeRibbonGeometry, type TrailSample } from "./trail-buffer";
import type { GroundMapping } from "@/lib/cart-space";

const MAX_POINTS = 220;

const VERTEX_SHADER = /* glsl */ `
  attribute float trailFade;
  varying vec2 vUv;
  varying float vFade;

  void main() {
    vUv = uv;
    vFade = trailFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying float vFade;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float across = vUv.y;
    float along = vUv.x;

    // Soft shoulders: the print thins out where the tyre carcass rolls away.
    float edge = smoothstep(0.0, 0.14, across) * smoothstep(1.0, 0.86, across);
    float core = smoothstep(0.16, 0.36, across) * smoothstep(0.84, 0.64, across);

    // Central longitudinal groove plus two shoulder grooves.
    float groove = 1.0 - smoothstep(0.03, 0.075, abs(across - 0.5));
    float shoulders =
      (1.0 - smoothstep(0.015, 0.05, abs(across - 0.27))) +
      (1.0 - smoothstep(0.015, 0.05, abs(across - 0.73)));

    // Tread blocks with a diagonal sipe inside each block.
    float block = fract(along / 9.0);
    float tread = smoothstep(0.05, 0.24, block) * smoothstep(0.95, 0.76, block);
    float sipe = smoothstep(0.44, 0.5, abs(block - 0.5 - (across - 0.5) * 0.16));

    // Fine grain stops long runs reading as flat vector paint.
    float grain = hash(vec2(floor(along / 2.0), floor(across * 44.0)));

    // Faux emboss: a lit lip on the outer shoulder, a drop shadow on the inner
    // one, so the mark looks pressed into the surface instead of painted on.
    float lip = smoothstep(0.88, 1.0, across) * 0.55 + smoothstep(0.12, 0.0, across) * 0.3;

    float ink = edge * (0.84 + core * 0.16);
    ink *= mix(0.6, 1.0, tread);
    ink *= 1.0 - sipe * 0.22;
    ink *= 1.0 - (groove + shoulders * 0.7) * 0.16;
    ink *= mix(0.93, 1.0, grain);

    float alpha = ink * mix(0.0, 1.0, pow(vFade, 0.55));
    vec3 rubber = mix(vec3(0.012, 0.02, 0.048), vec3(0.16, 0.2, 0.25), lip);
    gl_FragColor = vec4(rubber, alpha * 0.8);
  }
`;

type TrailMeshProps = {
  pointsRef: React.RefObject<TrailSample>;
  revisionRef: React.RefObject<number>;
  width: number;
  mappingRef: React.RefObject<GroundMapping>;
};

/**
 * A single reusable ribbon geometry for one tyre. Each point updates only the
 * already-allocated position buffer, then increments drawRange to the visible
 * segments. No geometry is created or disposed while driving.
 */
export function TrailMesh({ pointsRef, revisionRef, width, mappingRef }: TrailMeshProps) {
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const maxVertices = (MAX_POINTS - 1) * 6;
    const positions = new Float32Array(maxVertices * 3);
    const uvs = new Float32Array(maxVertices * 2);
    const fades = new Float32Array(maxVertices);
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setAttribute("trailFade", new BufferAttribute(fades, 1));
    geometry.setDrawRange(0, 0);
    geometry.boundingSphere = null;
    return geometry;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        glslVersion: null,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [],
  );

  const bufferRef = useRef(new Float32Array((MAX_POINTS - 1) * 6 * RIBBON_FLOATS_PER_VERTEX));
  const revision = useRef(-1);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    const sample = pointsRef.current;
    const target = bufferRef.current;
    if (!sample || revision.current === revisionRef.current) return;
    revision.current = revisionRef.current ?? 0;
    const vertexCount = writeRibbonGeometry(sample.points, width, 0, target, mappingRef.current);

    const position = geometry.getAttribute("position") as BufferAttribute;
    const uv = geometry.getAttribute("uv") as BufferAttribute;
    const fade = geometry.getAttribute("trailFade") as BufferAttribute;

    const pa = position.array as Float32Array;
    const ua = uv.array as Float32Array;
    const fa = fade.array as Float32Array;

    for (let index = 0; index < vertexCount; index += 1) {
      const src = index * RIBBON_FLOATS_PER_VERTEX;
      const dstPos = index * 3;
      const dstUv = index * 2;
      pa[dstPos] = target[src];
      pa[dstPos + 1] = target[src + 1];
      pa[dstPos + 2] = target[src + 2];
      ua[dstUv] = target[src + 3];
      ua[dstUv + 1] = target[src + 4];
      fa[index] = target[src + 5];
    }

    position.needsUpdate = true;
    uv.needsUpdate = true;
    fade.needsUpdate = true;
    geometry.setDrawRange(0, vertexCount);
  });

  // No bounding sphere is computed when the ribbon changes. The mesh below sets
  // `frustumCulled={false}`, so the renderer never consults a bounding volume,
  // and nothing raycasts against this geometry. Recomputing one walked every
  // vertex attribute — including the unused tail beyond `drawRange` — each time
  // the trail moved, for a value that was never read.
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />;
}
