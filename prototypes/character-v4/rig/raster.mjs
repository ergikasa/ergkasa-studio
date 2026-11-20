/* global process */
/**
 * Rasterising exactly the way the production engine does (film/src/raster.ts): resvg 2.6, the engine's fonts,
 * no system fonts, and the engine's opacity guard (engine/src/core/svg-template.ts, copied here verbatim so the
 * prototype does not import production code).
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(join(process.cwd(), "film", "package.json"));
const { Resvg } = require("@resvg/resvg-js");
const fontDir = dirname(require.resolve("@expo-google-fonts/montserrat/package.json"));
const fontFiles = ["500Medium/Montserrat_500Medium.ttf", "800ExtraBold/Montserrat_800ExtraBold.ttf"].map(
  (p) => join(fontDir, p),
);

export const OPACITY_GUARD =
  '<rect x="-100000" y="-100000" width="200000" height="200000" fill="#000" fill-opacity="0"/>';

export function safeOpacity(markup) {
  return markup
    .replace(
      /<(circle|rect|ellipse|path|polygon|polyline|line|text)\b([^>]*?)\sopacity="([\d.]+)"([^>]*)>/g,
      (m, tag, a, o, b) =>
        /fill-opacity|stroke-opacity/.test(a + b)
          ? m
          : `<${tag}${a} fill-opacity="${o}" stroke-opacity="${o}"${b}>`,
    )
    .replace(/<g\b([^>]*?)\sopacity="([\d.]+)"([^>]*?)(?<!\/)>/g, (m) => m + OPACITY_GUARD);
}

const opts = (width) => ({
  fitTo: width ? { mode: "width", value: width } : { mode: "original" },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
});

/** RGBA pixels and the time spent in resvg (parse + render), in ms. */
export function rasterize(svg, width) {
  const t0 = process.hrtime.bigint();
  const r = new Resvg(safeOpacity(svg), opts(width));
  const t1 = process.hrtime.bigint();
  const img = r.render();
  const t2 = process.hrtime.bigint();
  return {
    pixels: img.pixels,
    width: img.width,
    height: img.height,
    parseMs: Number(t1 - t0) / 1e6,
    renderMs: Number(t2 - t1) / 1e6,
    img,
  };
}

export function png(svg, width) {
  return new Resvg(safeOpacity(svg), opts(width)).render().asPng();
}

// ------------------------------------------------------------------------------------------------ filter fitting

const FIT = [0.04, 0.1, 0.2, 0.35];
const NUM = /-?\d+(?:\.\d+)?/g;

/** Bounding box (w, h) of an element's own geometry from its attributes (absolute path data, circle, rect). */
function geomSize(tag, attrs) {
  const get = (k) => {
    const m = attrs.match(new RegExp(`\\s${k}="([^"]*)"`));
    return m ? m[1] : null;
  };
  if (tag === "path") {
    const d = get("d");
    if (!d) return null;
    const n = d.match(NUM);
    if (!n || n.length < 4) return null;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = +n[i],
        y = +n[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return [x1 - x0, y1 - y0];
  }
  if (tag === "circle") return [2 * +get("r"), 2 * +get("r")];
  if (tag === "ellipse") return [2 * +get("rx"), 2 * +get("ry")];
  if (tag === "rect") return [+get("width"), +get("height")];
  return null;
}

/**
 * Give every blurred element a filter region that fits it. Blur filters are authored with a generous region
 * (−60 % / 220 %) so small shapes never clip; on a large shape that region is up to ~5× the pixels the blur needs.
 * This pass computes each element's size, the margin its blur really needs (3σ plus half the stroke), and points
 * it at the smallest region variant that holds it. The picture does not change; the work does.
 */
export function fitFilters(svg) {
  const sigma = new Map();
  svg.replace(
    /<filter id="([^"]+)" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="([\d.]+)"\/><\/filter>/g,
    (m, id, sd) => {
      sigma.set(id, +sd);
      return m;
    },
  );
  if (!sigma.size) return svg;
  const variants = [];
  for (const [id, sd] of sigma)
    FIT.forEach((m, i) =>
      variants.push(
        `<filter id="${id}_${i}" x="${-m * 100}%" y="${-m * 100}%" width="${100 + 2 * m * 100}%" height="${100 + 2 * m * 100}%"><feGaussianBlur stdDeviation="${sd}"/></filter>`,
      ),
    );
  let changed = 0;
  const out = svg.replace(
    /<(path|circle|ellipse|rect)\b([^>]*?)filter="url\(#([^)]+)\)"([^>]*)>/g,
    (m, tag, a, id, b) => {
      const sd = sigma.get(id);
      if (sd === undefined) return m;
      const size = geomSize(tag, a + b);
      if (!size || !(size[0] > 0) || !(size[1] > 0)) return m;
      const sw = +((a + b).match(/stroke-width="([\d.]+)"/)?.[1] ?? 0);
      const need = Math.max((3 * sd + sw / 2) / size[0], (3 * sd + sw / 2) / size[1]);
      const i = FIT.findIndex((v) => v >= need);
      if (i < 0) return m;
      changed++;
      return `<${tag}${a}filter="url(#${id}_${i})"${b}>`;
    },
  );
  fitFilters.last = changed;
  return out.replace("<defs>", `<defs>${variants.join("")}`);
}
