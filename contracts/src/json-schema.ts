import { z } from "zod";
import { CONTRACTS } from "./index.js";

/** Renders every contract as a JSON Schema document (draft 2020-12), as the text written to disk. */
export function renderSchemas(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, schema] of Object.entries(CONTRACTS)) {
    // `io: "input"`: describes the JSON that producers may send (fields with defaults are optional).
    const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "input", unrepresentable: "any" });
    const doc = { $id: `https://erkasa.studio/contracts/${name}.schema.json`, title: name, ...json };
    out[name] = JSON.stringify(doc, null, 2) + "\n";
  }
  return out;
}
