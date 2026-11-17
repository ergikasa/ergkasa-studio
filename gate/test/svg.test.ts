/** SVG_UNSAFE: what a file-drawn SVG may contain. Positive cases, every library SVG, and one refusal per rule. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSvg } from "../src/index.js";
import { ROOT } from "./helpers.js";

const svg = (body: string, head = ""): Buffer =>
  Buffer.from(
    `${head}<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${body}</svg>`,
  );
const verdict = (b: Buffer): string => {
  const v = checkSvg(b);
  return v.ok ? "OK" : v.reason;
};

describe("accepted", () => {
  it("every SVG of the asset library, unchanged", () => {
    const files = execFileSync("git", ["ls-files", "assets/**/*.svg"], { cwd: ROOT, encoding: "utf8" })
      .trim()
      .split("\n");
    expect(files.length).toBeGreaterThan(600);
    const refused = files.filter((f) => !checkSvg(readFileSync(join(ROOT, f))).ok);
    expect(refused).toEqual([]);
  });

  it.each([
    [
      "shapes, an XML declaration and a comment",
      svg(`<!-- c --><rect width="5" height="5" fill="#f00"/>`, `<?xml version="1.0" encoding="UTF-8"?>`),
    ],
    [
      "url(#id) to a gradient that exists",
      svg(
        `<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><rect fill="url(#g)" width="5" height="5"/>`,
      ),
    ],
    [
      "clip-path url('#id') with quotes",
      svg(`<clipPath id="c"><rect width="5" height="5"/></clipPath><g clip-path="url('#c')"/>`),
    ],
    [
      "href and xlink:href to an element that exists",
      svg(`<defs><path id="p" d="M0 0"/></defs><use href="#p"/><use xlink:href="#p"/>`),
    ],
    [
      "a <style> with internal url(#id) in CDATA",
      svg(
        `<defs><linearGradient id="g"/></defs><style><![CDATA[.a{fill:url(#g)}]]></style><rect class="a"/>`,
      ),
    ],
    ["the five predefined XML entities", svg(`<text>&lt;&gt;&amp;&quot;&apos;</text>`)],
  ])("%s", (_, b) => {
    expect(verdict(b)).toBe("OK");
  });
});

describe("refused with SVG_UNSAFE", () => {
  it.each([
    [
      "DOCTYPE",
      svg(
        `<rect/>`,
        `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`,
      ),
      /DOCTYPE/,
    ],
    [
      "an external entity",
      svg(`<text>&xxe;</text>`, `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>`),
      /DOCTYPE/,
    ],
    ["an undefined (custom) entity", svg(`<text>&custom;</text>`), /not well-formed/],
    [
      "xml-stylesheet",
      svg(`<rect/>`, `<?xml-stylesheet href="http://evil/x.css"?>`),
      /processing instruction/,
    ],
    ["<script>", svg(`<script>alert(1)</script>`), /<script>/],
    [
      "<script> with a namespace prefix",
      svg(`<svg:script xmlns:svg="http://www.w3.org/2000/svg">x</svg:script>`),
      /<svg:script>/,
    ],
    [
      "<foreignObject>",
      svg(`<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>`),
      /foreignObject/,
    ],
    ["an onload attribute", svg(`<rect onload="x()"/>`), /event handlers/],
    ["an external href (http)", svg(`<image href="http://example.com/a.png"/>`), /not an internal reference/],
    ["an external href (file path)", svg(`<image xlink:href="/etc/passwd"/>`), /not an internal reference/],
    ["a data: href", svg(`<image href="data:image/png;base64,AAAA"/>`), /not an internal reference/],
    ["a src attribute", svg(`<image src="a.png"/>`), /not an internal reference/],
    ["@import in <style>", svg(`<style>@import url(#x);</style>`), /@import/],
    [
      "url(http…) in a style attribute",
      svg(`<rect style="fill:url(http://evil/x)"/>`),
      /not an internal reference/,
    ],
    [
      "url(file) in a presentation attribute",
      svg(`<rect fill="url(other.svg#g)"/>`),
      /not an internal reference/,
    ],
    ["javascript: in an attribute", svg(`<a href="javascript:alert(1)"><rect/></a>`), /javascript:/],
    [
      "an internal reference without its target",
      svg(`<rect fill="url(#missing)"/>`),
      /#missing has no element/,
    ],
    ["a root that is not <svg>", Buffer.from(`<html><body/></html>`), /not <svg>/],
    ["XML that is not well formed", svg(`<rect>`), /not well-formed/],
    ["bytes that are not UTF-8", Buffer.from([0x3c, 0x73, 0x76, 0x67, 0xff, 0xfe, 0x3e]), /UTF-8/],
  ])("%s", (_, b, re) => {
    expect(verdict(b)).toMatch(re);
  });

  it("stops at the first problem: nothing after it is examined", () => {
    // the first problem is the script; the missing reference after it is never reported
    expect(verdict(svg(`<script/><rect fill="url(#missing)"/>`))).toMatch(/<script>/);
  });
});
