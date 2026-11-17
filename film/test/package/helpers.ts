/** Test material for the package renderer: staged films written into a fresh package root. */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serialise, stageFilm } from "@erkasa/stager";
import { Script } from "@erkasa/contracts";
import { prepare } from "../../src/film.js";
import { FilmPlan } from "../../src/contract.js";
import { shotFrames, type Composed } from "../../src/compose.js";
import { openPackage, type PackageRenderer } from "../../src/package/render.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export type Film = Parameters<typeof stageFilm>[0];

/** A staged film on disk: { root, package text }. */
export function staged(name: Film): { root: string; text: string } {
  const w = serialise(stageFilm(name));
  const root = mkdtempSync(join(tmpdir(), `pkg-${name}-`));
  const muri = (JSON.parse(w.pkg) as { assetManifest: { uri: string } }).assetManifest.uri;
  mkdirSync(dirname(join(root, muri)), { recursive: true });
  writeFileSync(join(root, muri), w.manifest);
  return { root, text: w.pkg };
}

export function renderer(input: { root: string; text: string }): PackageRenderer {
  const o = openPackage({ package: input.text, root: input.root });
  if (!o.ok) throw new Error(`refused: ${JSON.stringify(o.errors.slice(0, 3))}`);
  return o.renderer;
}

/** The fixtures B of the gate (acceptance packages), from the repository. */
export const fixtureB = (name: "prisoner-cell" | "office-clock") => ({
  root: ROOT,
  text: readFileSync(join(ROOT, `gate/fixtures/acceptance/${name}.render.json`), "utf8"),
});

/** The plan path of a v2 film, and frame k as (shot, local frame) the way frameAt counts. */
export function planPath(name: string): { composed: Composed; at(k: number): { i: number; n: number } } {
  const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${name}.film.json`), "utf8")));
  const script = Script.parse(
    JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${name}.script.json`), "utf8")),
  );
  const { composed } = prepare({ script, plan });
  const firsts: number[] = [];
  let k0 = 0;
  for (const s of composed.shots) {
    firsts.push(k0);
    k0 += shotFrames(s);
  }
  return {
    composed,
    at(k) {
      let i = firsts.length - 1;
      while (i > 0 && (firsts[i] as number) > k) i--;
      return { i, n: k - (firsts[i] as number) };
    },
  };
}
