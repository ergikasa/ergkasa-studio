/**
 * Findings and errors of the Character Runtime. A finding is what the validator reports (like the Validation
 * Gate's findings); an error stops loading or evaluation with the same code, so a caller can tell why.
 */
export interface Finding {
  level: "error" | "warning";
  code: string;
  /** Where in the package: `character.json`, `parts/head.json#mouth`, `controls[3]`... */
  where: string;
  message: string;
}

export class CharacterError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly findings: readonly Finding[] = [],
  ) {
    super(`${code}: ${message}`);
    this.name = "CharacterError";
  }
}

export const errorsOf = (fs: readonly Finding[]): Finding[] => fs.filter((f) => f.level === "error");
