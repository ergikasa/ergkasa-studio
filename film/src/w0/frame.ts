/** One finished W0 frame: the composited picture with its type and captions, as RGBA bytes. */
import { loadImage } from "@napi-rs/canvas";
import { DEFS, H, W } from "../style.js";
import { renderFrame, typeSvg, TYPE_DEFS, type Prepared } from "./composer.js";

export async function finalFrame(P: Prepared, i: number, t: number): Promise<Buffer> {
  const c = await renderFrame(P, i, t);
  const ctx = c.getContext("2d");
  const ty = typeSvg(P, P.shots[i] as Prepared["shots"][number], t);
  if (ty) {
    const img = await loadImage(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${DEFS}${TYPE_DEFS}</defs>${ty}</svg>`,
      ),
    );
    ctx.drawImage(img, 0, 0);
  }
  return Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
}
