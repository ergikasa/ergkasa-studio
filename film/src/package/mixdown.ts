/**
 * The engine's mixdown of a package's audio clips (E1.5), as the capabilities publish it (encoding.ts AUDIO):
 * the FFmpeg inputs and filter graph that mix the clips over the joined video, normalise loudness and encode AAC.
 * Pure: the clips come from the verified package, the files are the verified bytes written by encode.ts.
 */
import { clipStartMs, gainLinear, type RenderPackage } from "@erkasa/contracts";
import { AUDIO } from "./encoding.js";

type Clip = RenderPackage["audio"][number];

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
  if (music.length + voices.length !== pkg.audio.length || music.length > 1)
    throw new Error(
      "the mixdown takes voice clips and at most one music clip (the gate refuses anything else)",
    );
  const inputs = ["-i", video];
  const graph: string[] = [];
  let idx = 1;
  let musicLabel = "";
  const m = music[0];
  if (m) {
    inputs.push("-i", fileOf(m));
    musicLabel = `[${idx++}:a]`;
  }
  const gain = (db: number): string => (db === 0 ? "" : `volume=${gainLinear(db)}`);
  const vl = voices.map((c, k) => {
    inputs.push("-i", fileOf(c));
    const ms = clipStartMs(c.start);
    if (ms === undefined) throw new Error(`voice clip ${c.id} does not start on a whole millisecond`);
    const g = gain(c.gainDb);
    graph.push(
      `[${idx++}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=delays=${ms}:all=1${g ? `,${g}` : ""}[v${k}]`,
    );
    return `[v${k}]`;
  });
  let mix: string;
  if (vl.length) {
    graph.push(`${vl.join("")}amix=inputs=${vl.length}:normalize=0:dropout_transition=0[voice]`);
    if (m) {
      const d = pkg.mix.ducking;
      if (d) {
        // the key is padded with silence after the last voice clip, so the music goes on to the film's end
        // (sidechaincompress ends with its shorter input: the v2 engine's mix stopped at the last word, E1.5)
        graph.push(`[voice]asplit=2[vo][sc]`, `[sc]apad[scp]`);
        let bed = musicLabel;
        if (m.gainDb !== 0) {
          graph.push(`${musicLabel}${gain(m.gainDb)}[bedq]`);
          bed = "[bedq]";
        }
        graph.push(
          `${bed}[scp]${AUDIO.ducking.filter}=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attackMs}:release=${d.releaseMs}[ducked]`,
          `[vo][ducked]amix=inputs=2:normalize=0[mix]`,
        );
      } else {
        let bed = musicLabel;
        if (m.gainDb !== 0) {
          graph.push(`${musicLabel}${gain(m.gainDb)}[bedq]`);
          bed = "[bedq]";
        }
        graph.push(`[voice]${bed}amix=inputs=2:normalize=0[mix]`);
      }
      mix = "[mix]";
    } else mix = "[voice]";
  } else {
    mix = musicLabel;
    if (m && m.gainDb !== 0) {
      graph.push(`${musicLabel}${gain(m.gainDb)}[bedq]`);
      mix = "[bedq]";
    }
  }
  // the mix lasts as long as its longest-lasting file; shorter than the film, it is padded with silence to the
  // film's duration (so the video keeps its length); otherwise nothing is added (apad would change where the
  // encoder ends the audio stream)
  const end = Math.max(...pkg.audio.map((c) => c.start + fileSecOf(c)));
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
