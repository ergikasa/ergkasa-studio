import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AudioCatalog, type AudioCatalogEntry, type MixSettings } from "@erkasa/contracts";

/**
 * The audio library: `audio/catalog.json` (committed: origin, rights, measurements, sections) and the
 * downloaded files in `assets-src/audio/` (never committed: the Pixabay license forbids redistributing
 * a file on its own). An entry is usable in a video only when it was imported and its file still
 * matches the recorded sha256.
 */

const REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export function catalogPath(): string {
  return process.env["ERKASA_AUDIO_CATALOG"] ?? join(REPO_ROOT, "audio", "catalog.json");
}

export function libraryDir(): string {
  return process.env["ERKASA_AUDIO_DIR"] ?? join(REPO_ROOT, "assets-src", "audio");
}

export function loadAudioCatalog(file = catalogPath()): AudioCatalog {
  const parsed = AudioCatalog.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`invalid audio catalog ${file}:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

export function saveAudioCatalog(catalog: AudioCatalog, file = catalogPath()): void {
  writeFileSync(file, `${JSON.stringify(AudioCatalog.parse(catalog), null, 2)}\n`);
}

/** An imported entry with its file on disk: what the sound designer may choose from. */
export interface LibraryItem extends AudioCatalogEntry {
  imported: NonNullable<AudioCatalogEntry["imported"]>;
  path: string;
}

export interface AudioLibrary {
  mix: MixSettings;
  music: LibraryItem[];
  sfx: LibraryItem[];
  /** Entries left out, with the reason (shown by `pnpm audio:check` and in the run report). */
  skipped: { id: string; reason: string }[];
}

/**
 * Entries that can go into a video. `verify` re-hashes every file (slow for big libraries, so the
 * render step only checks that the file exists and has the recorded size class; `audio:check` hashes).
 */
export function openLibrary(
  catalog: AudioCatalog,
  opts: { dir?: string; verify?: (path: string) => string } = {},
): AudioLibrary {
  const dir = opts.dir ?? libraryDir();
  const lib: AudioLibrary = { mix: catalog.mix, music: [], sfx: [], skipped: [] };
  for (const e of catalog.entries) {
    const reason = unusable(e);
    if (reason) {
      lib.skipped.push({ id: e.id, reason });
      continue;
    }
    const path = join(dir, e.file);
    if (!existsSync(path)) {
      lib.skipped.push({ id: e.id, reason: `file missing: ${path}` });
      continue;
    }
    const imported = e.imported;
    if (!imported) continue;
    if (opts.verify && opts.verify(path) !== imported.sha256) {
      lib.skipped.push({
        id: e.id,
        reason: "file changed since import (sha256 differs): run pnpm audio:import",
      });
      continue;
    }
    (e.kind === "music" ? lib.music : lib.sfx).push({ ...e, imported, path });
  }
  return lib;
}

function unusable(e: AudioCatalogEntry): string | undefined {
  if (e.contentIdRegistered) return "Content ID registered at the source";
  if (e.aiGenerated) return "AI-generated at the source";
  if (e.status === "rejected") return `rejected: ${e.rejectedReason ?? ""}`;
  if (e.status !== "imported") return "not imported yet";
  return undefined;
}
