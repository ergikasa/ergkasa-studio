/**
 * A child process of encode.ts: opens the package (the gate verifies it again, here) and encodes one cut.
 * argv: <package file> <root> <from> <to> <out.mp4> <ffmpeg>
 */
import { readFileSync } from "node:fs";
import { encodeSegment } from "./encode.js";
import { openPackage } from "./render.js";

const [pkgFile, root, from, to, out, ffmpeg] = process.argv.slice(2);
if (!pkgFile || !root || !from || !to || !out || !ffmpeg) {
  process.stderr.write("usage: encode-child <package> <root> <from> <to> <out> <ffmpeg>\n");
  process.exit(2);
}
const o = openPackage({ package: readFileSync(pkgFile), root });
if (!o.ok) {
  process.stderr.write(`the package was refused: ${o.errors.map((e) => `${e.code} ${e.path}`).join("; ")}\n`);
  process.exit(3);
}
encodeSegment(o.renderer, Number(from), Number(to), out, { ffmpeg }).then(
  () => process.exit(0),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
