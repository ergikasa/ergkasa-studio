/**
 *   pnpm --filter @erkasa/stager stage [--out <dir>]   stage the six reference films, write them, print sizes
 *   pnpm --filter @erkasa/stager stage --hashes         print the sha256 of every staged file (determinism check)
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RenderPackage } from "@erkasa/contracts";
import { FILMS, serialise, stageFilm } from "./index.js";

const bytes = (v: unknown): number => Buffer.byteLength(JSON.stringify(v));

/** Bytes of the compact package by category (each category serialised on its own; the rest is structure). */
export function breakdown(pkgJson: string): Record<string, number> {
  const pkg = JSON.parse(pkgJson) as RenderPackage;
  const tracks = pkg.scenes.flatMap((s) => s.tracks);
  const of = (f: (t: (typeof tracks)[number]) => boolean): number => bytes(tracks.filter(f));
  const isActor = (t: (typeof tracks)[number]): boolean => t.target.kind === "actor";
  const parts = {
    boneSamples: of((t) => isActor(t) && t.channel.startsWith("bone.")),
    actorOtherChannels: of((t) => isActor(t) && !t.channel.startsWith("bone.")),
    camera: of((t) => t.target.kind === "camera"),
    lights: of((t) => t.target.kind === "light") + bytes(pkg.scenes.flatMap((s) => s.lights)),
    nodes:
      of((t) => t.target.kind === "node" || t.target.kind === "layer") +
      bytes(pkg.scenes.flatMap((s) => [...s.layers, ...(s.screen ?? [])])) +
      bytes(pkg.scenes.flatMap((s) => s.events)),
    overlays: bytes(pkg.overlays),
  };
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);
  return { ...parts, structure: Buffer.byteLength(pkgJson) - sum, total: Buffer.byteLength(pkgJson) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outAt = process.argv.indexOf("--out");
  const out = outAt > 0 ? process.argv[outAt + 1] : undefined;
  if (out) mkdirSync(out, { recursive: true });
  for (const f of FILMS) {
    const s = stageFilm(f);
    const w = serialise(s);
    if (process.argv.includes("--hashes")) {
      const h = (x: string): string => createHash("sha256").update(x).digest("hex");
      console.info(`${f} ${h(w.pkg)} ${h(w.manifest)}`);
      continue;
    }
    if (out) {
      writeFileSync(join(out, `${f}.render.json`), w.pkg);
      writeFileSync(join(out, `${f}.assets.json`), w.manifest);
    }
    console.info(
      JSON.stringify({
        film: f,
        duration: s.pkg.output.duration,
        manifest: w.manifest.length,
        ...breakdown(w.pkg),
      }),
    );
  }
}
