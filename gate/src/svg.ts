/**
 * SVG content policy (SVG_UNSAFE): an SVG file asset may draw, never act or fetch.
 *
 * The bytes the gate verified are parsed as XML with saxes (a streaming parser that does not process DTDs and
 * defines no entity beyond XML's five). Parsing stops at the first problem; no event after it is used. Refused:
 *
 *   - bytes that are not UTF-8, XML that is not well formed, a root that is not <svg>
 *   - any DOCTYPE (so no DTD and no custom or external entity) and any processing instruction
 *     (xml-stylesheet included; the <?xml …?> declaration is not a processing instruction)
 *   - <script>, <foreignObject>, and every on* attribute
 *   - href, xlink:href and src that are not an internal reference #id (data:, http:, file: and paths too)
 *   - in style attributes and <style>: @import, expression(, javascript:, and url(…) other than url(#id)
 *   - javascript: in any attribute value
 *   - an internal reference whose id the document does not define
 *
 * This is one check among the others (size budget, containment, hash); it does not replace them.
 */
import { SaxesParser } from "saxes";

export type SvgVerdict = { ok: true } | { ok: false; reason: string };

class Refused extends Error {}

const INTERNAL = /^#([A-Za-z_][A-Za-z0-9_.:-]*)$/;
const FORBIDDEN_ELEMENTS = new Set(["script", "foreignobject"]);
const local = (name: string): string =>
  (name.includes(":") ? (name.split(":").pop() as string) : name).toLowerCase();

/** Checks CSS (a style attribute or a <style> element) and records its internal references. */
function checkCss(css: string, refs: Set<string>, where: string): void {
  if (/@import/i.test(css)) throw new Refused(`${where}: @import`);
  if (/expression\s*\(/i.test(css)) throw new Refused(`${where}: expression(`);
  if (/javascript:/i.test(css)) throw new Refused(`${where}: javascript:`);
  for (const m of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    const ref = INTERNAL.exec((m[2] ?? "").trim());
    if (!ref) throw new Refused(`${where}: url(${m[2]}) is not an internal reference`);
    refs.add(ref[1] as string);
  }
  if (/url\(/i.test(css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, "")))
    throw new Refused(`${where}: malformed url(`);
}

export function checkSvg(bytes: Uint8Array): SvgVerdict {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "not valid UTF-8" };
  }
  const ids = new Set<string>();
  const refs = new Set<string>();
  const stack: string[] = [];
  let style = "";
  let root: string | undefined;
  const parser = new SaxesParser({ xmlns: false });
  parser.on("error", (e) => {
    throw new Refused(`not well-formed XML: ${e.message}`);
  });
  parser.on("doctype", () => {
    throw new Refused("DOCTYPE is not allowed (no DTD, no entities)");
  });
  parser.on("processinginstruction", (pi) => {
    throw new Refused(`processing instruction <?${pi.target} …?> is not allowed`);
  });
  parser.on("opentag", (tag) => {
    const name = local(tag.name);
    if (root === undefined) {
      root = name;
      if (name !== "svg") throw new Refused(`the root element is <${tag.name}>, not <svg>`);
    }
    if (FORBIDDEN_ELEMENTS.has(name)) throw new Refused(`<${tag.name}> is not allowed`);
    for (const [attr, raw] of Object.entries(tag.attributes)) {
      const value = String(raw);
      const a = local(attr);
      const where = `<${tag.name} ${attr}>`;
      if (a.startsWith("on")) throw new Refused(`${where}: event handlers are not allowed`);
      if (/javascript:/i.test(value)) throw new Refused(`${where}: javascript:`);
      if (a === "id") ids.add(value);
      if (a === "href" || a === "src") {
        const ref = INTERNAL.exec(value.trim());
        if (!ref) throw new Refused(`${where}: '${value.slice(0, 60)}' is not an internal reference`);
        refs.add(ref[1] as string);
      } else if (a === "style" || /url\(/i.test(value)) checkCss(value, refs, where);
    }
    stack.push(name);
    if (name === "style") style = "";
  });
  const styleText = (t: string): void => {
    if (stack[stack.length - 1] === "style") style += t;
  };
  parser.on("text", styleText);
  parser.on("cdata", styleText);
  parser.on("closetag", () => {
    const name = stack.pop();
    if (name === "style") checkCss(style, refs, "<style>");
  });
  try {
    parser.write(text).close();
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.message };
    return { ok: false, reason: `not well-formed XML: ${(e as Error).message}` };
  }
  if (root === undefined) return { ok: false, reason: "no root element" };
  for (const r of refs)
    if (!ids.has(r)) return { ok: false, reason: `internal reference #${r} has no element with that id` };
  return { ok: true };
}
