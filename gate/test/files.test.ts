/**
 * The contained reader: what may be read, what is refused, and that the bytes returned are the bytes verified.
 */
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readContained } from "../src/index.js";
import { sha } from "./helpers.js";

function sandbox() {
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "gate-outside-")));
  writeFileSync(join(outside, "secret.txt"), "secret");
  const root = realpathSync(mkdtempSync(join(tmpdir(), "gate-root-")));
  mkdirSync(join(root, "assets/sub"), { recursive: true });
  writeFileSync(join(root, "assets/a.svg"), "<svg>a</svg>");
  writeFileSync(join(root, "assets/sub/b.svg"), "<svg>b</svg>");
  symlinkSync(join(root, "assets/sub/b.svg"), join(root, "assets/inside-link.svg"));
  symlinkSync(join(root, "assets/sub"), join(root, "assets/dirlink"));
  symlinkSync(join(outside, "secret.txt"), join(root, "assets/escape.svg"));
  symlinkSync(outside, join(root, "assets/escape-dir"));
  symlinkSync(join(root, "assets/nothing.svg"), join(root, "assets/broken.svg"));
  symlinkSync(join(root, "assets/loop2.svg"), join(root, "assets/loop1.svg"));
  symlinkSync(join(root, "assets/loop1.svg"), join(root, "assets/loop2.svg"));
  return { root, outside };
}

const code = (root: string, uri: string, max = 1_000_000): string => {
  const r = readContained(root, uri, max);
  return r.ok ? "OK" : r.code;
};

describe("contained reading", () => {
  const { root } = sandbox();

  it("reads a file inside the root and returns exactly the bytes it hashed", () => {
    const r = readContained(root, "assets/a.svg", 1000);
    if (!r.ok) throw new Error(r.code);
    expect(r.file.bytes.toString()).toBe("<svg>a</svg>");
    expect(r.file.sha256).toBe(sha("<svg>a</svg>"));
    expect(r.file.real).toBe(join(root, "assets/a.svg"));
  });

  it("follows symlinks that stay inside the root (file and directory)", () => {
    expect(code(root, "assets/inside-link.svg")).toBe("OK");
    expect(code(root, "assets/dirlink/b.svg")).toBe("OK");
  });

  it.each([
    ["../outside.svg", "PATH_TRAVERSAL"],
    ["assets/../../etc/passwd", "PATH_TRAVERSAL"],
    ["assets/./a.svg", "PATH_TRAVERSAL"],
    ["assets//a.svg", "PATH_TRAVERSAL"],
    [".git/config", "PATH_TRAVERSAL"],
    ["assets\\a.svg", "PATH_TRAVERSAL"],
    ["assets/%2e%2e/a.svg", "PATH_TRAVERSAL"],
    ["/etc/passwd", "PATH_ABSOLUTE"],
    ["file:///etc/passwd", "PATH_ABSOLUTE"],
    ["C:/windows/win.ini", "PATH_ABSOLUTE"],
    ["s3://bucket/a.svg", "FILE_REMOTE"],
    ["assets/escape.svg", "PATH_ESCAPE"],
    ["assets/escape-dir/secret.txt", "PATH_ESCAPE"],
    ["assets/broken.svg", "SYMLINK_BROKEN"],
    ["assets/loop1.svg", "SYMLINK_LOOP"],
    ["assets/missing.svg", "FILE_MISSING"],
    ["assets/sub", "NOT_A_FILE"],
  ])("%s → %s", (uri, want) => {
    expect(code(root, uri)).toBe(want);
  });

  it("refuses a file over the size budget without reading it", () => {
    expect(code(root, "assets/a.svg", 5)).toBe("BUDGET_ASSET_BYTES");
  });

  it("no TOCTOU: the bytes are those read through the descriptor that was checked; changing the path later changes nothing", () => {
    const r = readContained(root, "assets/sub/b.svg", 1000);
    if (!r.ok) throw new Error(r.code);
    writeFileSync(join(root, "assets/sub/b.svg"), "<svg>swapped</svg>");
    expect(r.file.bytes.toString()).toBe("<svg>b</svg>");
    expect(r.file.sha256).toBe(sha("<svg>b</svg>"));
    // a new read sees the new content and a new hash: nothing was cached by path
    const again = readContained(root, "assets/sub/b.svg", 1000);
    expect(again.ok && again.file.sha256).toBe(sha("<svg>swapped</svg>"));
  });
});
