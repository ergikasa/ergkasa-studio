import { runCatalog } from "./producer.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MixSettings } from "@erkasa/contracts";
import { renderMix } from "@erkasa/engine-worker";
import { RUN_FILES, compileRun, loadPlan, stepRender, stepSoundtrack } from "./steps.js";

/**
 * Tools for tuning the sound of a finished run without paying for a new script or voice:
 *
 *   rerender: same run, new soundtrack, rendered to another file (compare with the old video.mp4)
 *   mixRun:   soundtrack only (WAV), optionally several variants of one mix setting, for listening
 */

const MIX_KEYS = [
  "musicUnderVoiceDb",
  "duckDb",
  "duckAttackMs",
  "duckReleaseMs",
  "sfxUnderVoiceDb",
  "crossfadeSec",
  "minSegmentSec",
  "sfxEverySec",
  "minSfxGapSec",
] as const satisfies readonly (keyof MixSettings)[];
type MixKey = (typeof MIX_KEYS)[number];

/** `musicUnderVoiceDb=16,duckDb=9` -> settings. */
export function parseMixSet(text: string | undefined): Partial<MixSettings> {
  const out: Partial<Record<MixKey, number>> = {};
  for (const part of (text ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const [k, v] = part.split("=");
    if (!k || !(MIX_KEYS as readonly string[]).includes(k) || v === undefined || !Number.isFinite(Number(v)))
      throw new Error(`bad mix setting '${part}': use key=number with key one of ${MIX_KEYS.join(", ")}`);
    out[k as MixKey] = Number(v);
  }
  return out;
}

/** `musicUnderVoiceDb=14,18,22` -> one setting per value. */
export function parseVariants(text: string | undefined): { label: string; mix: Partial<MixSettings> }[] {
  if (!text) return [];
  const [k, values] = text.split("=");
  if (!k || !values) throw new Error(`bad --variants '${text}': use key=a,b,c`);
  return values.split(",").map((v) => ({ label: `${k}-${v}`, mix: parseMixSet(`${k}=${v}`) }));
}

function requireRun(dir: string): void {
  if (!existsSync(join(dir, RUN_FILES.plan)))
    throw new Error(`${dir} has no ${RUN_FILES.plan}: not a run folder`);
}

export async function rerender(
  dir: string,
  opts: { name: string; music: boolean; log?: (l: string) => void },
): Promise<string | undefined> {
  requireRun(dir);
  const log = opts.log ?? ((l: string) => console.info(l));
  const catalog = runCatalog(dir);
  let last = -1;
  const res = await stepRender(dir, loadPlan(dir), {
    catalog,
    music: opts.music,
    videoName: opts.name,
    progress: (pct) => {
      if (pct % 10 === 0 && pct !== last) {
        last = pct;
        log(`render ${pct}%`);
      }
    },
  });
  for (const i of res.compiled.issues.filter((x) => x.level === "error"))
    log(`error ${i.code} ${i.path}: ${i.message}`);
  if (res.audio) {
    log(`audio: ${res.audio.mode}`);
    for (const n of res.audio.notes) log(`  ${n}`);
  }
  return res.video;
}

export async function mixRun(
  dir: string,
  opts: {
    set?: Partial<MixSettings>;
    variants?: { label: string; mix: Partial<MixSettings> }[];
    log?: (l: string) => void;
  },
): Promise<string[]> {
  requireRun(dir);
  const log = opts.log ?? ((l: string) => console.info(l));
  const compiled = compileRun(dir, loadPlan(dir), runCatalog(dir));
  const timeline = compiled.timeline;
  if (!timeline)
    throw new Error("the plan does not compile; render it once with pnpm video --from-plan to see why");
  const runs = opts.variants?.length ? opts.variants : [{ label: "", mix: {} }];
  const files: string[] = [];
  for (const v of runs) {
    const st = stepSoundtrack(
      dir,
      { ...compiled, timeline },
      { mix: { ...opts.set, ...v.mix }, write: !v.label },
    );
    if ("missing" in st) throw new Error(st.missing);
    const out = join(dir, v.label ? `mix-${v.label}.wav` : "mix.wav");
    const res = await renderMix(st.plan, st.resolve, out);
    files.push(out);
    if (!v.label) for (const n of st.notes) log(`  ${n}`);
    log(`mix -> ${out} (${res.lufs} LUFS, peak ${res.truePeakDb} dBTP)`);
  }
  return files;
}
