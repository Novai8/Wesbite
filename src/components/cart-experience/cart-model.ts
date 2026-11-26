import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const CART_MODEL_URL = "/models/fyndra-cart/shopping-cart.obj";

/** Bounds measured from the supplied OBJ (centimetres). */
export const CART_BOUNDS = {
  min: new Vector3(-3.666441, 0.156086, -8.965931),
  max: new Vector3(3.666441, 18.566303, 9.482178),
} as const;

/** Centre of the four-wheel footprint, used to keep the cart centred on the cursor. */
export const CART_PIVOT = new Vector3(0, CART_BOUNDS.min.y, 0.256);

/**
 * Wheel placement in model units, measured from the supplied OBJ. Values are
 * relative to the cart pivot so the 3D stage can place tyre contact points
 * without re-deriving them from the mesh hierarchy.
 */
export const CART_FOOTPRINT = {
  rearAxleZ: 7.978 - CART_PIVOT.z,
  frontAxleZ: -5.778 - CART_PIVOT.z,
  halfGauge: 3,
  wheelRadius: 1.045,
  wheelWidth: 0.79,
} as const;

/**
 * Width of a tyre mark on the ground plane. The ribbon is drawn exactly as wide
 * as the tyre that pressed it into the page, so a trail always reads as the
 * cart own print rather than as a separate line.
 */
export function trackWidthForScale(scale: number): number {
  return Math.max(2.5, CART_FOOTPRINT.wheelWidth * scale);
}

export type WheelAxle = "front" | "rear";
export type WheelSide = "left" | "right";

export type CartWheel = {
  axle: WheelAxle;
  side: WheelSide;
  pivot: Group;
  /** Local model-space centre of the wheel. */
  centre: Vector3;
  radius: number;
  width: number;
};

export type CartModel = {
  root: Group;
  wheels: CartWheel[];
  materials: MeshStandardMaterial[];
  geometries: BufferGeometry[];
  dispose: () => void;
};

type MaterialSpec = {
  color: string;
  metalness: number;
  roughness: number;
  side?: typeof DoubleSide;
};

/**
 * Colours come from the supplied `Shopping Cart.mtl`. OBJLoader ignores MTL
 * materials, so they are applied explicitly while keeping the original palette.
 */
const MATERIALS: Record<string, MaterialSpec> = {
  lambert2SG: { color: "#05247a", metalness: 0.36, roughness: 0.3, side: DoubleSide },
  lambert3SG: { color: "#151515", metalness: 0.05, roughness: 0.86 },
  lambert4SG: { color: "#46606b", metalness: 0.82, roughness: 0.3 },
};

type WheelDefinition = {
  name: string;
  axle: WheelAxle;
  side: WheelSide;
  centre: Vector3;
};

/** The four existing wheel meshes in the supplied model. */
const WHEELS: WheelDefinition[] = [
  { name: "Cart polySurface4", axle: "rear", side: "left", centre: new Vector3(-3, 1.201, 7.978) },
  { name: "Cart polySurface5", axle: "rear", side: "right", centre: new Vector3(3, 1.201, 7.978) },
  { name: "Cart polySurface10", axle: "front", side: "left", centre: new Vector3(-3, 1.201, -5.778) },
  { name: "Cart polySurface11", axle: "front", side: "right", centre: new Vector3(3, 1.201, -5.778) },
];

const WHEEL_RADIUS = 1.045;
const WHEEL_WIDTH = 0.79;

function buildMaterials(): Map<string, MeshStandardMaterial> {
  const materials = new Map<string, MeshStandardMaterial>();
  for (const [name, spec] of Object.entries(MATERIALS)) {
    const material = new MeshStandardMaterial({
      color: spec.color,
      metalness: spec.metalness,
      roughness: spec.roughness,
      envMapIntensity: 1.15,
      ...(spec.side === undefined ? {} : { side: spec.side }),
    });
    material.name = name;
    materials.set(name, material);
  }
  return materials;
}

function indexGeometry(geometry: BufferGeometry): BufferGeometry {
  if (geometry.index) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  try {
    const indexed = mergeVertices(geometry, 1e-5);
    if (indexed !== geometry) {
      indexed.name = geometry.name;
      geometry.dispose();
    }
    indexed.computeBoundingBox();
    indexed.computeBoundingSphere();
    return indexed;
  } catch {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Converts the loaded OBJ into a small, reusable scene graph. The supplied
 * geometry is retained; the only change is lossless indexing to cut memory and
 * the reparenting of existing wheel meshes into axle pivots so they can roll.
 */
export function buildCartModel(source: Group): CartModel {
  const materials = buildMaterials();
  const root = new Group();
  root.name = "FyndraCart";

  const model = new Group();
  model.name = "FyndraCartModel";
  model.scale.setScalar(1);
  model.position.set(-CART_PIVOT.x, -CART_PIVOT.y, -CART_PIVOT.z);
  root.add(model);

  const wheelDefinitions = new Map(WHEELS.map((wheel) => [wheel.name, wheel]));
  const wheels: CartWheel[] = [];
  const geometries: BufferGeometry[] = [];

  for (const child of [...source.children]) {
    if (!(child instanceof Mesh)) continue;

    const materialName = child.material instanceof MeshStandardMaterial
      ? child.material.name
      : String(child.material?.name ?? "");
    const material = materials.get(materialName) ?? materials.get("lambert4SG");
    if (!material) continue;

    child.geometry = indexGeometry(child.geometry);
    geometries.push(child.geometry);

    const wheel = wheelDefinitions.get(child.name);
    const mesh = new Mesh(child.geometry, material);
    mesh.name = child.name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    if (wheel) {
      const pivot = new Group();
      pivot.name = `WheelPivot:${wheel.axle}:${wheel.side}`;
      pivot.position.copy(wheel.centre);
      mesh.position.copy(wheel.centre).multiplyScalar(-1);
      pivot.add(mesh);
      model.add(pivot);
      wheels.push({
        axle: wheel.axle,
        side: wheel.side,
        pivot,
        centre: wheel.centre.clone(),
        radius: WHEEL_RADIUS,
        width: WHEEL_WIDTH,
      });
    } else {
      model.add(mesh);
    }
  }

  const box = new Box3().setFromObject(root);
  if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) {
    root.position.y = 0;
  }

  return {
    root,
    wheels,
    materials: [...materials.values()],
    geometries,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials.values()) material.dispose();
    },
  };
}
