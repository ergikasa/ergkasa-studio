import type {
  AudioPlan,
  MixSettings,
  MusicRole,
  RenderTimeline,
  SectionName,
  StoryBeat,
} from "@erkasa/contracts";
import type { AudioLibrary, LibraryItem } from "./library.js";

/**
 * The sound designer. From the compiled timeline and the story beats it writes the Audio Plan:
 *
 * - Music follows the emotional arc, not the clock: consecutive scenes with the same role share one
 *   track, short changes are merged (no track hopping), a twist is announced by a moment of space,
 *   the turn swells in, and the last track is placed so its own ending lands on the video's end.
 * - Effects play on events the viewer can see or feel (a phone buzzes, a watch is checked, a twist
 *   lands), never on every animation. Priorities, a density budget and per-file caps keep them rare.
 *
 * Deterministic: same inputs, same plan. Every choice carries a reason, so a mix can be explained.
 */

export interface SceneStory {
  sceneId: string;
  beat?: StoryBeat;
  emotion?: string;
  emphasis?: string;
}

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface DesignInput {
  timeline: RenderTimeline;
  /** Beats per scene, from the script. Missing beats are inferred from the position. */
  story: SceneStory[];
  /** Narration words with times from the video start (CompileResult.scenes[].words). */
  words?: Record<string, TimedWord[]>;
  /** Effects the plan asked for explicitly (CompileResult.sfx): their tag is the event. */
  planned?: { sceneId: string; tag: string; atSec: number; gainDb: number }[];
  voice: AudioPlan["voice"];
  voiceLufs?: number;
  library: AudioLibrary;
  seed?: number;
}

export interface DesignResult {
  plan: AudioPlan;
  /** Human-readable decisions and what was left out. */
  notes: string[];
}

/** ElevenLabs narration usually measures around here; used only when the voice was not measured. */
export const DEFAULT_VOICE_LUFS = -18;

const SAD = /(sad|guilt|guilty|ashamed|shame|lonely|tired|exhausted|regret|empty|hopeless|defeated|numb)/;

export function roleFor(story: SceneStory | undefined, index: number, count: number): MusicRole {
  const beat = story?.beat;
  if (!beat) return index === 0 ? "hook" : index === count - 1 ? "resolve" : "explain";
  if ((beat === "relate" || beat === "explain") && story.emotion && SAD.test(story.emotion.toLowerCase()))
    return "reflection";
  return beat;
}

/** What a role may borrow when the library has nothing for it, in order. */
const FALLBACK: Record<MusicRole, MusicRole[]> = {
  hook: ["relate", "twist", "explain"],
  relate: ["hook", "reflection", "explain"],
  explain: ["relate", "hook", "reflection"],
  tension: ["twist", "reflection"],
  twist: ["tension", "hook"],
  reflection: ["relate", "explain"],
  turn: ["resolve", "relate"],
  resolve: ["turn", "relate"],
};

/** Which part of a track suits the role. */
const SECTION_FOR: Record<MusicRole, SectionName> = {
  hook: "intro",
  relate: "intro",
  explain: "intro",
  tension: "build",
  twist: "build",
  reflection: "intro",
  turn: "peak",
  resolve: "outro",
};

/** Level of the role relative to the bed level (dB). Explain sits lowest: it is about the words. */
const ROLE_DB: Record<MusicRole, number> = {
  hook: 0,
  relate: 0,
  explain: -2,
  tension: 1,
  twist: 1,
  reflection: -1,
  turn: 2.5,
  resolve: 1.5,
};

/** When short segments merge, the more important one keeps its role. */
const WEIGHT: Record<MusicRole, number> = {
  twist: 6,
  turn: 6,
  resolve: 5,
  tension: 4,
  hook: 3,
  reflection: 3,
  relate: 2,
  explain: 1,
};

/** A twist or a turn is a moment, not a chapter: it may keep a short music segment of its own. */
function minLength(role: MusicRole, mix: MixSettings): number {
  return role === "twist" || role === "turn" ? Math.min(mix.minSegmentSec, 5) : mix.minSegmentSec;
}

interface Span {
  role: MusicRole;
  start: number;
  end: number;
  scenes: string[];
}

export function designSoundtrack(input: DesignInput): DesignResult {
  const { timeline, library } = input;
  const mix = library.mix;
  const fps = timeline.fps;
  const last = timeline.scenes[timeline.scenes.length - 1];
  const durationSec = last ? (last.from + last.duration) / fps : 0;
  const voiceLufs = input.voiceLufs ?? DEFAULT_VOICE_LUFS;
  const notes: string[] = [];
  if (input.voiceLufs === undefined && input.voice.length)
    notes.push(`voice loudness not measured; assumed ${DEFAULT_VOICE_LUFS} LUFS`);

  const storyById = new Map(input.story.map((s) => [s.sceneId, s]));
  const spans: Span[] = timeline.scenes.map((s, i) => ({
    role: roleFor(storyById.get(s.sceneId), i, timeline.scenes.length),
    start: s.from / fps,
    end: (s.from + s.duration) / fps,
    scenes: [s.sceneId],
  }));
  if (!input.story.some((s) => s.beat)) notes.push("no story beats: music roles inferred from scene order");

  const music = library.music.length
    ? planMusic(mergeSpans(spans, mix), durationSec, voiceLufs, input, notes)
    : [];
  if (!library.music.length) notes.push("music library empty: no music (run pnpm audio:import)");
  const sfx = planSfx(input, spans, durationSec, voiceLufs, notes);

  const plan: AudioPlan = {
    schema: "erkasa.audio-plan/2",
    durationSec: round(Math.max(durationSec, 0.1)),
    voice: input.voice,
    ...(input.voiceLufs !== undefined ? { voiceLufs: input.voiceLufs } : {}),
    music,
    ducking: { amountDb: mix.duckDb, attackMs: mix.duckAttackMs, releaseMs: mix.duckReleaseMs },
    sfx,
    loudness: { targetLufs: mix.targetLufs, truePeakDb: mix.truePeakDb },
  };
  return { plan, notes };
}

// ------------------------------------------------------------------ music

export function mergeSpans(spans: Span[], mix: MixSettings): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    if (prev && prev.role === s.role) {
      prev.end = s.end;
      prev.scenes.push(...s.scenes);
    } else out.push({ ...s, scenes: [...s.scenes] });
  }
  // fold short segments into a neighbour until every change is long enough to feel deliberate
  const total = out.reduce((n, s) => n + (s.end - s.start), 0);
  const maxSegments = Math.max(1, Math.ceil(total / 15) + 1);
  for (;;) {
    let shortest = -1;
    out.forEach((s, i) => {
      const len = s.end - s.start;
      const cur = out[shortest];
      if (len < minLength(s.role, mix) && (!cur || len < cur.end - cur.start)) shortest = i;
    });
    if (shortest < 0 && out.length > maxSegments)
      shortest = out.reduce(
        (best, s, i) => (WEIGHT[s.role] < WEIGHT[out[best]?.role ?? "twist"] ? i : best),
        0,
      );
    if (shortest < 0 || out.length === 1) break;
    const s = out[shortest];
    const before = out[shortest - 1];
    const after = out[shortest + 1];
    if (!s) break;
    // merge with the lighter neighbour, so twist/turn keep their own music
    const into = !before
      ? after
      : !after
        ? before
        : WEIGHT[before.role] <= WEIGHT[after.role]
          ? before
          : after;
    if (!into) break;
    const role = WEIGHT[into.role] >= WEIGHT[s.role] ? into.role : s.role;
    into.start = Math.min(into.start, s.start);
    into.end = Math.max(into.end, s.end);
    into.scenes = into === before ? [...into.scenes, ...s.scenes] : [...s.scenes, ...into.scenes];
    into.role = role;
    out.splice(shortest, 1);
    // neighbours may now share a role
    for (let i = out.length - 1; i > 0; i--) {
      const a = out[i - 1];
      const b = out[i];
      if (a && b && a.role === b.role) {
        a.end = b.end;
        a.scenes.push(...b.scenes);
        out.splice(i, 1);
      }
    }
  }
  return out;
}

function planMusic(
  spans: Span[],
  durationSec: number,
  voiceLufs: number,
  input: DesignInput,
  notes: string[],
): AudioPlan["music"] {
  const mix = input.library.mix;
  const used = new Map<string, number>();
  const segments: AudioPlan["music"] = [];
  let prev: LibraryItem | undefined;
  spans.forEach((span, i) => {
    const isFirst = i === 0;
    const isLast = i === spans.length - 1;
    const next = spans[i + 1];
    const track = pickTrack(
      span.role,
      input.library.music,
      used,
      prev,
      input.seed ?? 0,
      span.scenes[0] ?? "",
    );
    if (!track) return;
    used.set(track.id, (used.get(track.id) ?? 0) + 1);

    // timing on the video: overlap neighbours for a crossfade; a twist gets a breath of silence first
    const xfIn = span.role === "turn" ? mix.crossfadeSec * 1.6 : mix.crossfadeSec;
    let start = isFirst ? 0 : span.start - xfIn / 2;
    let fadeIn = isFirst ? 0.4 : xfIn;
    if (span.role === "twist" && !isFirst) {
      start = span.start + 0.25;
      fadeIn = 0.3;
    }
    // the boundary is where the next scene starts (it may overlap this one during a transition)
    const boundary = next ? next.start : durationSec;
    let end = isLast
      ? durationSec
      : boundary + (next?.role === "turn" ? mix.crossfadeSec * 0.8 : mix.crossfadeSec / 2);
    let fadeOut = isLast ? 2.2 : next?.role === "turn" ? mix.crossfadeSec * 1.6 : mix.crossfadeSec;
    if (next?.role === "twist") {
      end = boundary - 0.1;
      fadeOut = 0.9;
    }
    start = Math.max(0, start);
    end = Math.min(durationSec, Math.max(end, start + 0.5));
    const len = end - start;

    const wanted = SECTION_FOR[span.role];
    const sec = track.sections?.find((s) => s.name === wanted);
    const dur = track.imported.durationSec;
    let offset: number;
    if (isLast && dur >= len)
      offset = dur - len; // the track's own ending closes the video
    else if (sec) offset = Math.max(0, sec.start - (span.role === "turn" ? fadeIn * 0.5 : 0));
    else offset = { intro: 0, build: 0.25, peak: 0.5, outro: 0.75 }[wanted] * Math.max(0, dur - len);
    if (offset + len > dur) offset = Math.max(0, dur - len);
    if (dur < len)
      notes.push(
        `${track.id} (${dur.toFixed(0)} s) is shorter than its ${len.toFixed(0)} s segment: it loops`,
      );

    const gainDb = clampDb(
      voiceLufs - mix.musicUnderVoiceDb - track.imported.loudnessLufs + ROLE_DB[span.role] + track.gainDb,
    );
    segments.push({
      assetId: track.id,
      role: span.role,
      ...(sec || isLast ? { section: isLast && dur >= len ? "outro" : wanted } : {}),
      startSec: round(start),
      endSec: round(end),
      offsetSec: round(offset),
      gainDb: round(gainDb),
      fadeInSec: round(Math.min(fadeIn, len / 2)),
      fadeOutSec: round(Math.min(fadeOut, len / 2)),
    });
    notes.push(
      `music ${fmt(start)}-${fmt(end)} ${span.role} (${span.scenes.join(",")}): ${track.id} from ${fmt(offset)}${sec ? ` [${sec.name}, ${sec.source}]` : ""}`,
    );
    prev = track;
  });
  return segments;
}

function pickTrack(
  role: MusicRole,
  tracks: LibraryItem[],
  used: Map<string, number>,
  prev: LibraryItem | undefined,
  seed: number,
  salt: string,
): LibraryItem | undefined {
  const score = (t: LibraryItem): number => {
    const roles = t.roles ?? [];
    let s = 0;
    if (roles[0] === role) s += 100;
    else if (roles.includes(role)) s += 70;
    else {
      const fb = FALLBACK[role].findIndex((r) => roles.includes(r));
      s += fb >= 0 ? 40 - fb * 10 : 0;
    }
    if (prev && t.id === prev.id) s -= 200; // never the same track twice in a row
    s -= (used.get(t.id) ?? 0) * 30; // spread the library
    if (prev && t.author === prev.author) s += 8; // same composer: the score sounds like one piece
    return s;
  };
  const ranked = tracks
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s || hash(`${seed}:${salt}:${a.t.id}`) - hash(`${seed}:${salt}:${b.t.id}`));
  const best = ranked[0];
  return best && best.s > -150 ? best.t : tracks.length === 1 ? tracks[0] : undefined;
}

// ------------------------------------------------------------------ effects

interface Candidate {
  event: string;
  atSec: number;
  priority: number;
  reason: string;
  /** Effects designed as a pair (riser + hit) may sit closer than the minimum gap. */
  group?: string;
  /** Place so the sound ENDS here (risers). */
  endsAt?: boolean;
  maxSec?: number;
}

const ACTION_EVENT: Record<string, { event: string; priority: number }> = {
  use_phone: { event: "action_use_phone", priority: 2 },
  walk_phone: { event: "action_walk_phone", priority: 2 },
  read: { event: "action_read", priority: 2 },
  type: { event: "action_type", priority: 2 },
  check_watch: { event: "action_check_watch", priority: 3 },
  stressed: { event: "action_stressed", priority: 2 },
  walk: { event: "action_walk", priority: 1 },
};

/** Roles where a phone means "distraction" (a notification sells it). */
const DISTRACTION_ROLES = new Set<MusicRole>(["hook", "relate", "tension", "reflection"]);

export function collectEvents(input: DesignInput, spans: Span[]): Candidate[] {
  const { timeline } = input;
  const fps = timeline.fps;
  const out: Candidate[] = [];
  const roleOf = new Map(spans.flatMap((s) => s.scenes.map((id) => [id, s.role] as const)));
  let distractions = 0;
  let prevRole: MusicRole | undefined;
  timeline.scenes.forEach((scene) => {
    const t0 = scene.from / fps;
    const at = (f: number): number => (scene.from + f) / fps;
    const role = roleOf.get(scene.sceneId) ?? "explain";
    const id = scene.sceneId;

    if (["whip", "slide", "zoom", "wipe"].includes(scene.transitionIn.type))
      out.push({
        event: "scene_cut",
        atSec: Math.max(0, t0 - 0.12),
        priority: 2,
        reason: `${id} ${scene.transitionIn.type} in`,
      });
    if (role === "reflection" && prevRole && prevRole !== "reflection")
      out.push({ event: "into_reflection", atSec: t0, priority: 3, reason: `${id} into reflection` });
    prevRole = role;

    // quick punch-in of the camera (not the slow drift)
    const zoom = scene.camera["zoom"] ?? [];
    zoom.forEach((k, i) => {
      const p = zoom[i - 1];
      if (p && typeof k.v === "number" && typeof p.v === "number" && k.f - p.f <= 12 && k.v > p.v * 1.1)
        out.push({ event: "camera_push", atSec: at(p.f), priority: 1, reason: `${id} camera punch-in` });
    });

    for (const node of scene.nodes) {
      const asset = node.asset ?? "";
      const enter = entranceFrame(node.tracks);
      if (node.adapter === "text" && enter !== undefined)
        out.push({
          event: "text_in",
          atSec: at(enter),
          priority: enter > 3 ? 2 : 1,
          reason: `${id} ${node.id} appears`,
        });
      if (node.adapter === "motion_graphics" && enter !== undefined)
        out.push({
          event: "chart_in",
          atSec: at(enter),
          priority: 2,
          reason: `${id} ${node.id} chart appears`,
        });
      if (node.adapter === "svg" && enter !== undefined && enter > 3)
        out.push({ event: "object_in", atSec: at(enter), priority: 1, reason: `${id} ${node.id} enters` });
      if (/timer|clock|hourglass/.test(asset))
        out.push({
          event: /timer|hourglass/.test(asset) ? "timer_in" : "clock_object",
          atSec: at(enter ?? 0) + 0.1,
          priority: 2,
          reason: `${id} ${node.id} (${asset})`,
          maxSec: 4,
        });
      if (/glass/.test(asset))
        out.push({
          event: "glass_knock",
          atSec: at(enter ?? 0) + 0.3,
          priority: 2,
          reason: `${id} ${node.id} glass`,
        });

      if (node.adapter === "character") {
        const seen = new Set<string>();
        for (const k of node.tracks["clip"] ?? []) {
          const action = String(k.v);
          const ev = ACTION_EVENT[action];
          if (!ev || seen.has(action)) continue; // first time in the scene only
          seen.add(action);
          const priority =
            action === "stressed" && (role === "tension" || role === "twist") ? 3 : ev.priority;
          out.push({
            event: ev.event,
            atSec: at(k.f) + 0.15,
            priority,
            reason: `${id} ${node.id} ${action}`,
            ...(action === "type" ? { maxSec: 2.5 } : {}),
          });
          if (
            (action === "use_phone" || action === "walk_phone") &&
            DISTRACTION_ROLES.has(role) &&
            distractions < 2
          ) {
            distractions++;
            out.push({
              event: "phone_distraction",
              atSec: Math.max(0, at(k.f) - 0.25),
              priority: 3,
              reason: `${id} the phone pulls ${node.id} away`,
            });
          }
        }
        if (node.props["holding"] === "document" && !seen.has("read"))
          out.push({
            event: "holding_document",
            atSec: t0 + 0.2,
            priority: 1,
            reason: `${id} ${node.id} holds a document`,
          });
      }
    }

    const story = input.story.find((s) => s.sceneId === id);
    const emph = emphasisTime(story?.emphasis, input.words?.[id]) ?? t0 + 0.6;
    if (role === "twist") {
      out.push({
        event: "before_twist",
        atSec: t0,
        priority: 4,
        reason: `${id} build into the twist`,
        group: id,
        endsAt: true,
        maxSec: 2.5,
      });
      out.push({
        event: "twist_reveal",
        atSec: t0 + 0.25,
        priority: 4,
        reason: `${id} the twist lands`,
        group: id,
      });
    }
    if (role === "turn") {
      out.push({
        event: "before_turn",
        atSec: t0,
        priority: 3,
        reason: `${id} lift into the turn`,
        group: id,
        endsAt: true,
        maxSec: 3,
      });
      out.push({ event: "turn_insight", atSec: emph, priority: 4, reason: `${id} the insight`, group: id });
    }
    if (role === "resolve")
      out.push({ event: "resolve_win", atSec: emph, priority: 3, reason: `${id} resolution` });
  });
  const lastTension = [...timeline.scenes].reverse().find((s) => roleOf.get(s.sceneId) === "tension");
  if (lastTension) {
    const story = input.story.find((s) => s.sceneId === lastTension.sceneId);
    const t = emphasisTime(story?.emphasis, input.words?.[lastTension.sceneId]);
    if (t !== undefined)
      out.push({
        event: "tension_peak",
        atSec: t,
        priority: 2,
        reason: `${lastTension.sceneId} tension peaks`,
        maxSec: 3,
      });
  }
  for (const p of input.planned ?? [])
    out.push({ event: p.tag, atSec: p.atSec, priority: 5, reason: `${p.sceneId} planned '${p.tag}'` });
  return out;
}

function planSfx(
  input: DesignInput,
  spans: Span[],
  durationSec: number,
  voiceLufs: number,
  notes: string[],
): AudioPlan["sfx"] {
  const mix = input.library.mix;
  const lib = input.library.sfx;
  if (!lib.length) {
    notes.push("no sound effects imported");
    return [];
  }
  const candidates = collectEvents(input, spans).sort((a, b) => b.priority - a.priority || a.atSec - b.atSec);
  const budget = Math.max(1, Math.floor(durationSec / mix.sfxEverySec));
  const uses = new Map<string, number>();
  const accepted: (Candidate & { item: LibraryItem; at: number; offset: number })[] = [];
  const emphasized = emphasisOnsets(input);
  const dropped: string[] = [];
  for (const c of candidates) {
    if (accepted.length >= budget) {
      dropped.push(`${c.reason} (budget)`);
      continue;
    }
    const options = lib.filter(
      (i) => i.events?.includes(c.event) && (uses.get(i.id) ?? 0) < (i.maxPerVideo ?? 99),
    );
    if (!options.length) {
      if (lib.some((i) => i.events?.includes(c.event))) dropped.push(`${c.reason} (cap)`);
      continue;
    }
    const item = [...options].sort(
      (a, b) =>
        (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0) ||
        hash(`${input.seed ?? 0}:${c.reason}:${a.id}`) - hash(`${input.seed ?? 0}:${c.reason}:${b.id}`),
    )[0];
    if (!item) continue;
    const dur = item.imported.durationSec;
    const play = Math.min(dur, c.maxSec ?? dur);
    const offset = c.endsAt ? Math.max(0, dur - play) : 0;
    const at = Math.max(0, c.endsAt ? c.atSec - play : c.atSec);
    if (at >= durationSec - 0.2) continue;
    const near = accepted.find(
      (a) => Math.abs(a.at - at) < mix.minSfxGapSec && !(c.group && a.group === c.group),
    );
    if (near) {
      dropped.push(`${c.reason} (too close to ${near.reason})`);
      continue;
    }
    // a transient right on an emphasized word steps on the most important syllable
    if (c.priority < 4 && emphasized.some((w) => at > w - 0.15 && at < w + 0.05)) {
      dropped.push(`${c.reason} (on an emphasized word)`);
      continue;
    }
    uses.set(item.id, (uses.get(item.id) ?? 0) + 1);
    accepted.push({ ...c, item, at, offset });
  }
  if (dropped.length) notes.push(`effects left out: ${dropped.join("; ")}`);
  return accepted
    .sort((a, b) => a.at - b.at)
    .map((a) => {
      const trim = { transition: -2, ui: 0, phone: 0, time: -3, object: -1, body: -2, beat: 1, metaphor: 0 }[
        a.item.category ?? "ui"
      ];
      const gainDb = clampDb(
        voiceLufs - mix.sfxUnderVoiceDb - a.item.imported.loudnessLufs + trim + a.item.gainDb,
      );
      notes.push(`sfx ${fmt(a.at)} ${a.item.id}: ${a.reason}`);
      return {
        assetId: a.item.id,
        atSec: round(a.at),
        gainDb: round(gainDb),
        ...(a.offset > 0 ? { offsetSec: round(a.offset) } : {}),
        ...(a.maxSec && a.maxSec < a.item.imported.durationSec ? { maxSec: a.maxSec } : {}),
        reason: a.reason.slice(0, 120),
      };
    });
}

/** First frame where a node becomes visible (scale or opacity rising from 0), if it pops in. */
function entranceFrame(tracks: Record<string, { f: number; v: unknown }[]>): number | undefined {
  for (const name of ["opacity", "scale"]) {
    const k = tracks[name];
    if (!k || k.length < 2) continue;
    const i = k.findIndex((kf, j) => j > 0 && Number(kf.v) > 0 && Number(k[j - 1]?.v) === 0);
    if (i > 0) return k[i - 1]?.f;
  }
  return undefined;
}

function emphasisTime(emphasis: string | undefined, words: TimedWord[] | undefined): number | undefined {
  if (!emphasis || !words?.length) return undefined;
  const first = norm(emphasis.split(/\s+/)[0] ?? "");
  return words.find((w) => norm(w.word) === first)?.start;
}

function emphasisOnsets(input: DesignInput): number[] {
  return input.story.flatMap((s) => {
    const t = emphasisTime(s.emphasis, input.words?.[s.sceneId]);
    return t === undefined ? [] : [t];
  });
}

const norm = (w: string): string => w.toLowerCase().replace(/[^a-z0-9']/g, "");
const round = (n: number): number => Math.round(n * 1000) / 1000;
const clampDb = (n: number): number => Math.max(-60, Math.min(12, n));
const fmt = (sec: number): string => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;

/** Small stable string hash (FNV-1a) for deterministic tie-breaks. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
