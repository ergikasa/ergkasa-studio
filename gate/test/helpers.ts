/**
 * Test material: real staged films written to a temporary package root, the engine's real capabilities, and a
 * clean base package to break on purpose. Tests may use the engine and the stager; the gate itself may not.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { renderCapabilities } from "@erkasa/film";
import { serialise, stageFilm } from "@erkasa/stager";
import { validate, type GateResult, type RenderCapabilities } from "../src/index.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const sha = (b: string | Uint8Array): string => createHash("sha256").update(b).digest("hex");
export const caps = (): RenderCapabilities => structuredClone(renderCapabilities()) as RenderCapabilities;
export const clone = <T>(x: T): T => structuredClone(x);

export type Film = Parameters<typeof stageFilm>[0];
const staged = new Map<string, { pkg: RenderPackage; manifest: AssetManifest }>();
export function film(name: Film): { pkg: RenderPackage; manifest: AssetManifest } {
  let s = staged.get(name);
  if (!s) {
    const w = serialise(stageFilm(name));
    s = { pkg: JSON.parse(w.pkg) as RenderPackage, manifest: JSON.parse(w.manifest) as AssetManifest };
    staged.set(name, s);
  }
  return clone(s);
}

/** Writes manifest + package into a fresh root; the package is re-pinned to the manifest unless `keepPin`. */
export function write(
  pkg: RenderPackage,
  manifest: AssetManifest | string,
  opts: { keepPin?: boolean; root?: string } = {},
) {
  const root = opts.root ?? mkdtempSync(join(tmpdir(), "gate-"));
  const mtext = typeof manifest === "string" ? manifest : JSON.stringify(manifest);
  const muri = pkg.assetManifest.uri;
  mkdirSync(dirname(join(root, muri)), { recursive: true });
  writeFileSync(join(root, muri), mtext);
  const p = opts.keepPin ? pkg : { ...pkg, assetManifest: { ...pkg.assetManifest, sha256: sha(mtext) } };
  return { root, text: JSON.stringify(p) };
}

export function run(
  pkg: RenderPackage,
  manifest: AssetManifest | string,
  o: { capabilities?: RenderCapabilities; budgets?: object; keepPin?: boolean; root?: string } = {},
): GateResult {
  const { root, text } = write(pkg, manifest, o);
  return validate({
    package: text,
    root,
    capabilities: o.capabilities ?? caps(),
    ...(o.budgets ? { budgets: o.budgets } : {}),
  });
}

/**
 * The stager's manifests declare ranges its own values leave (open E1.2 finding, see the report). This writes the
 * ranges the engine declares instead, without touching the values: what the stager fix would produce.
 */
export function honestRanges(m: AssetManifest): AssetManifest {
  const c = caps();
  const byName = new Map(c.builtins.map((b) => [b.name, b]));
  for (const a of m.assets) {
    if (a.kind === "rig") for (const ch of a.channels) ch.range = [-Number.MAX_VALUE, Number.MAX_VALUE];
    if (a.kind === "vector" && a.parameters && a.source.kind === "builtin") {
      const eng = byName.get(a.source.name);
      for (const p of a.parameters) {
        const e = eng?.parameters?.find((x) => x.id === p.id);
        if (p.kind === "channel" && e?.kind === "channel") p.range = e.range;
      }
    }
  }
  return m;
}

/**
 * A clean base to break on purpose: B3 with honest ranges, plus one real file asset (the chair SVG of the asset
 * library, copied into the package root) drawn by one node, so file checks have a target.
 */
export function base(): { pkg: RenderPackage; manifest: AssetManifest; root: string } {
  const { pkg, manifest } = film("b3-every-yes");
  honestRanges(manifest);
  const root = mkdtempSync(join(tmpdir(), "gate-base-"));
  mkdirSync(join(root, "assets"), { recursive: true });
  copyFileSync(join(ROOT, "assets/objects/obj_chair/asset.svg"), join(root, "assets/chair.svg"));
  const file = {
    kind: "file" as const,
    uri: "assets/chair.svg",
    sha256: sha(readFileSync(join(root, "assets/chair.svg"))),
  };
  manifest.assets.push({
    id: "prop_chairfile",
    version: 1,
    kind: "vector",
    format: "svg",
    source: file,
    geometry: { viewBox: [0, 0, 32, 32], size: { w: 96, h: 96 }, origin: [16, 32] },
    states: [{ name: "default", source: file }],
    defaultState: "default",
    affordances: [],
    pivots: [],
    style: { kit: "fluent_flat" },
    provenance: { origin: "kit" },
    approval: { status: "approved" },
    license: "MIT",
  });
  const scene = pkg.scenes.find((s) =>
    s.layers.some((l) => l.id === "back"),
  ) as RenderPackage["scenes"][number];
  scene.layers
    .find((l) => l.id === "back")
    ?.nodes.push({
      kind: "asset",
      id: "chairfile",
      asset: "prop_chairfile@1",
      x: 100,
      y: 100,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flip: false,
      state: "default",
      pivot: null,
    });
  return { pkg, manifest, root };
}
