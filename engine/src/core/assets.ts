import type { AssetMeta } from "@erkasa/contracts";

/**
 * Where the engine gets asset files from. The engine never touches the filesystem or network:
 * the render worker gives it a filesystem source, the Studio UI a preloaded in-memory one.
 */
export interface AssetSource {
  meta(assetId: string): AssetMeta;
  /** Text content of a file inside the asset folder (e.g. `asset.svg`, `rig.json`). */
  text(assetId: string, file: string): string;
}

/** `char_drini_01@1` -> { id: "char_drini_01", version: 1 } */
export function parseAssetRef(ref: string): { id: string; version: number } {
  const at = ref.lastIndexOf("@");
  if (at < 0) return { id: ref, version: 0 };
  return { id: ref.slice(0, at), version: Number(ref.slice(at + 1)) };
}

export function resolveAsset(source: AssetSource, ref: string): AssetMeta {
  const { id, version } = parseAssetRef(ref);
  const meta = source.meta(id);
  if (version && meta.version !== version) {
    throw new Error(`asset ${id}: timeline wants version ${version}, library has ${meta.version}`);
  }
  return meta;
}
