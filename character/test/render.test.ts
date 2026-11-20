import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
// the pipeline's own FFmpeg settings (film/src/package/encoding.ts): what the renderer encodes every cut with
import { segmentArgs, VIDEO } from "../../film/src/package/encoding.js";
import { renderFrame, FRAME_POSES } from "./render-frame.js";
import { testCharacter, must } from "./helpers.js";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "chr-render-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("rendering through the existing Skia path", () => {
  it("draws a 1080×1920 frame: the character covers its area, the background shows elsewhere", async () => {
    const c = await testCharacter();
    const { rgba } = renderFrame(c, must(FRAME_POSES[0]));
    const at = (x: number, y: number): number[] =>
      Array.from(rgba.subarray((y * 1080 + x) * 4, (y * 1080 + x) * 4 + 3));
    expect(at(20, 20)).toEqual([46, 58, 64]); // background
    expect(at(540, 1200)).not.toEqual([46, 58, 64]); // the T-shirt
  });

  it("is deterministic in a process: the same frame twice gives the same pixels", async () => {
    const c = await testCharacter();
    for (const pose of FRAME_POSES) expect(renderFrame(c, pose).sha).toBe(renderFrame(c, pose).sha);
  });

  it("is reproducible across processes: a fresh process renders the same pixels", async () => {
    const c = await testCharacter();
    const here = FRAME_POSES.map((p) => renderFrame(c, p).sha);
    const out = execFileSync(process.execPath, ["--import", "tsx", join(HERE, "render-frame.ts")], {
      cwd: join(HERE, ".."),
      encoding: "utf8",
    });
    expect(out.trim().split("\n")).toEqual(here);
  });

  it("different commands give different pictures", async () => {
    const c = await testCharacter();
    expect(new Set(FRAME_POSES.map((p) => renderFrame(c, p).sha)).size).toBe(FRAME_POSES.length);
  });

  it("encodes with the pipeline's FFmpeg settings (raw RGBA → H.264, the engine's grain)", async () => {
    const c = await testCharacter();
    const out = join(tmp, "clip.mp4");
    const frames = FRAME_POSES.map((p) => renderFrame(c, p).rgba);
    const ff = spawnSync("ffmpeg", segmentArgs(1080, 1920, 30, out), {
      input: Buffer.concat(frames),
      maxBuffer: 1 << 30,
    });
    expect(ff.status, ff.stderr?.toString()).toBe(0);
    const probe = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,nb_read_frames,pix_fmt",
        "-of",
        "json",
        out,
      ],
      { encoding: "utf8" },
    );
    const s = (JSON.parse(probe) as { streams: Array<Record<string, unknown>> }).streams[0];
    expect(s).toMatchObject({
      codec_name: "h264",
      width: 1080,
      height: 1920,
      pix_fmt: VIDEO.pixelFormat,
      nb_read_frames: String(FRAME_POSES.length),
    });
  });
});
