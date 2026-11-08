import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VoiceCatalog, type VoicePreset } from "@erkasa/contracts";
import { optional, repoRoot } from "./env.js";

/** voices/catalog.json at the repo root: the narrators the user can choose from. */
export function voiceCatalogPath(): string {
  return join(repoRoot(), "voices", "catalog.json");
}

export function loadVoiceCatalog(file = voiceCatalogPath()): VoiceCatalog {
  return VoiceCatalog.parse(JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Which narrator to use: the explicit choice (`--voice`, or the plan's voiceId when resuming),
 * else ERKASA_VOICE from .env, else the catalog default. Unknown ids are an error with the list.
 */
export function resolvePreset(catalog: VoiceCatalog, choice?: string): VoicePreset {
  const id = choice?.trim() || optional("ERKASA_VOICE", catalog.default);
  const preset = catalog.voices.find((v) => v.id === id);
  if (!preset)
    throw new Error(
      `unknown voice '${id}'. Available: ${catalog.voices.map((v) => v.id).join(", ")} (voices/catalog.json)`,
    );
  return preset;
}

/** One line for the planner: who is narrating, so the speaking character can match. */
export function narratorLine(p: VoicePreset): string {
  const age = p.age ? `${p.age.replace("_", " ")} ` : "";
  return `Narrator voice: ${p.name}, ${age}${p.gender}${p.accent ? `, ${p.accent}` : ""}. The character who speaks (speaks=true) must match the narrator's gender${p.gender === "neutral" ? " (any character works for a neutral voice)" : ""}.`;
}
