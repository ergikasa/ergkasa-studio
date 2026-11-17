/**
 * Reading a file the package names, without letting it leave the asset root, and without a gap between checking
 * a file and reading it (TOCTOU).
 *
 *   1. The uri is checked lexically: relative, no '.', '..', hidden or empty segments, no backslash, no '%'.
 *   2. The path is resolved with realpath against the real root: symlinks are allowed only if the final file is
 *      still inside the root. A broken symlink, a symlink loop or an escape is refused.
 *   3. The resolved file is opened once with O_NOFOLLOW. Every later check (that it is the same, regular file,
 *      inside the root; its size; its bytes; its hash) is made on that open descriptor, and the bytes returned are
 *      the bytes that were hashed. Nobody reopens the path afterwards: callers use `bytes`.
 */
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  readlinkSync,
  realpathSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, join, sep } from "node:path";

export interface VerifiedFile {
  /** The uri as written in the package or manifest. */
  uri: string;
  /** The real path that was opened. */
  real: string;
  bytes: Buffer;
  sha256: string;
}

export type ReadOutcome = { ok: true; file: VerifiedFile } | { ok: false; code: string; message: string };

const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;

/** The lexical rule (the same as the contract's ContainedUri for local paths), checked again here. */
export function lexicalProblem(uri: string): { code: string; message: string } | undefined {
  if (uri.startsWith("s3://"))
    return { code: "FILE_REMOTE", message: `${uri}: remote objects cannot be verified by this gate` };
  if (isAbsolute(uri) || /^[A-Za-z]:/.test(uri) || uri.startsWith("file:"))
    return { code: "PATH_ABSOLUTE", message: `${uri}: absolute paths are not allowed` };
  if (uri.includes("\\") || uri.includes("%"))
    return { code: "PATH_TRAVERSAL", message: `${uri}: backslashes and escapes are not allowed` };
  const segs = uri.split("/");
  for (const s of segs) {
    if (s === "..") return { code: "PATH_TRAVERSAL", message: `${uri}: '..' leaves the asset root` };
    if (!SEGMENT.test(s)) return { code: "PATH_TRAVERSAL", message: `${uri}: segment '${s}' is not allowed` };
  }
  return undefined;
}

/** Why a path does not resolve: a symlink on the way points nowhere, or nothing is there. */
function missingReason(root: string, uri: string): { code: string; message: string } {
  let cur = root;
  for (const s of uri.split("/")) {
    cur = join(cur, s);
    let st;
    try {
      st = lstatSync(cur);
    } catch {
      return { code: "FILE_MISSING", message: `${uri}: no such file` };
    }
    if (st.isSymbolicLink()) {
      try {
        statSync(cur);
      } catch {
        return { code: "SYMLINK_BROKEN", message: `${uri}: symlink '${s}' points to nothing` };
      }
    }
  }
  return { code: "FILE_MISSING", message: `${uri}: no such file` };
}

const inside = (root: string, p: string): boolean => p.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * Opens `uri` under `rootReal` (a real path, as returned by realpathSync) and returns its verified bytes.
 * Files larger than `maxBytes` are refused without being read.
 */
export function readContained(rootReal: string, uri: string, maxBytes: number): ReadOutcome {
  const lex = lexicalProblem(uri);
  if (lex) return { ok: false, ...lex };
  const candidate = join(rootReal, uri);
  let real: string;
  try {
    real = realpathSync.native(candidate);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ELOOP") return { ok: false, code: "SYMLINK_LOOP", message: `${uri}: symlinks loop` };
    if (code === "ENOENT" || code === "ENOTDIR") return { ok: false, ...missingReason(rootReal, uri) };
    return { ok: false, code: "FILE_UNREADABLE", message: `${uri}: ${code ?? String(e)}` };
  }
  if (!inside(rootReal, real))
    return { ok: false, code: "PATH_ESCAPE", message: `${uri}: resolves outside the asset root` };
  let fd: number;
  try {
    fd = openSync(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === "ELOOP"
      ? { ok: false, code: "FILE_CHANGED", message: `${uri}: became a symlink while being opened` }
      : { ok: false, code: "FILE_UNREADABLE", message: `${uri}: ${code ?? String(e)}` };
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) return { ok: false, code: "NOT_A_FILE", message: `${uri}: not a regular file` };
    // the object we hold must be the one we checked: on Linux ask the kernel where the descriptor points
    let held: string | undefined;
    try {
      held = readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      held = undefined;
    }
    if (held !== undefined) {
      if (held !== real || !inside(rootReal, held))
        return {
          ok: false,
          code: "FILE_CHANGED",
          message: `${uri}: the opened file is not the file that was checked`,
        };
    } else {
      const now = statSync(real);
      if (now.ino !== st.ino || now.dev !== st.dev)
        return {
          ok: false,
          code: "FILE_CHANGED",
          message: `${uri}: the opened file is not the file that was checked`,
        };
    }
    if (st.size > maxBytes)
      return {
        ok: false,
        code: "BUDGET_ASSET_BYTES",
        message: `${uri}: ${st.size} bytes, budget ${maxBytes}`,
      };
    const buf = Buffer.alloc(st.size + 1);
    let n = 0;
    for (;;) {
      const r = readSync(fd, buf, n, buf.length - n, n);
      if (r === 0) break;
      n += r;
      if (n > st.size) return { ok: false, code: "FILE_CHANGED", message: `${uri}: grew while being read` };
    }
    const bytes = buf.subarray(0, n);
    return { ok: true, file: { uri, real, bytes, sha256: createHash("sha256").update(bytes).digest("hex") } };
  } finally {
    closeSync(fd);
  }
}
