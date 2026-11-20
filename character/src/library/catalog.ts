/**
 * The Character Library: published packages under `library/characters/<id>/<version>/`, and `library/catalog.json`,
 * the index the planning layer reads (who exists, what each can do, which outfits). The catalog holds no artwork.
 *
 * Identity of a published package: `id@version` and the sha256 of its character.json (which lists the sha256 of
 * every other file). The immutable reference is written `chr_name@3#sha256:<hex>`. A version, once in the
 * catalog, never changes: publishing different bytes under the same id@version is refused.
 *
 * Engines never read the Library: the stager resolves a reference and puts the package, hash-pinned, into the
 * render package (Phase 5). The Runtime never imports this module (test/boundary.test.ts).
 */
import { z } from "zod";
import { CharacterId, CharacterRef, FACS_AUS, Sha256, VISEMES } from "@erkasa/contracts";

export const CATALOG_SCHEMA = "erkasa.character-catalog/1";

export const CatalogEntry = z
  .object({
    id: CharacterId,
    version: z.number().int().min(1),
    ref: CharacterRef,
    /** sha256 of character.json. */
    sha256: Sha256,
    fingerprint: Sha256,
    name: z.string().min(1),
    purpose: z.enum(["reference", "technical_test"]),
    approval: z.enum(["approved", "pending", "rejected"]),
    build: z.enum(["man", "woman", "neutral"]),
    ageYears: z.number().int().optional(),
    /** Folder relative to the library root. */
    path: z.string().regex(/^characters\/chr_[a-z0-9_]+\/\d+$/),
    outfits: z.array(z.object({ id: z.string(), tags: z.array(z.string()) }).strict()),
    views: z.record(z.string(), z.array(z.string())),
    face: z
      .object({
        aus: z.array(z.enum(FACS_AUS)),
        visemes: z.array(z.enum(VISEMES)),
        blink: z.boolean(),
        gaze: z.boolean(),
        jaw: z.boolean(),
      })
      .strict(),
    fingers: z.boolean(),
    locomotion: z.array(z.string()),
    interactions: z.array(z.string()),
  })
  .strict();
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z
  .object({
    schema: z.literal(CATALOG_SCHEMA),
    characters: z.array(CatalogEntry),
  })
  .strict();
export type Catalog = z.infer<typeof Catalog>;

const IMMUTABLE = /^(chr_[a-z0-9_]{1,60})@(\d+)#sha256:([a-f0-9]{64})$/;

export const immutableRef = (e: Pick<CatalogEntry, "id" | "version" | "sha256">): string =>
  `${e.id}@${e.version}#sha256:${e.sha256}`;

export function parseImmutableRef(s: string): { id: string; version: number; sha256: string } {
  const m = IMMUTABLE.exec(s);
  if (!m) throw new Error(`'${s}' is not an immutable character reference (chr_name@3#sha256:<64 hex>)`);
  return { id: m[1] as string, version: Number(m[2]), sha256: m[3] as string };
}
