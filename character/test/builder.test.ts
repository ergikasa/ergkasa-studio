import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { packageFiles, testMinimalSpec, writePackage } from "../src/builder/index.js";
import { TEST_DIR, must } from "./helpers.js";

const tmp = mkdtempSync(join(tmpdir(), "chr-build-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("the Builder's package writer", () => {
  it("is deterministic: building twice gives the same bytes", () => {
    const a = packageFiles(testMinimalSpec());
    const b = packageFiles(testMinimalSpec());
    expect([...a.keys()]).toEqual([...b.keys()]);
    for (const [k, v] of a)
      expect(Buffer.compare(Buffer.from(v), Buffer.from(b.get(k) as Uint8Array)), k).toBe(0);
  });

  it("rebuilds the published test character byte for byte from its source", () => {
    for (const [path, bytes] of packageFiles(testMinimalSpec()))
      expect(Buffer.compare(Buffer.from(bytes), readFileSync(join(TEST_DIR, path))), path).toBe(0);
  });

  it("writing the same package again changes nothing; different bytes are refused (PACKAGE_EXISTS)", async () => {
    const dir = join(tmp, "pkg");
    await writePackage(dir, testMinimalSpec());
    await writePackage(dir, testMinimalSpec());
    const other = testMinimalSpec();
    other.manifest.name = "Other name";
    await expect(writePackage(dir, other)).rejects.toThrow(/PACKAGE_EXISTS/);
  });

  it("refuses to write a package the runtime would not load", async () => {
    const bad = testMinimalSpec();
    bad.manifest.capabilities.locomotion.push("walk");
    await expect(writePackage(join(tmp, "bad"), bad)).rejects.toThrow(/PACKAGE_INVALID/);
  });

  it("an artist's arbitrary outline is accepted: the format is not limited to the builder's shapes", async () => {
    const spec = testMinimalSpec();
    const body = must(spec.parts.find((p) => p.path === "parts/body.json"));
    // a hand-drawn shape: any vertices, any curve commands, its own skin weights
    body.parts.push({
      id: "artist_badge",
      kind: "vector",
      z: 3.1,
      opacity: 1,
      vertices: [
        [40, -300],
        [70, -310],
        [82, -280],
        [60, -262],
        [38, -276],
        [55, -295],
      ],
      binding: {
        kind: "skin",
        bones: ["chest", "spine"],
        weights: [
          [[0, 1]],
          [
            [0, 0.8],
            [1, 0.2],
          ],
          [
            [0, 0.5],
            [1, 0.5],
          ],
          [[1, 1]],
          [
            [0, 0.5],
            [1, 0.5],
          ],
          [[0, 1]],
        ],
      },
      morphs: [],
      paths: [
        {
          cmds: [["M", 0], ["C", 1, 2, 3], ["Q", 5, 4], ["L", 0], ["Z"]],
          fill: { kind: "solid", color: "#E9C46ACC" },
        },
      ],
    });
    const c = await writePackage(join(tmp, "artist"), spec);
    expect(c.partById.has("artist_badge")).toBe(true);
    writeFileSync(join(tmp, "artist.ok"), "");
  });
});
