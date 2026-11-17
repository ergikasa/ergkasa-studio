/**
 * Findings and the report. Every finding names the document it is about, a JSON Pointer inside it, a stable code
 * and a message. The order is total and does not depend on the order checks run in.
 */
export type GateFile = "package" | "manifest" | "capabilities";

export interface Finding {
  code: string;
  file: GateFile;
  /** JSON Pointer (RFC 6901) inside `file`; "" is the whole document. */
  path: string;
  message: string;
}

export interface GateReport {
  ok: boolean;
  errors: Finding[];
  warnings: Finding[];
}

export const pointer = (...segments: Array<string | number>): string =>
  segments.map((s) => `/${String(s).replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");

const FILE_ORDER: Record<GateFile, number> = { package: 0, manifest: 1, capabilities: 2 };

/** Compares JSON Pointers segment by segment, numbers as numbers (so /scenes/2 comes before /scenes/10). */
function comparePointers(a: string, b: string): number {
  const pa = a.split("/").slice(1);
  const pb = b.split("/").slice(1);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i] as string;
    const y = pb[i] as string;
    if (x === y) continue;
    const nx = /^\d+$/.test(x) ? Number(x) : NaN;
    const ny = /^\d+$/.test(y) ? Number(y) : NaN;
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) return nx - ny;
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

export function compareFindings(a: Finding, b: Finding): number {
  return (
    FILE_ORDER[a.file] - FILE_ORDER[b.file] ||
    comparePointers(a.path, b.path) ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) ||
    (a.message < b.message ? -1 : a.message > b.message ? 1 : 0)
  );
}

export class Findings {
  private readonly errors: Finding[] = [];
  private readonly warnings: Finding[] = [];
  error(code: string, file: GateFile, path: string, message: string): void {
    this.errors.push({ code, file, path, message });
  }
  warn(code: string, file: GateFile, path: string, message: string): void {
    this.warnings.push({ code, file, path, message });
  }
  get hasErrors(): boolean {
    return this.errors.length > 0;
  }
  report(): GateReport {
    const dedupe = (xs: Finding[]): Finding[] => {
      const seen = new Set<string>();
      return [...xs].sort(compareFindings).filter((f) => {
        const k = `${f.file}\u0000${f.path}\u0000${f.code}\u0000${f.message}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };
    const errors = dedupe(this.errors);
    return { ok: errors.length === 0, errors, warnings: dedupe(this.warnings) };
  }
}
