import { cpSync, mkdtempSync, rmSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  identityFingerprint,
  loadCharacter,
  loadCharacterBytes,
  RUNTIME_REVISION,
  sha256,
} from "../src/runtime/index.js";
import { readCatalog } from "../src/library/index.js";
import { codesOf, loadEdited, TEST_DIR, testCharacter } from "./helpers.js";

const tmp = mkdtempSync(join(tmpdir(), "chr-load-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const copy = (name: string): string => {
  const d = join(tmp, name);
  cpSync(TEST_DIR, d, { recursive: true });
  return d;
};

describe("package loading", () => {
  it("loads the published test character: schema, files, hashes, references, no warnings", async () => {
    const c = await testCharacter();
    expect(c.manifest.id).toBe("chr_test_minimal");
    expect(c.manifest.purpose).toBe("technical_test");
    expect(c.parts.length).toBe(36);
    expect(c.textures.get("textures/tee.png")?.width).toBe(384);
    expect(c.warnings).toEqual([]);
  });

  it("its sha256 is the catalog's, and the fingerprint is the identity's hash", async () => {
    const c = await testCharacter();
    const e = readCatalog().characters.find(
      (x) => x.id === c.manifest.id && x.version === c.manifest.version,
    );
    expect(e?.sha256).toBe(c.sha256);
    expect(c.sha256).toBe(sha256(readFileSync(join(TEST_DIR, "character.json"))));
    expect(identityFingerprint(c.manifest.identity)).toBe(c.manifest.fingerprint);
  });

  it("refuses a file whose bytes changed (FILE_HASH, FILE_SIZE)", async () => {
    const d = copy("tampered");
    appendFileSync(join(d, "parts", "body.json"), " ");
    expect(await codesOf(loadCharacter(d))).toEqual(expect.arrayContaining(["FILE_HASH", "FILE_SIZE"]));
  });

  it("refuses a missing file (FILE_MISSING)", async () => {
    const d = copy("missing");
    rmSync(join(d, "textures", "tee.png"));
    expect(await codesOf(loadCharacter(d))).toContain("FILE_MISSING");
  });

  it("warns about a file present but not listed, and ignores it", async () => {
    const d = copy("extra");
    writeFileSync(join(d, "notes.txt"), "x");
    const c = await loadCharacter(d);
    expect(c.warnings.map((w) => w.code)).toEqual(["FILE_UNLISTED"]);
  });

  it("refuses character.json that is not erkasa.character/1 (PACKAGE_SCHEMA)", async () => {
    const d = copy("schema");
    const j = JSON.parse(readFileSync(join(d, "character.json"), "utf8")) as Record<string, unknown>;
    j["schema"] = "erkasa.character/9";
    writeFileSync(join(d, "character.json"), JSON.stringify(j));
    expect(await codesOf(loadCharacter(d))).toContain("PACKAGE_SCHEMA");
  });

  it("refuses an identity that does not match its fingerprint (FINGERPRINT)", async () => {
    const d = copy("identity");
    const j = JSON.parse(readFileSync(join(d, "character.json"), "utf8")) as {
      identity: { palette: { skin: string } };
    };
    j.identity.palette.skin = "#FFFFFF";
    writeFileSync(join(d, "character.json"), JSON.stringify(j));
    expect(await codesOf(loadCharacter(d))).toContain("FINGERPRINT");
  });

  it("refuses a package that needs a newer runtime (RUNTIME_TOO_OLD)", async () => {
    expect(
      await codesOf(loadEdited((s) => (s.manifest.compatibility.minRuntime = RUNTIME_REVISION + 1))),
    ).toEqual(["RUNTIME_TOO_OLD"]);
  });

  it("refuses a parts file that is not erkasa.character.parts/1 (PARTS_SCHEMA)", async () => {
    const files = new Map<string, Uint8Array>();
    const c = await testCharacter();
    for (const f of c.manifest.files) files.set(f.path, readFileSync(join(TEST_DIR, f.path)));
    const bad = Buffer.from(
      JSON.stringify({ schema: "erkasa.character.parts/1", parts: [{ id: "x", kind: "mesh" }] }),
    );
    files.set("parts/body.json", bad);
    const index = JSON.parse(readFileSync(join(TEST_DIR, "character.json"), "utf8")) as {
      files: Array<{ path: string; sha256: string; bytes: number }>;
    };
    const entry = index.files.find((f) => f.path === "parts/body.json");
    if (entry) {
      entry.sha256 = sha256(bad);
      entry.bytes = bad.byteLength;
    }
    const codes = await codesOf(
      loadCharacterBytes({
        index: Buffer.from(JSON.stringify(index)),
        file: (p) => files.get(p),
        present: [...files.keys()],
      }),
    );
    expect(codes).toContain("PARTS_SCHEMA");
  });
});
