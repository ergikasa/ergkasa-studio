import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import type { AssetSource } from "@erkasa/engine";

/** One line of assets/manifest.json. */
export interface ManifestEntry {
  assetId: string;
  category: string;
  kind: string;
  adapter: string;
  style: string;
  path: string;
  themes: string[];
  tags: string[];
  license: string;
}

export interface Manifest {
  schema: string;
  total: number;
  counts: Record<string, number>;
  assets: ManifestEntry[];
}

/** The asset library is served by Vite from the repository's assets/ folder (see vite.config.ts). */
export function assetUrl(entry: Pick<ManifestEntry, "path">, file: string): string {
  return `/${entry.path}/${file}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return res.text();
}

let manifestPromise: Promise<Manifest> | undefined;

export function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetchText("/manifest.json").then((t) => JSON.parse(t) as Manifest);
  return manifestPromise;
}

/**
 * The engine reads assets synchronously, so the browser loads every file it may need up front.
 * Same contract as the render worker's filesystem source: asset.json is schema-validated on load.
 */
export class PreloadedAssetSource implements AssetSource {
  private readonly metas = new Map<string, AssetMetaT>();
  private readonly files = new Map<string, string>();

  constructor(private readonly manifest: Manifest) {}

  private entry(assetId: string): ManifestEntry {
    const e = this.manifest.assets.find((a) => a.assetId === assetId);
    if (!e) throw new Error(`asset '${assetId}' is not in assets/manifest.json`);
    return e;
  }

  has(assetId: string): boolean {
    return this.metas.has(assetId);
  }

  /** Loads asset.json and every file it declares (files + variants). */
  async load(assetId: string): Promise<AssetMetaT> {
    const cached = this.metas.get(assetId);
    if (cached) return cached;
    const entry = this.entry(assetId);
    const meta = AssetMeta.parse(JSON.parse(await fetchText(assetUrl(entry, "asset.json"))));
    const names = new Set([...Object.values(meta.files), ...Object.values(meta.variants ?? {})]);
    await Promise.all(
      [...names].map(async (f) => this.files.set(`${assetId}/${f}`, await fetchText(assetUrl(entry, f)))),
    );
    this.metas.set(assetId, meta);
    return meta;
  }

  async loadAll(assetIds: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(assetIds)].map((id) => this.load(id)));
  }

  meta(assetId: string): AssetMetaT {
    const m = this.metas.get(assetId);
    if (!m) throw new Error(`asset '${assetId}' was not preloaded`);
    return m;
  }

  text(assetId: string, file: string): string {
    const t = this.files.get(`${assetId}/${file}`);
    if (t === undefined) throw new Error(`asset '${assetId}': file '${file}' was not preloaded`);
    return t;
  }
}

/** Every asset id mentioned anywhere in a JSON document (e.g. a video plan), with or without @version. */
export function referencedAssets(doc: unknown, manifest: Manifest): string[] {
  const known = new Set(manifest.assets.map((a) => a.assetId));
  const found = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      const id = v.includes("@") ? v.slice(0, v.lastIndexOf("@")) : v;
      if (known.has(id)) found.add(id);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(doc);
  return [...found];
}
