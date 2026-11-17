/** The engine's capabilities in the words the director's brief uses. */
import type { EngineCapabilities } from "@erkasa/film";

export function describeSets(caps: EngineCapabilities): string {
  return caps.sets
    .map(
      (s) =>
        `- ${s.id}: marks ${s.marks.map((m) => `${m.id} (${m.kind}${m.surface ? ", surface" : ""})`).join(", ")}; props ${
          s.props.map((p) => `${p.id} (${p.kind})`).join(", ") || "none"
        }; look targets ${s.targets.join(", ")}`,
    )
    .join("\n");
}
