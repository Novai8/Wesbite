import { Vector3, type Camera } from "three";

/**
 * The homepage is a flat document surface observed by an overhead camera. The
 * WebGL canvas is a fixed viewport layer, so the mapping from screen pixels to
 * ground-plane world units is derived from the camera itself rather than
 * hand-tuned constants. That keeps the cart, the contact shadow and the tyre
 * trails on exactly the same surface at every viewport size.
 */
export type GroundMapping = {
  /** Screen position (CSS px) of world (0, 0, 0). */
  originX: number;
  originY: number;
  /** Screen px per +1 world unit along X and Z. */
  unitX: number;
  unitZ: number;
};

export type SurfacePoint = { x: number; z: number };

export function deriveGroundMapping(
  camera: Camera,
  width: number,
  height: number,
  target?: GroundMapping,
): GroundMapping {
  camera.updateMatrixWorld();
  const origin = new Vector3(0, 0, 0).project(camera);
  const alongX = new Vector3(1, 0, 0).project(camera);
  const alongZ = new Vector3(0, 0, 1).project(camera);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const originX = (origin.x + 1) * halfWidth;
  const originY = (1 - origin.y) * halfHeight;
  const unitX = (alongX.x + 1) * halfWidth - originX;
  const unitZ = (1 - alongZ.y) * halfHeight - originY;
  const mapping = target ?? ({} as GroundMapping);
  mapping.originX = originX;
  mapping.originY = originY;
  mapping.unitX = Math.abs(unitX) < 1e-3 ? width : unitX;
  mapping.unitZ = Math.abs(unitZ) < 1e-3 ? -height : unitZ;
  return mapping;
}

/** Document (page) coordinates to world coordinates, for a scrolled viewport. */
export function pageToWorld(
  pageX: number,
  pageY: number,
  scrollX: number,
  scrollY: number,
  mapping: GroundMapping,
): SurfacePoint {
  return {
    x: (pageX - scrollX - mapping.originX) / mapping.unitX,
    z: (pageY - scrollY - mapping.originY) / mapping.unitZ,
  };
}

/**
 * Group offset that turns scroll-independent surface coordinates (the document
 * pinned at scroll 0) back into the current viewport. Trails are stored that
 * way so they stay glued to the page while the cart follows the cursor.
 */
export function surfaceScrollOffset(
  scrollX: number,
  scrollY: number,
  mapping: GroundMapping,
): SurfacePoint {
  return {
    x: -scrollX / mapping.unitX,
    z: -scrollY / mapping.unitZ,
  };
}
