/**
 * @erkasa/stager — film plan → Render Package (erkasa.render/1) + Asset Manifest (erkasa.assets/1).
 *
 * Deterministic: no model, no network, no clock, no randomness of its own. The same plan and script give the
 * same bytes. Every package is validated against the contract before it is returned.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { AssetManifest, RenderPackage, Script } from "@erkasa/contracts";
import { FilmPlan, parseW0Plan } from "./legacy.js";
import { ROOT } from "./manifest.js";
import { stageV2, type Staged } from "./v2.js";
import { stageW0 } from "./w0.js";

export { stageV2, type Staged } from "./v2.js";
export { stageW0 } from "./w0.js";
export { SceneRecorder } from "./recorder.js";

export const BENCH = [
  "b1-why-we-stay",
  "b2-same-answers",
  "b3-every-yes",
  "b4-one-percent",
  "b5-planning-fallacy",
];
export const FILMS = [...BENCH, "w0-office"] as const;

const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const script = (name: string): Script => Script.parse(json(`benchmark/scripts/${name}.script.json`));

/** Stages one of the six reference films from the plans in the repository. */
export function stageFilm(name: (typeof FILMS)[number]): Staged {
  if (name === "w0-office")
    return stageW0(name, parseW0Plan(json("film/w0/plan.json")), script("b1-why-we-stay"));
  return stageV2(name, FilmPlan.parse(json(`film/plans/${name}.film.json`)), script(name));
}

export interface Written {
  /** Compact JSON, as written to disk. */
  pkg: string;
  manifest: string;
}

/**
 * Serialises a staged film: the manifest first, then the package pinned to the manifest's hash. Both are parsed
 * back with the contracts; parsing must return them unchanged (nothing is filled in).
 */
export function serialise(s: Staged): Written {
  const manifest = JSON.stringify(s.manifest);
  const sha256 = createHash("sha256").update(manifest).digest("hex");
  const pkg = JSON.stringify({ ...s.pkg, assetManifest: { ...s.pkg.assetManifest, sha256 } });
  for (const [schema, text] of [
    [AssetManifest, manifest],
    [RenderPackage, pkg],
  ] as const) {
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success)
      throw new Error(`staged ${s.pkg.id} is not valid: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`);
    if (!isDeepStrictEqual(parsed.data, JSON.parse(text)))
      throw new Error(`staged ${s.pkg.id}: parsing changed the document`);
  }
  return { pkg, manifest };
}
