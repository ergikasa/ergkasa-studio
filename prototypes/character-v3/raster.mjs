/* global process */
// PNG from SVG with the repository's resvg and Montserrat (prototype tooling).
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(join(process.cwd(), "film", "package.json"));
const { Resvg } = require("@resvg/resvg-js");
const fontDir = dirname(require.resolve("@expo-google-fonts/montserrat/package.json"));
const fontFiles = ["500Medium/Montserrat_500Medium.ttf", "800ExtraBold/Montserrat_800ExtraBold.ttf"].map(
  (p) => join(fontDir, p),
);
export function png(svg, width) {
  return new Resvg(svg, {
    fitTo: width ? { mode: "width", value: width } : { mode: "original" },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  })
    .render()
    .asPng();
}
export function rgba(svg) {
  return new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  }).render().pixels;
}
