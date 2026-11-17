/** One finished W0 frame: the composited picture with its type and captions, as RGBA bytes. */
import { finalPixels } from "./compositor.js";
import { renderFrame, typeSvg, type Prepared } from "./composer.js";

export async function finalFrame(P: Prepared, i: number, t: number): Promise<Buffer> {
  const c = await renderFrame(P, i, t);
  return finalPixels(c, typeSvg(P, P.shots[i] as Prepared["shots"][number], t));
}
