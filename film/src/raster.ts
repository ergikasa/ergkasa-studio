/**
 * SVG to pixels with resvg: the engine's fonts only (no system fonts), no resource directory, so an SVG can draw
 * nothing but what it carries (E1.4: file assets arrive inline, as data URIs of the bytes the gate verified).
 */
import { safeOpacity } from "@erkasa/engine";
import { Resvg } from "@resvg/resvg-js";
import { fontFiles } from "./style.js";

let fonts: string[] | undefined;
const options = () => {
  fonts ??= fontFiles();
  return {
    fitTo: { mode: "original" as const },
    font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
  };
};

/** RGBA pixels. resvg 2.6 aborts on an element with opacity that lies entirely outside the frame; the engine's guard fixes it. */
export function rasterize(svg: string): Buffer {
  return new Resvg(safeOpacity(svg), options()).render().pixels;
}

export function png(svg: string): Buffer {
  return new Resvg(safeOpacity(svg), options()).render().asPng();
}
