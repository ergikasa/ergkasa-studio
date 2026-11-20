/**
 * Loading a Character Package: character.json against erkasa.character/1, every listed file against its size and
 * sha256, the parts files against erkasa.character.parts/1, the identity against its fingerprint, then the
 * package's internal references (validate.ts). A package that fails any of these is never returned.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { loadImage, type Image } from "@napi-rs/canvas";
import { CharacterPackage, CharacterParts, type CharacterPart } from "@erkasa/contracts";
import { CharacterError, errorsOf, type Finding } from "./errors.js";
import { identityFingerprint, sha256 } from "./hash.js";
import { RUNTIME_REVISION } from "./revision.js";
import { validateCharacter } from "./validate.js";

export type Manifest = CharacterPackage;
export type Part = CharacterPart & { file: string };

export interface LoadedCharacter {
  /** Where it was read from (informational). */
  dir: string;
  /** sha256 of character.json: with id@version, the immutable identity of the package in the Library. */
  sha256: string;
  manifest: Manifest;
  /** Every part, in the order of the parts files and of the parts inside them. */
  parts: readonly Part[];
  partById: ReadonlyMap<string, Part>;
  /** Decoded textures by package path. */
  textures: ReadonlyMap<string, Image>;
  /** Warnings the validator reported (errors stop loading). */
  warnings: readonly Finding[];
}

export interface PackageBytes {
  index: Uint8Array;
  file(path: string): Uint8Array | undefined;
  /** Every file present beside character.json (to report the ones not listed). */
  present: readonly string[];
}

export function readPackageDir(dir: string): PackageBytes {
  const present: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else present.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(dir);
  return {
    index: readFileSync(join(dir, "character.json")),
    file: (path) => {
      try {
        const p = join(dir, path);
        return statSync(p).isFile() ? readFileSync(p) : undefined;
      } catch {
        return undefined;
      }
    },
    present: present.filter((p) => p !== "character.json"),
  };
}

const parseJson = (bytes: Uint8Array, where: string): unknown => {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch (e) {
    throw new CharacterError("JSON", `${where}: ${(e as Error).message}`);
  }
};

export async function loadCharacter(dir: string): Promise<LoadedCharacter> {
  return loadCharacterBytes(readPackageDir(dir), dir);
}

export async function loadCharacterBytes(src: PackageBytes, dir = "(memory)"): Promise<LoadedCharacter> {
  const parsed = CharacterPackage.safeParse(parseJson(src.index, "character.json"));
  if (!parsed.success) {
    const findings: Finding[] = parsed.error.issues.map((i) => ({
      level: "error",
      code: "PACKAGE_SCHEMA",
      where: `character.json#${i.path.join(".")}`,
      message: i.message,
    }));
    throw new CharacterError(
      "PACKAGE_SCHEMA",
      `character.json is not erkasa.character/1 (${findings.length} issues)`,
      findings,
    );
  }
  const manifest = parsed.data;
  const findings: Finding[] = [];
  const add = (level: Finding["level"], code: string, where: string, message: string): void => {
    findings.push({ level, code, where, message });
  };

  if (manifest.compatibility.minRuntime > RUNTIME_REVISION)
    throw new CharacterError(
      "RUNTIME_TOO_OLD",
      `${manifest.id}@${manifest.version} needs runtime revision ${manifest.compatibility.minRuntime}, this is ${RUNTIME_REVISION}`,
    );
  if (identityFingerprint(manifest.identity) !== manifest.fingerprint)
    add(
      "error",
      "FINGERPRINT",
      "character.json#fingerprint",
      "the fingerprint is not the sha256 of the identity",
    );

  const bytes = new Map<string, Uint8Array>();
  const seen = new Set<string>();
  for (const f of manifest.files) {
    if (seen.has(f.path)) add("error", "FILE_DUPLICATE", f.path, "listed twice");
    seen.add(f.path);
    const b = src.file(f.path);
    if (!b) {
      add("error", "FILE_MISSING", f.path, "listed in character.json but not in the package");
      continue;
    }
    if (b.byteLength !== f.bytes)
      add("error", "FILE_SIZE", f.path, `${b.byteLength} bytes, listed ${f.bytes}`);
    if (sha256(b) !== f.sha256) add("error", "FILE_HASH", f.path, "the bytes do not match the listed sha256");
    bytes.set(f.path, b);
  }
  for (const p of src.present)
    if (!seen.has(p))
      add("warning", "FILE_UNLISTED", p, "present in the package folder but not listed (ignored)");
  if (errorsOf(findings).length)
    throw new CharacterError("PACKAGE_FILES", "the package's files do not match character.json", findings);

  const parts: Part[] = [];
  for (const f of manifest.files.filter((x) => x.role === "parts")) {
    const res = CharacterParts.safeParse(parseJson(bytes.get(f.path) as Uint8Array, f.path));
    if (!res.success) {
      for (const i of res.error.issues)
        add("error", "PARTS_SCHEMA", `${f.path}#${i.path.join(".")}`, i.message);
      continue;
    }
    for (const p of res.data.parts) parts.push({ ...p, file: f.path });
  }
  if (errorsOf(findings).length)
    throw new CharacterError("PARTS_SCHEMA", "a parts file is not erkasa.character.parts/1", findings);

  const textures = new Map<string, Image>();
  for (const f of manifest.files.filter((x) => x.role === "texture")) {
    try {
      textures.set(f.path, await loadImage(Buffer.from(bytes.get(f.path) as Uint8Array)));
    } catch (e) {
      add("error", "TEXTURE_DECODE", f.path, (e as Error).message);
    }
  }

  const partById = new Map<string, Part>();
  for (const p of parts) {
    if (partById.has(p.id)) add("error", "PART_DUPLICATE", `${p.file}#${p.id}`, "two parts with this id");
    partById.set(p.id, p);
  }
  const loaded: LoadedCharacter = {
    dir,
    sha256: sha256(src.index),
    manifest,
    parts,
    partById,
    textures,
    warnings: [],
  };
  findings.push(...validateCharacter(loaded));
  if (errorsOf(findings).length)
    throw new CharacterError(
      "PACKAGE_INVALID",
      `${errorsOf(findings).length} problems in the package`,
      findings,
    );
  return { ...loaded, warnings: findings };
}
