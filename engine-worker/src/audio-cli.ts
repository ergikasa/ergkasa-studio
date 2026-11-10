/**
 * The audio library from the command line (run from the repo root):
 *
 *   pnpm audio:import                     measure the downloaded files, record sha256/loudness/sections
 *   pnpm audio:import --notes notes.txt   ...then apply listening notes (sections, gain, reject)
 *   pnpm audio:check                      what a video may use, and why the rest is left out
 *
 * Files: audio/catalog.json (committed) and assets-src/audio/{music,sfx}/<id>.mp3 (never committed).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { applyListeningNotes, importLibrary } from "./sound/importer.js";
import { catalogPath, libraryDir, loadAudioCatalog, openLibrary, saveAudioCatalog } from "./sound/library.js";
import { sha256File } from "./sound/measure.js";

const userPath = (p: string): string => resolve(process.env["INIT_CWD"] ?? process.cwd(), p);

function runImport(argv: string[]): void {
  const { values } = parseArgs({ args: argv, options: { notes: { type: "string" } } });
  const dir = libraryDir();
  const res = importLibrary(loadAudioCatalog(), dir);
  let catalog = res.catalog;
  const counts: Record<string, number> = {};
  for (const l of res.lines) {
    counts[l.result] = (counts[l.result] ?? 0) + 1;
    if (l.result !== "unchanged") console.info(`${l.result.padEnd(9)} ${l.id.padEnd(22)} ${l.message}`);
  }
  if (values.notes) {
    const file = userPath(values.notes);
    if (!existsSync(file)) throw new Error(`notes file not found: ${file}`);
    const notes = applyListeningNotes(catalog, readFileSync(file, "utf8"));
    catalog = notes.catalog;
    console.info(`\nnotes: ${notes.applied} lines applied`);
    for (const e of notes.errors) console.error(`notes: ${e}`);
    if (notes.errors.length) process.exitCode = 1;
  }
  saveAudioCatalog(catalog);
  console.info(
    `\n${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(
        ", ",
      )}. Library: ${dir}\nCatalog updated: ${catalogPath()} (commit it; the audio files stay out of Git)`,
  );
}

function runCheck(): void {
  const lib = openLibrary(loadAudioCatalog(), { verify: sha256File });
  console.info(`library folder: ${libraryDir()}\ncatalog: ${catalogPath()}\n`);
  console.info(`usable: ${lib.music.length} music, ${lib.sfx.length} effects`);
  for (const m of lib.music) {
    const sections = (m.sections ?? [])
      .map((s) => `${s.name}${s.source === "listened" ? "*" : ""}`)
      .join(" ");
    console.info(`  ${m.id.padEnd(22)} ${(m.roles ?? []).join("/").padEnd(22)} ${sections}`);
  }
  if (lib.skipped.length) {
    console.info(`\nleft out (${lib.skipped.length}):`);
    for (const s of lib.skipped) console.info(`  ${s.id.padEnd(22)} ${s.reason}`);
  }
  console.info("\n* = section confirmed by listening");
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "import") runImport(rest);
  else if (command === "check") runCheck();
  else throw new Error(`unknown command '${command ?? ""}': use import or check`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
