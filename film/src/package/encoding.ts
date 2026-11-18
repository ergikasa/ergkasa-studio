/**
 * How the engine turns a package's frames and audio into an MP4 (E1.5): the settings, published as they are in
 * the capabilities (capabilities.ts reads these constants; nothing else defines them).
 *
 * Video: every cut of the edit is encoded on its own (raw RGBA in, H.264 out, with the film grain of the v2
 * engine, whose noise restarts at every cut), and the cuts are joined without re-encoding.
 *
 * Audio: the mixdown (mixdown.ts) of the package's clips, normalised for loudness and encoded as AAC, muxed over
 * the joined video; the output ends with the video.
 */
import type { AudioCapability, VideoEncoding } from "@erkasa/gate";

export const VIDEO: VideoEncoding = {
  encoder: "libx264",
  preset: "veryfast",
  crf: 20,
  pixelFormat: "yuv420p",
  grain: "noise=alls=4:allf=t",
  segments: "cut",
};

/** The FFmpeg arguments that encode one cut from raw RGBA on stdin to `out`. */
export const segmentArgs = (width: number, height: number, fps: number, out: string): string[] => [
  ...["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba"],
  ...["-s", `${width}x${height}`, "-r", `${fps}`, "-i", "-"],
  ...["-vf", `${VIDEO.grain},format=${VIDEO.pixelFormat}`],
  ...[
    "-c:v",
    VIDEO.encoder,
    "-preset",
    VIDEO.preset,
    "-crf",
    `${VIDEO.crf}`,
    "-r",
    `${fps}`,
    "-f",
    "mp4",
    out,
  ],
];

export const AUDIO: AudioCapability = {
  formats: ["wav"],
  // E1.6: several music clips (the designed score, one per segment) and sound effects, each placed in whole ms
  roles: {
    voice: { max: 1000, start: "whole-ms" },
    music: { max: 64, start: "whole-ms" },
    sfx: { max: 256, start: "whole-ms" },
  },
  fixed: { pan: 0 },
  duration: "at-most-audible",
  fades: { curve: "qsin" },
  duckMusicDb: [0, 30],
  ducking: {
    kinds: ["sidechain"],
    filter: "sidechaincompress",
    // FFmpeg 6.1 sidechaincompress parameters the package does not set, at their defaults (mix: see semantics)
    defaults: {
      level_in: 1,
      level_sc: 1,
      mode: "downward",
      knee: 2.82843,
      link: "average",
      detection: "rms",
      makeup: 1,
      mix: 1,
    },
  },
  loudness: { filter: "loudnorm", rangeLu: "required", integratedLufs: [-40, -5], truePeakDb: [-9, 0] },
  encode: { codec: "aac", bitrateKbps: 192, sampleRate: 48000 },
  semantics: [
    "inputs: the video, then the music clips, then the voice clips, then the sfx clips, each group in package order",
    "every clip: a clip with a trim, or one that stops before both the end of its file and the end of the film, is cut first (atrim from trim for duration, timestamps reset); a fade in over fadeIn s from its start and a fade out over its last fadeOut s, both with the qsin curve; no stage for a value of 0",
    "voice clip: then resampled to 48000 Hz, made stereo, delayed by its start in whole milliseconds, then its gain (0 dB: no stage); the voice clips are summed without normalisation",
    "music and sfx clip: then resampled to 48000 Hz, made stereo, delayed by its start in whole milliseconds when it starts after 0, then its gain (0 dB: no stage); the clips of each role are summed without normalisation; a lone music clip at 0 that is not cut or faded, with no sfx (the E1.5 bed), is taken as it is with only its gain",
    "voice and music with ducking: the music is compressed by sidechaincompress keyed by the summed voice padded with silence to the end (threshold, ratio, attack ms, release ms from the package; mix = 1 - 10^(-duckMusicDb/20) when duckMusicDb > 0, so the music never drops more than duckMusicDb dB; the other parameters at their defaults); the sfx are never ducked",
    "the voice, the (ducked) music and the sfx that exist are summed without normalisation",
    "loudness: loudnorm (single pass) to integratedLufs, truePeakDb and rangeLu, then resampled to 48000 Hz; a mix whose clips all end before the film's end is padded with silence to the film's duration (apad whole_dur)",
    "a clip that plays its whole file is mixed whole (audio after the film's end takes part in the loudness normalisation); the output ends with the video, which always has the package's full duration",
    "encoded as AAC at 192 kb/s; no audio clip: the video has no audio stream",
  ],
};
