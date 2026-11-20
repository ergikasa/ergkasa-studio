import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  immutableRef,
  parseImmutableRef,
  publish,
  readCatalog,
  resolveRef,
  LIBRARY_ROOT,
} from "../src/library/index.js";
import { testMinimalSpec, writePackage } from "../src/builder/index.js";
import { TEST_DIR, must } from "./helpers.js";

const tmp = mkdtempSync(join(tmpdir(), "chr-lib-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A private copy of the repository's library. */
function libraryCopy(name: string): string {
  const root = join(tmp, name);
  cpSync(LIBRARY_ROOT, root, { recursive: true });
  return root;
}

describe("the catalog and immutable references", () => {
  it("lists the test character with the sha256 of its character.json", () => {
    const e = readCatalog().characters.find((x) => x.id === "chr_test_minimal" && x.version === 1);
    expect(e?.purpose).toBe("technical_test");
    expect(e?.approval).toBe("pending");
    expect(e?.path).toBe("characters/chr_test_minimal/1");
  });

  it("an immutable reference is id@version#sha256 and resolves to the package folder", () => {
    const e = must(readCatalog().characters.find((x) => x.id === "chr_test_minimal"));
    const ref = immutableRef(e);
    expect(parseImmutableRef(ref)).toEqual({ id: "chr_test_minimal", version: 1, sha256: e.sha256 });
    expect(resolveRef(ref).dir).toBe(TEST_DIR);
  });

  it("refuses a reference whose hash is not the catalog's (CHARACTER_HASH)", () => {
    expect(() => resolveRef(`chr_test_minimal@1#sha256:${"0".repeat(64)}`)).toThrow(/CHARACTER_HASH/);
  });

  it("refuses to resolve a package changed after it was published (CHARACTER_HASH)", () => {
    const root = libraryCopy("changed");
    const e = must(readCatalog(root).characters[0]);
    appendFileSync(join(root, e.path, "character.json"), " ");
    expect(() => resolveRef(immutableRef(e), root)).toThrow(/changed after it was published/);
  });

  it("refuses to publish other bytes under a published id@version (IMMUTABLE)", async () => {
    const root = libraryCopy("immutable");
    const dir = join(root, "characters", "chr_test_minimal", "1");
    const j = JSON.parse(readFileSync(join(dir, "character.json"), "utf8")) as { name: string };
    j.name = "Renamed";
    writeFileSync(join(dir, "character.json"), JSON.stringify(j, null, 2));
    await expect(publish(dir, root)).rejects.toThrow(/IMMUTABLE/);
  });

  it("refuses a package outside characters/<id>/<version> (LIBRARY_PATH)", async () => {
    const root = libraryCopy("path");
    const dir = join(root, "elsewhere");
    mkdirSync(dir);
    cpSync(TEST_DIR, dir, { recursive: true });
    await expect(publish(dir, root)).rejects.toThrow(/LIBRARY_PATH/);
  });

  it("refuses a reference character without the PO's approval (NOT_APPROVED)", async () => {
    const root = libraryCopy("approval");
    const spec = testMinimalSpec();
    spec.manifest.id = "chr_test_reference";
    spec.manifest.purpose = "reference";
    const dir = join(root, "characters", "chr_test_reference", "1");
    await writePackage(dir, spec);
    await expect(publish(dir, root)).rejects.toThrow(/NOT_APPROVED/);
  });

  it("a new version must keep the identity (IDENTITY_CHANGED); with the same identity it publishes", async () => {
    const root = libraryCopy("versions");
    const changed = testMinimalSpec();
    changed.manifest.version = 2;
    changed.manifest.compatibility.previousVersion = 1;
    changed.manifest.identity.palette.eyes = "#7A5A3A";
    const d2 = join(root, "characters", "chr_test_minimal", "2");
    await writePackage(d2, changed);
    await expect(publish(d2, root)).rejects.toThrow(/IDENTITY_CHANGED/);

    const same = testMinimalSpec();
    same.manifest.version = 3;
    same.manifest.compatibility.previousVersion = 1;
    same.manifest.name = "Technical test character (v3)";
    const d3 = join(root, "characters", "chr_test_minimal", "3");
    await writePackage(d3, same);
    const e = await publish(d3, root);
    expect(e.fingerprint).toBe(readCatalog(root).characters.find((x) => x.version === 1)?.fingerprint);
  });
});
