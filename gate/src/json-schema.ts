/**
 * The values a builtin's static parameters may take, published by the engine as a small subset of JSON Schema
 * (E1.4, capabilities v2): the gate checks a node's params against it. Only the keywords below are understood;
 * a schema with any other keyword is a broken capabilities document (it could not be enforced), not a pass.
 */
export type ParamSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, ParamSchema>;
  required?: string[];
  additionalProperties?: boolean | ParamSchema;
  items?: ParamSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  anyOf?: ParamSchema[];
  $schema?: string;
};

const KEYWORDS = new Set([
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "anyOf",
  "$schema",
]);
const TYPES = new Set(["string", "number", "integer", "boolean", "null", "array", "object"]);

/** Problems with a schema itself (unknown keyword or type). */
export function schemaProblems(s: unknown, at: string): string[] {
  if (!s || typeof s !== "object" || Array.isArray(s)) return [`${at} is not a schema`];
  const out: string[] = [];
  const o = s as Record<string, unknown>;
  for (const k of Object.keys(o))
    if (!KEYWORDS.has(k)) out.push(`${at}: keyword '${k}' is not understood by the gate`);
  const types = o["type"] === undefined ? [] : Array.isArray(o["type"]) ? o["type"] : [o["type"]];
  for (const t of types) if (!TYPES.has(t as string)) out.push(`${at}: unknown type '${String(t)}'`);
  for (const [p, v] of Object.entries((o["properties"] as Record<string, unknown>) ?? {}))
    out.push(...schemaProblems(v, `${at}.properties.${p}`));
  if (o["items"] !== undefined) out.push(...schemaProblems(o["items"], `${at}.items`));
  if (typeof o["additionalProperties"] === "object")
    out.push(...schemaProblems(o["additionalProperties"], `${at}.additionalProperties`));
  ((o["anyOf"] as unknown[]) ?? []).forEach((x, i) => out.push(...schemaProblems(x, `${at}.anyOf.${i}`)));
  return out;
}

const typeOf = (v: unknown): string =>
  v === null
    ? "null"
    : Array.isArray(v)
      ? "array"
      : typeof v === "number"
        ? Number.isInteger(v)
          ? "integer"
          : "number"
        : typeof v;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Where (JSON Pointer below the value) and why `v` does not fit `s`; empty when it fits. */
export function schemaViolations(
  v: unknown,
  s: ParamSchema,
  at = "",
): Array<{ path: string; message: string }> {
  const fail = (message: string) => [{ path: at, message }];
  if (s.anyOf) {
    const fits = s.anyOf.some((x) => schemaViolations(v, x, at).length === 0);
    return fits ? [] : fail(`${JSON.stringify(v)} fits none of the allowed forms`);
  }
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    const t = typeOf(v);
    if (!types.includes(t) && !(t === "integer" && types.includes("number")))
      return fail(
        `${JSON.stringify(v)} is ${t === "null" ? "null" : t === "integer" ? "a number" : `a ${t}`}, ${types.join(" or ")} is needed`,
      );
  }
  if (s.const !== undefined && !same(v, s.const))
    return fail(`${JSON.stringify(v)}: only ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.some((e) => same(e, v)))
    return fail(`${JSON.stringify(v)}: one of ${JSON.stringify(s.enum)}`);
  if (typeof v === "number") {
    if (s.minimum !== undefined && v < s.minimum) return fail(`${v} < ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) return fail(`${v} > ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum)
      return fail(`${v} ≤ ${s.exclusiveMinimum}`);
    if (s.exclusiveMaximum !== undefined && v >= s.exclusiveMaximum)
      return fail(`${v} ≥ ${s.exclusiveMaximum}`);
  }
  if (typeof v === "string") {
    if (s.minLength !== undefined && [...v].length < s.minLength) return fail(`shorter than ${s.minLength}`);
    if (s.maxLength !== undefined && [...v].length > s.maxLength) return fail(`longer than ${s.maxLength}`);
    if (s.pattern !== undefined && !new RegExp(s.pattern, "u").test(v))
      return fail(`'${v}' does not match ${s.pattern}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) return fail(`fewer than ${s.minItems} items`);
    if (s.maxItems !== undefined && v.length > s.maxItems) return fail(`more than ${s.maxItems} items`);
    if (s.items) return v.flatMap((x, i) => schemaViolations(x, s.items as ParamSchema, `${at}/${i}`));
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const out: Array<{ path: string; message: string }> = [];
    for (const r of s.required ?? [])
      if (!(r in o)) out.push({ path: `${at}/${r}`, message: `'${r}' is required` });
    for (const [k, x] of Object.entries(o)) {
      const ps = s.properties?.[k];
      if (ps) out.push(...schemaViolations(x, ps, `${at}/${k}`));
      else if (s.additionalProperties === false)
        out.push({ path: `${at}/${k}`, message: `'${k}' is not an input of this drawing` });
      else if (typeof s.additionalProperties === "object")
        out.push(...schemaViolations(x, s.additionalProperties, `${at}/${k}`));
    }
    return out;
  }
  return [];
}
