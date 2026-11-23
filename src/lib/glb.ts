/**
 * Structural validation for binary glTF (`.glb`) files.
 *
 * This is deliberately a pure parser: no fetching, no filesystem, no DOM. It
 * lets the worker reject truncated or non-GLB payloads before anything is
 * uploaded to Storage, and lets tests exercise the same code the worker uses.
 *
 * Format reference: glTF 2.0 binary container —
 *   12-byte header: magic "glTF", uint32 version, uint32 total length
 *   then chunks: uint32 chunkLength, uint32 chunkType, byte[chunkLength]
 *   chunk 0 must be JSON (type 0x4E4F534A), chunk 1 may be BIN (0x004E4942)
 */

export const GLB_MAGIC = 0x46546c67; // "glTF" little-endian
export const GLB_JSON_CHUNK = 0x4e4f534a; // "JSON"
export const GLB_BIN_CHUNK = 0x004e4942; // "BIN\0"

export interface GlbSummary {
  version: number;
  declaredLength: number;
  actualLength: number;
  meshCount: number;
  materialCount: number;
  textureCount: number;
  imageCount: number;
  accessorCount: number;
  /** `asset.generator`, when present. */
  generator?: string;
}

export class GlbValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlbValidationError";
  }
}

interface GltfJson {
  asset?: { version?: string; generator?: string };
  meshes?: unknown[];
  materials?: unknown[];
  textures?: unknown[];
  images?: unknown[];
  accessors?: unknown[];
  buffers?: unknown[];
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Parse and validate a GLB. Throws `GlbValidationError` on any structural problem. */
export function parseGlb(bytes: Uint8Array): GlbSummary {
  if (!(bytes instanceof Uint8Array)) {
    throw new GlbValidationError("Expected a Uint8Array");
  }
  if (bytes.byteLength < 20) {
    throw new GlbValidationError(`File too small to be a GLB (${bytes.byteLength} bytes)`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magic = readUint32(view, 0);
  if (magic !== GLB_MAGIC) {
    throw new GlbValidationError(
      `Bad magic 0x${magic.toString(16)} (expected "glTF") — not a binary glTF file`,
    );
  }

  const version = readUint32(view, 4);
  if (version !== 2) {
    throw new GlbValidationError(`Unsupported GLB version ${version} (expected 2)`);
  }

  const declaredLength = readUint32(view, 8);
  if (declaredLength !== bytes.byteLength) {
    throw new GlbValidationError(
      `Declared length ${declaredLength} does not match actual length ${bytes.byteLength} (truncated or padded?)`,
    );
  }

  let offset = 12;
  let json: GltfJson | null = null;
  let chunkIndex = 0;
  let sawBin = false;

  while (offset + 8 <= bytes.byteLength) {
    const chunkLength = readUint32(view, offset);
    const chunkType = readUint32(view, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;

    if (dataEnd > bytes.byteLength) {
      throw new GlbValidationError(
        `Chunk ${chunkIndex} overruns the file (needs ${chunkLength} bytes at ${dataStart})`,
      );
    }

    if (chunkIndex === 0) {
      if (chunkType !== GLB_JSON_CHUNK) {
        throw new GlbValidationError("First chunk must be JSON");
      }
      const text = new TextDecoder("utf-8").decode(bytes.subarray(dataStart, dataEnd));
      try {
        json = JSON.parse(text) as GltfJson;
      } catch {
        throw new GlbValidationError("JSON chunk is not valid JSON");
      }
    } else if (chunkType === GLB_BIN_CHUNK) {
      if (sawBin) throw new GlbValidationError("Multiple BIN chunks are not allowed");
      sawBin = true;
    }

    offset = dataEnd;
    chunkIndex += 1;
  }

  if (!json) throw new GlbValidationError("Missing JSON chunk");

  const assetVersion = json.asset?.version;
  if (assetVersion !== "2.0") {
    throw new GlbValidationError(`asset.version is "${assetVersion ?? "missing"}" (expected "2.0")`);
  }

  const meshCount = json.meshes?.length ?? 0;
  if (meshCount === 0) {
    throw new GlbValidationError("GLB contains no meshes");
  }

  return {
    version,
    declaredLength,
    actualLength: bytes.byteLength,
    meshCount,
    materialCount: json.materials?.length ?? 0,
    textureCount: json.textures?.length ?? 0,
    imageCount: json.images?.length ?? 0,
    accessorCount: json.accessors?.length ?? 0,
    generator: json.asset?.generator,
  };
}

/** True when the GLB has at least one mesh. Never throws. */
export function isValidGlb(bytes: Uint8Array): boolean {
  try {
    parseGlb(bytes);
    return true;
  } catch {
    return false;
  }
}
