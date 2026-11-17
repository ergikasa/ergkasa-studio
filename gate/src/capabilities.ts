/**
 * What the gate needs to know about the engine, as data. The engine publishes it (film `capabilities().render`);
 * the gate never imports the engine. The shape is checked at runtime before it is trusted.
 */
export type CapabilityParameter =
  { kind: "channel"; id: string; range: [number, number] } | { kind: "static"; id: string };

export interface BuiltinCapability {
  name: string;
  version: number;
  fingerprint: string;
  status: "supported" | "deprecated" | "removed";
  kind: "vector" | "rig" | "font";
  parameters?: CapabilityParameter[];
  rig?: { format: string; bones: string[]; channels: string[]; sockets: string[]; slots: string[] };
  font?: { family: string; weight: number };
}

export interface RenderCapabilities {
  contract: string;
  projections: string[];
  lightKinds: string[];
  fx: string[];
  transitions: string[];
  nodeKinds: string[];
  overlayKinds: string[];
  rigFormats: string[];
  builtins: BuiltinCapability[];
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Problems with the capabilities document itself (a gate that trusts a broken description would pass anything). */
export function capabilityProblems(c: unknown): string[] {
  const out: string[] = [];
  const r = c as Partial<RenderCapabilities> | null;
  if (!r || typeof r !== "object") return ["capabilities are not an object"];
  if (typeof r.contract !== "string") out.push("contract is missing");
  for (const k of [
    "projections",
    "lightKinds",
    "fx",
    "transitions",
    "nodeKinds",
    "overlayKinds",
    "rigFormats",
  ] as const)
    if (!isStrings(r[k])) out.push(`${k} is not a list of names`);
  if (!Array.isArray(r.builtins)) return [...out, "builtins is not a list"];
  const names = new Set<string>();
  r.builtins.forEach((b, i) => {
    if (!b || typeof b.name !== "string") return out.push(`builtins[${i}] has no name`);
    if (names.has(b.name)) out.push(`builtins[${i}] '${b.name}' is listed twice`);
    names.add(b.name);
    if (!Number.isInteger(b.version) || b.version < 1)
      out.push(`${b.name}: version is not a positive integer`);
    if (typeof b.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(b.fingerprint))
      out.push(`${b.name}: fingerprint is not a sha256`);
    if (!["supported", "deprecated", "removed"].includes(b.status)) out.push(`${b.name}: unknown status`);
    if (!["vector", "rig", "font"].includes(b.kind)) out.push(`${b.name}: unknown kind`);
    if (b.kind === "rig" && !b.rig) out.push(`${b.name}: a rig builtin without its rig description`);
    return undefined;
  });
  return out;
}
