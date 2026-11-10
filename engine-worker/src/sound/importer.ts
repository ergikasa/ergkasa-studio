import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AudioCatalog, AudioCatalogEntry, MusicSection, SectionName } from "@erkasa/contracts";
import { autoSections, measureLoudness, probeDurationSec, sha256File } from "./measure.js";

/**
 * `pnpm audio:import`: measures every downloaded file listed in the catalog and records the result
 * (sha256, duration, loudness, proposed sections). Then applies the listening notes, if given.
 * The catalog keeps origin and rights; nothing here touches them except to reject a file whose
 * source page carries a Content ID or AI-generated label.
 */

export interface ImportLine {
  id: string;
  result: "imported" | "unchanged" | "missing" | "rejected" | "error";
  message: string;
}

export interface Measurer {
  sha256(path: string): string;
  duration(path: string): number;
  loudness(path: string): ReturnType<typeof measureLoudness>;
}

export const FFMPEG_MEASURER: Measurer = {
  sha256: sha256File,
  duration: probeDurationSec,
  loudness: measureLoudness,
};

export function importLibrary(
  catalog: AudioCatalog,
  dir: string,
  opts: { measurer?: Measurer; today?: string } = {},
): { catalog: AudioCatalog; lines: ImportLine[] } {
  const m = opts.measurer ?? FFMPEG_MEASURER;
  const today = opts.today ?? new Date().toISOString();
  const lines: ImportLine[] = [];
  const entries = catalog.entries.map((e): AudioCatalogEntry => {
    const path = join(dir, e.file);
    if (!existsSync(path)) {
      lines.push({ id: e.id, result: "missing", message: `download it to ${path}` });
      return e;
    }
    if (e.contentIdRegistered || e.aiGenerated) {
      const reason = e.contentIdRegistered
        ? "Content ID registered at the source"
        : "AI-generated at the source";
      lines.push({ id: e.id, result: "rejected", message: reason });
      const rest = without(e, "imported");
      return { ...rest, status: "rejected", rejectedReason: reason };
    }
    try {
      const sha = m.sha256(path);
      if (e.status === "imported" && e.imported?.sha256 === sha) {
        lines.push({ id: e.id, result: "unchanged", message: "already imported" });
        return e;
      }
      const durationSec = Math.round(m.duration(path) * 100) / 100;
      const loud = m.loudness(path);
      const listened = (e.sections ?? []).filter(
        (s) => s.source === "listened" && s.end <= durationSec + 0.05,
      );
      const auto =
        e.kind === "music"
          ? autoSections(loud.curve, durationSec).filter((s) => !listened.some((l) => l.name === s.name))
          : [];
      const sections = combineSections([...listened, ...auto]);
      const warn: string[] = [];
      if (e.kind === "music" && durationSec < 60) warn.push(`only ${durationSec.toFixed(0)} s long`);
      if (e.kind === "sfx" && durationSec > 15)
        warn.push(`${durationSec.toFixed(0)} s is long for an effect`);
      if (loud.truePeakDb > -0.1) warn.push("clips (true peak above 0 dBFS)");
      lines.push({
        id: e.id,
        result: "imported",
        message: `${durationSec.toFixed(1)} s, ${loud.integrated} LUFS, peak ${loud.truePeakDb} dBTP${
          sections.length ? `, sections ${sections.map((s) => `${s.name}@${fmt(s.start)}`).join(" ")}` : ""
        }${warn.length ? `  WARN ${warn.join("; ")}` : ""}`,
      });
      const rest = without(e, "rejectedReason");
      return {
        ...rest,
        status: "imported",
        imported: {
          sha256: sha,
          durationSec,
          loudnessLufs: loud.integrated,
          truePeakDb: loud.truePeakDb,
          importedAt: today,
        },
        ...(e.kind === "music" ? { sections } : {}),
      };
    } catch (err) {
      lines.push({ id: e.id, result: "error", message: err instanceof Error ? err.message : String(err) });
      return e;
    }
  });
  return { catalog: { ...catalog, entries }, lines };
}

// ------------------------------------------------------------------ listening notes

/**
 * One line per file, as written while listening (see the H1 download list):
 *
 *   m_turn_strings | intro 0:00-0:12 | build 0:12-0:40 | peak 0:40-1:05 | outro 1:05-1:37 | "strings enter at 0:12"
 *   sfx_pop_clean | gain -3 | "a bit loud"
 *   sfx_heart_tense | reject "too dramatic for our style"
 *
 * Lines starting with # and empty lines are ignored. Sections given here become `listened` and
 * replace the automatic proposal for that section name.
 */
export interface NoteResult {
  applied: number;
  errors: string[];
}

export function applyListeningNotes(
  catalog: AudioCatalog,
  text: string,
): { catalog: AudioCatalog } & NoteResult {
  const byId = new Map(catalog.entries.map((e) => [e.id, e]));
  const errors: string[] = [];
  let applied = 0;
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const where = `line ${n + 1}`;
    const parts = line.split("|").map((p) => p.trim());
    const id = parts.shift() ?? "";
    const entry = byId.get(id);
    if (!entry) {
      errors.push(`${where}: unknown id '${id}'`);
      return;
    }
    let next: AudioCatalogEntry = { ...entry };
    const sections: MusicSection[] = [];
    for (const part of parts) {
      const quoted = /^"(.*)"$/.exec(part);
      const section = /^(intro|build|peak|outro)\s+([\d:.]+)\s*[-–]\s*([\d:.]+)$/.exec(part);
      const gain = /^gain\s+([+-]?\d+(?:\.\d+)?)$/.exec(part);
      const reject = /^reject\s+"?(.*?)"?$/.exec(part);
      if (quoted) next.notes = (quoted[1] ?? "").slice(0, 400);
      else if (section) {
        const start = parseTime(section[2] ?? "");
        const end = parseTime(section[3] ?? "");
        if (start === undefined || end === undefined || end <= start) {
          errors.push(`${where}: bad times in '${part}'`);
          continue;
        }
        sections.push({ name: section[1] as SectionName, start, end, source: "listened" });
      } else if (gain) next.gainDb = Math.max(-24, Math.min(12, Number(gain[1])));
      else if (reject) {
        const rest = without(next, "imported");
        next = {
          ...rest,
          status: "rejected",
          rejectedReason: `by ear: ${reject[1] || "rejected"}`.slice(0, 300),
        };
      } else errors.push(`${where}: cannot read '${part}'`);
    }
    if (sections.length) {
      if (entry.kind !== "music") {
        errors.push(`${where}: sections only apply to music`);
        return;
      }
      const dur = entry.imported?.durationSec;
      const bad = sections.find((s) => dur !== undefined && s.end > dur + 0.5);
      if (bad) {
        errors.push(`${where}: ${bad.name} ends at ${fmt(bad.end)}, after the track end ${fmt(dur ?? 0)}`);
        return;
      }
      const clamped = sections.map((s) => (dur !== undefined && s.end > dur ? { ...s, end: dur } : s));
      const kept = (entry.sections ?? []).filter((s) => !clamped.some((c) => c.name === s.name));
      next.sections = combineSections([...kept, ...clamped]);
    }
    byId.set(id, next);
    applied++;
  });
  return {
    catalog: { ...catalog, entries: catalog.entries.map((e) => byId.get(e.id) ?? e) },
    applied,
    errors,
  };
}

/** `1:05`, `0:12.5` or `65` -> seconds. */
export function parseTime(s: string): number | undefined {
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 60 + Number(m[2]);
}

const fmt = (sec: number): string => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(0).padStart(2, "0")}`;

/** Sections confirmed by ear win: an automatic one that overlaps them by more than a second is dropped. */
function combineSections(all: MusicSection[]): MusicSection[] {
  const listened = all.filter((s) => s.source === "listened");
  const overlaps = (a: MusicSection, b: MusicSection): boolean =>
    Math.min(a.end, b.end) - Math.max(a.start, b.start) > 1;
  const auto = all.filter(
    (s) => s.source === "auto" && !listened.some((l) => l.name === s.name || overlaps(l, s)),
  );
  return sortSections([...listened, ...auto]);
}

/** A copy of an entry without one optional field. */
function without<K extends "imported" | "rejectedReason">(
  e: AudioCatalogEntry,
  key: K,
): Omit<AudioCatalogEntry, K> {
  const copy: Partial<AudioCatalogEntry> = { ...e };
  copy[key] = undefined;
  return JSON.parse(JSON.stringify(copy)) as Omit<AudioCatalogEntry, K>;
}

const ORDER: SectionName[] = ["intro", "build", "peak", "outro"];
function sortSections(s: MusicSection[]): MusicSection[] {
  return [...s].sort((a, b) => a.start - b.start || ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
}
