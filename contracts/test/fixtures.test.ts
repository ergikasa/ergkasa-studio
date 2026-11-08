import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { CONTRACTS } from "../src/index.js";
import { CONTRACTS_DIR, loadFixtures } from "./helpers.js";

/**
 * Every fixture is checked twice: with Zod (what TypeScript services use) and with the exported
 * JSON Schema (what the Java backend uses). Both sides must agree.
 */
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);

const compiled = new Map<string, ReturnType<typeof ajv.compile>>();

function jsonSchemaValidator(name: string) {
  let validate = compiled.get(name);
  if (!validate) {
    const schema = JSON.parse(
      readFileSync(join(CONTRACTS_DIR, "json-schema", `${name}.schema.json`), "utf8"),
    ) as object;
    validate = ajv.compile(schema);
    compiled.set(name, validate);
  }
  return validate;
}

describe("valid fixtures", () => {
  for (const fx of loadFixtures("valid")) {
    it(`${fx.file} passes Zod`, () => {
      const res = CONTRACTS[fx.contract].safeParse(fx.data);
      expect(res.success, res.success ? "" : JSON.stringify(res.error.issues, null, 2)).toBe(true);
    });
    it(`${fx.file} passes JSON Schema`, () => {
      const validate = jsonSchemaValidator(fx.contract);
      expect(validate(fx.data), JSON.stringify(validate.errors, null, 2)).toBe(true);
    });
  }
});

describe("invalid fixtures", () => {
  for (const fx of loadFixtures("invalid")) {
    it(`${fx.file} fails Zod`, () => {
      expect(CONTRACTS[fx.contract].safeParse(fx.data).success).toBe(false);
    });
    it(`${fx.file} fails JSON Schema`, () => {
      expect(jsonSchemaValidator(fx.contract)(fx.data)).toBe(false);
    });
  }
});
