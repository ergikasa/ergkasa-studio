import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { FILMS, serialise, stageFilm } from "../src/index.js";
import { ROOT } from "../src/manifest.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
const schema = (name: string) =>
  ajv.compile(
    JSON.parse(readFileSync(join(ROOT, `contracts/json-schema/${name}.schema.json`), "utf8")) as object,
  );
const validPackage = schema("render-package");
const validManifest = schema("asset-manifest");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const staged = Object.fromEntries(FILMS.map((f) => [f, serialise(stageFilm(f))]));

describe.each(FILMS)("%s", (film) => {
  const w = staged[film] as { pkg: string; manifest: string };
  const pkg = JSON.parse(w.pkg) as RenderPackage;
  const manifest = JSON.parse(w.manifest) as AssetManifest;

  it("is valid against the JSON Schemas (what a Java reader checks)", () => {
    expect(validPackage(pkg), JSON.stringify(validPackage.errors?.slice(0, 3))).toBe(true);
    expect(validManifest(manifest), JSON.stringify(validManifest.errors?.slice(0, 3))).toBe(true);
  });

  it("pins its manifest by hash and names only assets the manifest declares", () => {
    expect(pkg.assetManifest.sha256).toBe(sha(w.manifest));
    const known = new Set(manifest.assets.map((a) => `${a.id}@${a.version}`));
    const refs = [...w.pkg.matchAll(/"([a-z]+_[a-z0-9_]+@\d+)"/g)].map((m) => m[1] ?? "");
    for (const r of new Set(refs)) expect(known.has(r), r).toBe(true);
    // and the manifest holds nothing the package does not use
    for (const k of known) expect(refs.includes(k), k).toBe(true);
  });

  it("every builtin is pinned to the engine file that implements it", () => {
    const files: Record<string, string> = {
      rig: "film/src/rig.ts",
      set: "film/src/sets.ts",
      prop: "film/src/props.ts",
      template: "film/src/templates.ts",
      type: "film/src/style.ts",
      overlay: "film/src/compose.ts",
      w0: "film/src/w0/world.ts",
    };
    for (const a of manifest.assets) {
      const sources = [
        a.source,
        ...(a.kind === "vector" ? a.states.flatMap((s) => ("source" in s ? [s.source] : [])) : []),
      ];
      for (const s of sources) {
        if (s.kind !== "builtin" || s.name.startsWith("font.")) continue;
        const head = s.name === "type.w0" ? "film/src/w0/composer.ts" : files[s.name.split(".")[0] ?? ""];
        expect(head, s.name).toBeDefined();
        expect(s.fingerprint, s.name).toBe(sha(readFileSync(join(ROOT, head ?? ""), "utf8")));
      }
    }
  });

  it("procedural nodes set every static input and drive only declared channels; people set every slot", () => {
    const byRef = new Map(manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
    for (const scene of pkg.scenes) {
      for (const n of [...scene.layers, ...(scene.screen ?? [])].flatMap((l) => l.nodes)) {
        if (n.kind !== "asset") continue;
        const a = byRef.get(n.asset);
        const params = a?.kind === "vector" ? (a.parameters ?? []) : [];
        expect(Object.keys(n.params ?? {}).sort(), `${scene.id} ${n.id}`).toEqual(
          params
            .filter((p) => p.kind === "static")
            .map((p) => p.id)
            .sort(),
        );
        const channels = new Set(params.filter((p) => p.kind === "channel").map((p) => `param.${p.id}`));
        for (const t of scene.tracks)
          if (t.target.kind === "node" && t.target.id === n.id && t.channel.startsWith("param."))
            expect(channels.has(t.channel), `${scene.id} ${n.id} ${t.channel}`).toBe(true);
      }
      for (const actor of scene.actors) {
        const r = byRef.get(actor.rig);
        expect(Object.keys(actor.appearance).sort()).toEqual(r?.kind === "rig" ? [...r.slots].sort() : []);
      }
    }
  });

  it("one track per (target, channel) in a scene; samples at the film's rate, starting on a frame", () => {
    for (const scene of pkg.scenes) {
      const keys = scene.tracks.map(
        (t) => `${t.target.kind}:${"id" in t.target ? t.target.id : ""}:${t.channel}`,
      );
      expect(new Set(keys).size).toBe(keys.length);
      for (const t of scene.tracks)
        if (t.kind === "samples") {
          expect(t.rate).toBe(pkg.output.fps);
          expect(
            Number.isInteger(Math.round(t.start * t.rate)) &&
              Math.abs(t.start * t.rate - Math.round(t.start * t.rate)) < 1e-9,
          ).toBe(true);
        }
    }
  });
});

describe("determinism", () => {
  it("staging again in this process gives the same bytes", () => {
    for (const f of FILMS) {
      const again = serialise(stageFilm(f));
      expect(sha(again.pkg), f).toBe(sha(staged[f]?.pkg ?? ""));
      expect(sha(again.manifest), f).toBe(sha(staged[f]?.manifest ?? ""));
    }
  });

  it("a separate process gives the same bytes", () => {
    const tsx = createRequire(import.meta.url).resolve("tsx/cli");
    const out = execFileSync(process.execPath, [tsx, join(ROOT, "stager/src/cli.ts"), "--hashes"], {
      encoding: "utf8",
    });
    const lines = out.trim().split("\n");
    expect(lines.length).toBe(FILMS.length);
    for (const line of lines) {
      const [f, p, m] = line.split(" ");
      expect(p, f).toBe(sha(staged[f ?? ""]?.pkg ?? ""));
      expect(m, f).toBe(sha(staged[f ?? ""]?.manifest ?? ""));
    }
  }, 120_000);

  it("the stager has no model, network, clock or randomness", () => {
    const deps = Object.keys(
      (JSON.parse(readFileSync(join(ROOT, "stager/package.json"), "utf8")) as { dependencies: object })
        .dependencies,
    );
    expect(deps.sort()).toEqual(["@erkasa/contracts", "@erkasa/film", "tsx"]);
    for (const f of readdirSync(join(ROOT, "stager/src"))) {
      const src = readFileSync(join(ROOT, "stager/src", f), "utf8");
      for (const bad of [
        /@anthropic-ai/,
        /openai/,
        /\bfetch\(/,
        /node:https?/,
        /Math\.random/,
        /Date\.now/,
        /new Date\(/,
        /@erkasa\/planner/,
        /ai-worker/,
      ])
        expect(bad.test(src), `${f}: ${bad}`).toBe(false);
    }
  });
});
