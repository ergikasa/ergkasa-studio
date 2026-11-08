import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { audioArgs, loadEngine, loadInput, renderStill } from "../src/render.js";

const HERE = fileURLToPath(new URL("..", import.meta.url));

describe("render worker", () => {
  it("rasterizes a demo frame to a 1080x1920 PNG with bundled fonts", () => {
    const { timeline } = loadInput(
      join(HERE, "demo", "phase-b-demo.timeline.json"),
      join(HERE, "..", "assets"),
    );
    const engine = loadEngine(timeline, join(HERE, "..", "assets"));
    const out = join(mkdtempSync(join(tmpdir(), "erkasa-")), "f.png");
    renderStill(engine, 234, out); // the transition frame that used to crash resvg
    const png = readFileSync(out);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
  });
});

describe("video plan input", () => {
  it("compiles the habits demo plan without errors", () => {
    const res = loadInput(join(HERE, "demo", "habits.video-plan.json"), join(HERE, "..", "assets"));
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(res.compiled).toBe(true);
    expect(res.timeline).toBeDefined();
  });
});

describe("soundtrack", () => {
  it("places each voice clip at its scene start, ducks the bed and normalizes loudness", () => {
    const a = audioArgs(
      {
        voice: [
          { file: "s01.mp3", startSec: 0 },
          { file: "s02.mp3", startSec: 3.567 },
        ],
        musicPlaceholder: true,
      },
      11,
    );
    expect(a.inputs.filter((x) => x === "-i")).toHaveLength(5); // 2 voices + 3 pad tones
    expect(a.filter).toContain("[1:a]aresample=48000,aformat=channel_layouts=mono,adelay=delays=0:all=1[v0]");
    expect(a.filter).toContain(
      "[2:a]aresample=48000,aformat=channel_layouts=mono,adelay=delays=3567:all=1[v1]",
    );
    expect(a.filter).toContain("sidechaincompress");
    expect(a.filter).toContain("loudnorm=I=-14:TP=-1");
    expect(a.map).toEqual(["-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]);
  });

  it("is silent when there is no voice and no music", () => {
    expect(audioArgs({}, 5)).toEqual({ inputs: [], map: [] });
  });
});
