/**
 * What this engine can stage, as data. A planning layer (any model, any program) reads this instead of the
 * engine's internals, and writes plans that stay inside it; the engine validates every plan against the same
 * contract, so a plan built from this description is one the engine can execute.
 */
import { Light, Mood, Template, Verb } from "./contract.js";
import { SETS } from "./sets.js";

export const CAPABILITIES_VERSION = "erkasa.capabilities/1";

export interface SetCapability {
  id: string;
  marks: Array<{ id: string; kind: string; surface: boolean }>;
  props: Array<{ id: string; kind: string }>;
  /** Named points people can look at or point to. */
  targets: string[];
}

export interface EngineCapabilities {
  version: typeof CAPABILITIES_VERSION;
  sets: SetCapability[];
  verbs: string[];
  moods: string[];
  lights: string[];
  templates: string[];
}

export function capabilities(): EngineCapabilities {
  return {
    version: CAPABILITIES_VERSION,
    sets: Object.values(SETS).map((s) => ({
      id: s.id,
      marks: Object.entries(s.marks).map(([id, m]) => ({ id, kind: m.kind, surface: Boolean(m.surfaceY) })),
      props: Object.entries(s.props).map(([id, p]) => ({ id, kind: p.kind })),
      targets: Object.keys(s.targets),
    })),
    verbs: [...Verb.options],
    moods: [...Mood.options],
    lights: [...Light.options],
    templates: [...Template.options],
  };
}
