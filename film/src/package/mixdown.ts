/**
 * The engine's mixdown of a package's audio clips (E1.5), as the capabilities publish it (encoding.ts AUDIO):
 * the FFmpeg inputs and filter graph that mix the clips over the joined video, normalise loudness and encode AAC.
 * Pure: the clips come from the verified package, the files are the verified bytes written by encode.ts.
 */
import { clipStartMs, gainLinear, type RenderPackage } from "@erkasa/contracts";
import { AUDIO } from "./encoding.js";

type Clip = RenderPackage["audio"][number];

/** The fade curve the capabilities publish (AUDIO.fades). */
const CURVE = AUDIO.fades?.curve ?? "qsin";

/** Whether a clip plays only part of its file (then the engine cuts it to [trim, trim + duration]). */
export function playsPart(c: Clip, fileSec: number, filmSec: number): boolean {
  const ends = c.start + c.duration;
  return c.trim > 0 || (c.duration < fileSec - c.trim - 1e-6 && ends < filmSec - 1e-6);
}

/**
 * The sidechaincompress `mix` that limits the duck to `db` (E1.6): the output is dry × (1 − mix) + compressed × mix,
 * so even a fully compressed music stays at 10^(−db/20) of its level.
 */
export function duckMix(db: number): number {
  return Math.min(1, Math.max(0, 1 - 10 ** (-db / 20)));
}

/**
 * The FFmpeg arguments that mux `video` with the package's mix into `out`, given each clip's file and the length
 * of that file in seconds (read from the verified bytes); undefined when the package has no audio clip (the
 * video stays without an audio stream).
 */
export function mixdownArgs(
  pkg: RenderPackage,
  video: string,
  fileOf: (clip: Clip) => string,
  out: string,
  fileSecOf: (clip: Clip) => number,
): string[] | undefined {
  if (!pkg.audio.length) return undefined;
  const music = pkg.audio.filter((c) => c.role === "music");
  const voices = pkg.audio.filter((c) => c.role === "voice");
  const sfx = pkg.audio.filter((c) => c.role === "sfx");
  if (music.length + voices.length + sfx.length !== pkg.audio.length)
    throw new Error("the mixdown takes voice, music and sfx clips (the gate refuses anything else)");
  const inputs = ["-i", video];
  const graph: string[] = [];
  let idx = 1;
  const gain = (db: number): string => (db === 0 ? "" : `volume=${gainLinear(db)}`);
  const film = pkg.output.duration;
  /** Cut and fades (E1.6): no stage when the clip plays its whole file (or plays to the film's end) without fades. */
  const shape = (c: Clip): string[] => {
    const st: string[] = [];
    if (playsPart(c, fileSecOf(c), film))
      st.push(`atrim=start=${c.trim}:duration=${c.duration}`, "asetpts=PTS-STARTPTS");
    if (c.fadeIn > 0) st.push(`afade=t=in:st=0:d=${c.fadeIn}:curve=${CURVE}`);
    if (c.fadeOut > 0) st.push(`afade=t=out:st=${c.duration - c.fadeOut}:d=${c.fadeOut}:curve=${CURVE}`);
    return st;
  };
  const ms = (c: Clip): number => {
    const n = clipStartMs(c.start);
    if (n === undefined) throw new Error(`${c.role} clip ${c.id} does not start on a whole millisecond`);
    return n;
  };

  // music first (input order is part of the published semantics). A lone music clip at 0 that plays whole with no
  // fade and no sfx beside it (the E1.5 bed) keeps its E1.5 graph exactly: only its gain, applied where it is used.
  const bed = music.length === 1 && !sfx.length && music[0] && ms(music[0]) === 0 && !shape(music[0]).length;
  const ml = music.map((c, k) => {
    inputs.push("-i", fileOf(c));
    const label = `[${idx++}:a]`;
    if (bed) return label;
    const at = ms(c);
    const st = [
      ...shape(c),
      "aresample=48000",
      "aformat=channel_layouts=stereo",
      ...(at > 0 ? [`adelay=delays=${at}:all=1`] : []),
      ...(gain(c.gainDb) ? [gain(c.gainDb)] : []),
    ];
    graph.push(`${label}${st.join(",")}[m${k}]`);
    return `[m${k}]`;
  });
  /** The E1.5 bed's gain stage, emitted at its first use (where E1.5 emitted it). */
  const bedGain = (label: string): string => {
    const m = music[0];
    if (!bed || !m || m.gainDb === 0) return label;
    graph.push(`${label}${gain(m.gainDb)}[bedq]`);
    return "[bedq]";
  };
  const vl = voices.map((c, k) => {
    inputs.push("-i", fileOf(c));
    const g = gain(c.gainDb);
    const st = [
      ...shape(c),
      "aresample=48000",
      "aformat=channel_layouts=stereo",
      `adelay=delays=${ms(c)}:all=1`,
      ...(g ? [g] : []),
    ];
    graph.push(`[${idx++}:a]${st.join(",")}[v${k}]`);
    return `[v${k}]`;
  });
  const sl = sfx.map((c, k) => {
    inputs.push("-i", fileOf(c));
    const at = ms(c);
    const g = gain(c.gainDb);
    const st = [
      ...shape(c),
      "aresample=48000",
      "aformat=channel_layouts=stereo",
      ...(at > 0 ? [`adelay=delays=${at}:all=1`] : []),
      ...(g ? [g] : []),
    ];
    graph.push(`[${idx++}:a]${st.join(",")}[s${k}]`);
    return `[s${k}]`;
  });
  const bus = (labels: string[], name: string): string => {
    if (labels.length === 1) return labels[0] as string;
    graph.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[${name}]`);
    return `[${name}]`;
  };
  let musicBus = ml.length ? bus(ml, "music") : "";
  const sfxBus = sl.length ? bus(sl, "sfx") : "";

  const parts: string[] = [];
  if (vl.length) {
    graph.push(`${vl.join("")}amix=inputs=${vl.length}:normalize=0:dropout_transition=0[voice]`);
    const d = pkg.mix.ducking;
    if (musicBus && d) {
      // the key is padded with silence after the last voice clip, so the music goes on to the film's end
      // (sidechaincompress ends with its shorter input: the v2 engine's mix stopped at the last word, E1.5)
      graph.push(`[voice]asplit=2[vo][sc]`, `[sc]apad[scp]`);
      musicBus = bedGain(musicBus);
      const depth = pkg.mix.duckMusicDb > 0 ? `:mix=${duckMix(pkg.mix.duckMusicDb)}` : "";
      graph.push(
        `${musicBus}[scp]${AUDIO.ducking.filter}=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attackMs}:release=${d.releaseMs}${depth}[ducked]`,
      );
      parts.push("[vo]", "[ducked]");
    } else parts.push("[voice]", ...(musicBus ? [bedGain(musicBus)] : []));
  } else if (musicBus) parts.push(bedGain(musicBus));
  if (sfxBus) parts.push(sfxBus);
  let mix: string;
  if (parts.length === 1) mix = parts[0] as string;
  else {
    graph.push(`${parts.join("")}amix=inputs=${parts.length}:normalize=0[mix]`);
    mix = "[mix]";
  }
  // the mix lasts as long as its longest-lasting file; shorter than the film, it is padded with silence to the
  // film's duration (so the video keeps its length); otherwise nothing is added (apad would change where the
  // encoder ends the audio stream)
  const end = Math.max(
    ...pkg.audio.map(
      (c) => c.start + (playsPart(c, fileSecOf(c), film) ? c.duration : fileSecOf(c) - c.trim),
    ),
  );
  const pad = end < pkg.output.duration ? `,apad=whole_dur=${pkg.output.duration}` : "";
  const L = pkg.mix.loudness;
  if (L.rangeLu === undefined) throw new Error("the mix has no loudness range (the gate refuses this)");
  graph.push(
    `${mix}${AUDIO.loudness.filter}=I=${L.integratedLufs}:TP=${L.truePeakDb}:LRA=${L.rangeLu},aresample=${AUDIO.encode.sampleRate}${pad}[a]`,
  );
  return [
    ...["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph.join(";")],
    ...[
      "-map",
      "0:v",
      "-map",
      "[a]",
      "-c:v",
      "copy",
      "-c:a",
      AUDIO.encode.codec,
      "-b:a",
      `${AUDIO.encode.bitrateKbps}k`,
    ],
    ...["-shortest", out],
  ];
}
