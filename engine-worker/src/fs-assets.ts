import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import type { AssetSource } from "@erkasa/engine";

interface ManifestEntry {
  assetId: string;
  path: string;
}

/**
 * Reads assets from folders that each hold a manifest.json index: the studio library (assets/) and, for a
 * video with its own world, the World Builder's output. Roots are searched in order, so a world's assets
 * come before the library's.
 */
export class FsAssetSource implements AssetSource {
  private readonly paths = new Map<string, string>();
  private readonly metas = new Map<string, AssetMetaT>();

  constructor(roots: string | string[]) {
    for (const root of Array.isArray(roots) ? roots : [roots]) {
      const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
        assets: ManifestEntry[];
      };
      for (const a of manifest.assets)
        if (!this.paths.has(a.assetId)) this.paths.set(a.assetId, join(root, a.path));
    }
  }

  private dir(assetId: string): string {
    const dir = this.paths.get(assetId);
    if (!dir) throw new Error(`asset '${assetId}' is not in any asset manifest`);
    return dir;
  }

  meta(assetId: string): AssetMetaT {
    let m = this.metas.get(assetId);
    if (!m) {
      m = AssetMeta.parse(JSON.parse(readFileSync(join(this.dir(assetId), "asset.json"), "utf8")));
      this.metas.set(assetId, m);
    }
    return m;
  }

  text(assetId: string, file: string): string {
    return readFileSync(join(this.dir(assetId), file), "utf8");
  }
}
