/**
 * The Builder's one way out: a package description in memory → the files of an erkasa.character/1 package.
 * Every authoring source (parametric code, an artist's import, a custom rig) ends here, so every package is
 * written the same way: deterministic bytes, every file hashed and listed, the identity fingerprinted, the result
 * checked against the contract and loaded back by the Runtime before it is accepted.
 *
 * A folder that already holds a package is never changed: writing the same bytes again is a no-op, anything else
 * is refused (a new version is a new folder).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CharacterPackage, CharacterParts, type CharacterPart } from "@erkasa/contracts";
import {
  CharacterError,
  identityFingerprint,
  loadCharacterBytes,
  sha256,
  type LoadedCharacter,
} from "../runtime/index.js";

type Manifest = CharacterPackage;

export interface PackageSpec {
  /** Everything of character.json except what the writer computes: `files` and `fingerprint`. */
  manifest: Omit<Manifest, "files" | "fingerprint">;
  parts: ReadonlyArray<{ path: string; parts: CharacterPart[] }>;
  textures: ReadonlyArray<{ path: string; bytes: Uint8Array; media: "image/png" | "image/webp" }>;
  /** Evidence reports (JSON) the capability manifest cites. */
  reports?: ReadonlyArray<{ path: string; json: unknown }>;
  previews?: ReadonlyArray<{ path: string; bytes: Uint8Array }>;
}

const json = (v: unknown, pretty: boolean): Uint8Array =>
  Buffer.from(`${pretty ? JSON.stringify(v, null, 2) : JSON.stringify(v)}\n`, "utf8");

/** The package's files, character.json included, as bytes. */
export function packageFiles(spec: PackageSpec): Map<string, Uint8Array> {
  const files = new Map<
    string,
    { bytes: Uint8Array; media: Manifest["files"][number]["media"]; role: Manifest["files"][number]["role"] }
  >();
  for (const p of spec.parts) {
    const doc = CharacterParts.parse({ schema: "erkasa.character.parts/1", parts: p.parts });
    files.set(p.path, { bytes: json(doc, false), media: "application/json", role: "parts" });
  }
  for (const t of spec.textures) files.set(t.path, { bytes: t.bytes, media: t.media, role: "texture" });
  for (const r of spec.reports ?? [])
    files.set(r.path, { bytes: json(r.json, true), media: "application/json", role: "report" });
  for (const p of spec.previews ?? [])
    files.set(p.path, { bytes: p.bytes, media: "image/png", role: "preview" });
  // parts files keep the order given (draw order across files); the others follow, sorted
  const partPaths = spec.parts.map((p) => p.path);
  const others = [...files.keys()].filter((p) => !partPaths.includes(p)).sort();
  const listed = [...partPaths, ...others].map((path) => {
    const f = files.get(path) as {
      bytes: Uint8Array;
      media: Manifest["files"][number]["media"];
      role: Manifest["files"][number]["role"];
    };
    return { path, sha256: sha256(f.bytes), bytes: f.bytes.byteLength, media: f.media, role: f.role };
  });
  const manifest = CharacterPackage.parse({
    ...spec.manifest,
    fingerprint: identityFingerprint(spec.manifest.identity),
    files: listed,
  });
  const out = new Map<string, Uint8Array>([["character.json", json(manifest, true)]]);
  for (const path of [...partPaths, ...others])
    out.set(path, (files.get(path) as { bytes: Uint8Array }).bytes);
  return out;
}

/** Writes the package to `dir` after loading it back through the Runtime; returns the loaded package. */
export async function writePackage(dir: string, spec: PackageSpec): Promise<LoadedCharacter> {
  const files = packageFiles(spec);
  const index = files.get("character.json") as Uint8Array;
  const loaded = await loadCharacterBytes(
    { index, file: (p) => files.get(p), present: [...files.keys()].filter((p) => p !== "character.json") },
    dir,
  );
  if (existsSync(join(dir, "character.json"))) {
    const same = [...files].every(
      ([p, b]) =>
        existsSync(join(dir, p)) && Buffer.compare(readFileSync(join(dir, p)), Buffer.from(b)) === 0,
    );
    if (!same)
      throw new CharacterError(
        "PACKAGE_EXISTS",
        `${dir} already holds a different package: a published version never changes, write a new version`,
      );
    return loaded;
  }
  for (const [p, b] of files) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), b);
  }
  return loaded;
}
