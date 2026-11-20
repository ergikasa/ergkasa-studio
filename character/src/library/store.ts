/**
 * Library operations: verify a package, publish it into the catalog, resolve an immutable reference.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CharacterError,
  errorsOf,
  loadCharacter,
  selfCheck,
  sha256,
  type Finding,
  type LoadedCharacter,
} from "../runtime/index.js";
import { CATALOG_SCHEMA, Catalog, immutableRef, parseImmutableRef, type CatalogEntry } from "./catalog.js";

/** The repository's library folder. */
export const LIBRARY_ROOT = resolvePath(fileURLToPath(new URL(".", import.meta.url)), "../../../library");

export interface Verified {
  character: LoadedCharacter;
  /** Warnings of loading and the self-check's findings. */
  findings: Finding[];
}

/** Loads (schema, files, hashes, references) and self-checks the capability manifest. Throws on any error. */
export async function verifyPackage(dir: string): Promise<Verified> {
  const character = await loadCharacter(dir);
  const findings = [...character.warnings, ...selfCheck(character)];
  if (errorsOf(findings).length)
    throw new CharacterError("CAPABILITY_UNPROVEN", `${errorsOf(findings).length} declared capabilities have no effect`, findings);
  return { character, findings };
}

export function readCatalog(root = LIBRARY_ROOT): Catalog {
  const p = join(root, "catalog.json");
  if (!existsSync(p)) return { schema: CATALOG_SCHEMA, characters: [] };
  return Catalog.parse(JSON.parse(readFileSync(p, "utf8")));
}

function writeCatalog(root: string, c: Catalog): void {
  const sorted = [...c.characters].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version));
  writeFileSync(join(root, "catalog.json"), `${JSON.stringify(Catalog.parse({ ...c, characters: sorted }), null, 2)}\n`);
}

export function entryOf(c: LoadedCharacter, root: string): CatalogEntry {
  const m = c.manifest;
  const cap = m.capabilities;
  return {
    id: m.id,
    version: m.version,
    ref: `${m.id}@${m.version}`,
    sha256: c.sha256,
    fingerprint: m.fingerprint,
    name: m.name,
    purpose: m.purpose,
    approval: m.approval.status,
    build: m.identity.build,
    ...(m.identity.ageYears !== undefined ? { ageYears: m.identity.ageYears } : {}),
    path: relative(root, c.dir).split("\\").join("/"),
    outfits: m.wardrobe.filter((o) => cap.wardrobe.includes(o.id)).map((o) => ({ id: o.id, tags: o.tags })),
    views: cap.views,
    face: cap.face,
    fingers: cap.hands.fingers,
    locomotion: cap.locomotion,
    interactions: cap.interactions,
  };
}

/**
 * Adds a verified package to the catalog. The folder must be `characters/<id>/<version>` under the root; the same
 * id@version with other bytes is refused (IMMUTABLE); a reference character needs the PO's approval.
 */
export async function publish(dir: string, root = LIBRARY_ROOT): Promise<CatalogEntry> {
  const { character } = await verifyPackage(dir);
  const m = character.manifest;
  const expected = join(root, "characters", m.id, String(m.version));
  if (resolvePath(dir) !== resolvePath(expected))
    throw new CharacterError("LIBRARY_PATH", `${m.id}@${m.version} must live in ${expected}`);
  if (m.purpose === "reference" && m.approval.status !== "approved")
    throw new CharacterError("NOT_APPROVED", `${m.id}@${m.version} is a reference character without the PO's approval`);
  const prev = m.compatibility.previousVersion;
  const catalog = readCatalog(root);
  if (prev !== undefined) {
    const p = catalog.characters.find((e) => e.id === m.id && e.version === prev);
    if (!p) throw new CharacterError("PREVIOUS_UNKNOWN", `${m.id}@${prev} is not in the catalog`);
    if (p.fingerprint !== m.fingerprint)
      throw new CharacterError("IDENTITY_CHANGED", `${m.id}@${m.version} changes the identity of @${prev}: use another id`);
  }
  const entry = entryOf(character, root);
  const existing = catalog.characters.find((e) => e.id === m.id && e.version === m.version);
  if (existing) {
    if (existing.sha256 !== entry.sha256)
      throw new CharacterError("IMMUTABLE", `${m.id}@${m.version} is published with other bytes (${existing.sha256})`);
    return existing;
  }
  writeCatalog(root, { ...catalog, characters: [...catalog.characters, entry] });
  return entry;
}

/** Resolves an immutable reference to its folder, checking the bytes against the catalog and the reference. */
export function resolveRef(ref: string, root = LIBRARY_ROOT): { dir: string; entry: CatalogEntry } {
  const r = parseImmutableRef(ref);
  const entry = readCatalog(root).characters.find((e) => e.id === r.id && e.version === r.version);
  if (!entry) throw new CharacterError("CHARACTER_UNKNOWN", `${r.id}@${r.version} is not in the catalog`);
  if (entry.sha256 !== r.sha256) throw new CharacterError("CHARACTER_HASH", `${ref} does not match the catalog (${entry.sha256})`);
  const dir = join(root, entry.path);
  const index = join(dir, "character.json");
  if (!existsSync(index)) throw new CharacterError("CHARACTER_MISSING", `${dir} has no character.json`);
  if (sha256(readFileSync(index)) !== entry.sha256)
    throw new CharacterError("CHARACTER_HASH", `${dir}/character.json changed after it was published`);
  return { dir, entry };
}

/** Every package folder under the root (characters/<id>/<version>). */
export function packageDirs(root = LIBRARY_ROOT): string[] {
  const base = join(root, "characters");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(base, d.name), { withFileTypes: true })
        .filter((v) => v.isDirectory() && /^\d+$/.test(v.name))
        .map((v) => join(base, d.name, v.name)),
    )
    .sort();
}

export { immutableRef };
