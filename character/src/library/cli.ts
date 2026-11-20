/* The Character Library command line.
 *
 *   pnpm --filter @erkasa/character cli verify <dir>       load + validate + self-check one package
 *   pnpm --filter @erkasa/character cli publish <dir>      verify and add it to library/catalog.json
 *   pnpm --filter @erkasa/character cli resolve <ref>      chr_name@3#sha256:<hex> → folder, bytes checked
 *   pnpm --filter @erkasa/character cli check              every package of the library against the catalog
 */
import { resolve } from "node:path";
import { CharacterError, type Finding } from "../runtime/index.js";
import { immutableRef } from "./catalog.js";
import { LIBRARY_ROOT, packageDirs, publish, readCatalog, resolveRef, verifyPackage } from "./store.js";

const show = (fs: readonly Finding[]): void => {
  for (const f of fs) console.info(`  ${f.level} ${f.code} ${f.where}: ${f.message}`);
};

async function main(): Promise<number> {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === "verify" && arg) {
      const v = await verifyPackage(resolve(arg));
      console.info(`ok ${v.character.manifest.id}@${v.character.manifest.version} sha256 ${v.character.sha256}`);
      show(v.findings);
      return 0;
    }
    if (cmd === "publish" && arg) {
      const e = await publish(resolve(arg));
      console.info(`published ${immutableRef(e)}`);
      return 0;
    }
    if (cmd === "resolve" && arg) {
      const r = resolveRef(arg);
      console.info(r.dir);
      return 0;
    }
    if (cmd === "check") {
      const catalog = readCatalog();
      let bad = 0;
      for (const dir of packageDirs()) {
        const v = await verifyPackage(dir);
        const m = v.character.manifest;
        const e = catalog.characters.find((x) => x.id === m.id && x.version === m.version);
        if (!e || e.sha256 !== v.character.sha256) {
          console.error(`not published or changed: ${m.id}@${m.version}`);
          bad++;
        } else console.info(`ok ${immutableRef(e)}`);
      }
      console.info(`${packageDirs().length} packages in ${LIBRARY_ROOT}`);
      return bad ? 1 : 0;
    }
    console.error("usage: verify <dir> | publish <dir> | resolve <ref> | check");
    return 2;
  } catch (e) {
    if (e instanceof CharacterError) {
      console.error(e.message);
      show(e.findings);
      return 1;
    }
    throw e;
  }
}

process.exitCode = await main();
