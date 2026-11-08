import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadEngine, renderStill } from "../src/render.js";

const HERE = fileURLToPath(new URL("..", import.meta.url));

describe("render worker", () => {
  it("rasterizes a demo frame to a 1080x1920 PNG with bundled fonts", () => {
    const engine = loadEngine(join(HERE, "demo", "phase-b-demo.timeline.json"), join(HERE, "..", "assets"));
    const out = join(mkdtempSync(join(tmpdir(), "erkasa-")), "f.png");
    renderStill(engine, 234, out); // the transition frame that used to crash resvg
    const png = readFileSync(out);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1920);
  });
});
