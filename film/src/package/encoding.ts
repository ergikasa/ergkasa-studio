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
  roles: { voice: { max: 1000, start: "whole-ms" }, music: { max: 1, start: "zero" } },
  fixed: { trim: 0, fadeIn: 0, fadeOut: 0, pan: 0 },
  duration: "audible",
  duckMusicDb: [0],
  ducking: {
    kinds: ["sidechain"],
    filter: "sidechaincompress",
    // FFmpeg 6.1 sidechaincompress parameters the package does not set, at their defaults
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
    "inputs: the video, then the music clip (if any), then the voice clips in package order",
    "voice clip: resampled to 48000 Hz, made stereo, delayed by its start in whole milliseconds, then its gain (a gain of 0 dB adds no stage); the voice clips are summed without normalisation",
    "music clip: its gain (0 dB: no stage); it starts at 0",
    "voice and music with ducking: the music is compressed by sidechaincompress keyed by the summed voice padded with silence to the end (threshold, ratio, attack ms, release ms from the package; the other parameters at their defaults), so the music goes on after the last voice clip; then voice and music are summed without normalisation; without ducking they are summed as they are",
    "voice only or music only: that signal",
    "loudness: loudnorm (single pass) to integratedLufs, truePeakDb and rangeLu, then resampled to 48000 Hz and padded with silence",
    "the whole of every file is mixed (audio after the film's end takes part in the loudness normalisation); the output ends with the video, which always has the package's full duration",
    "encoded as AAC at 192 kb/s; no audio clip: the video has no audio stream",
  ],
};
