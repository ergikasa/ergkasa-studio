import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import type { AssetSource } from "@erkasa/engine";

interface ManifestEntry {
  assetId: string;
  path: string;
}

/** Reads assets from the repository's assets/ folder, using assets/manifest.json as the index. */
export class FsAssetSource implements AssetSource {
  private readonly paths = new Map<string, string>();
  private readonly metas = new Map<string, AssetMetaT>();

  constructor(private readonly root: string) {
    const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
      assets: ManifestEntry[];
    };
    for (const a of manifest.assets) this.paths.set(a.assetId, a.path);
  }

  private dir(assetId: string): string {
    const rel = this.paths.get(assetId);
    if (!rel) throw new Error(`asset '${assetId}' is not in assets/manifest.json`);
    return join(this.root, rel);
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
