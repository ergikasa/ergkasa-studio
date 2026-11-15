/** Hand props, drawn centred on their grip point so a hand can hold them. */
import { PALETTE as C } from "./style.js";
import { fmt } from "./motion.js";

export type PropKind = "cup" | "paper" | "notebook" | "phone";

export function drawProp(
  kind: PropKind,
  x: number,
  y: number,
  opts: { rot?: number; scale?: number; facing?: 1 | -1; resting?: boolean } = {},
): string {
  // flat things lie on the surface when nobody holds them (seen from the side: a thin sheet)
  if (opts.resting && (kind === "paper" || kind === "notebook" || kind === "phone")) {
    const w = kind === "paper" ? 92 : kind === "notebook" ? 96 : 60;
    const th = kind === "paper" ? 5 : kind === "notebook" ? 12 : 8;
    const col = kind === "paper" ? "#FBF7F0" : kind === "notebook" ? C.coral : C.ink;
    const page =
      kind === "notebook"
        ? `<rect x="${-w / 2 + 4}" y="${-th - 3}" width="${w - 8}" height="4" fill="#FBF7F0"/>`
        : "";
    return `<g transform="translate(${fmt(x)} ${fmt(y + 24)})"><rect x="${-w / 2}" y="${-th}" width="${w}" height="${th}" rx="2" fill="${col}"/>${page}</g>`;
  }
  const s = opts.scale ?? 1;
  const f = opts.facing ?? 1;
  const tr = `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(opts.rot ?? 0)}) scale(${fmt(s * f)} ${fmt(s)})`;
  switch (kind) {
    case "cup":
      return `<g transform="${tr}"><rect x="-22" y="-30" width="44" height="52" rx="7" fill="${C.cream}"/><path d="M22 -18 q20 0 20 14 q0 14 -20 13" stroke="${C.cream}" stroke-width="8" fill="none"/><rect x="-22" y="-30" width="44" height="9" rx="4" fill="#6B452B" opacity=".55"/></g>`;
    case "paper":
      return `<g transform="${tr}"><rect x="-34" y="-46" width="68" height="92" rx="4" fill="#FBF7F0"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="-24" y="${-32 + i * 15}" width="${i === 0 ? 34 : 48}" height="${i === 0 ? 7 : 4}" fill="${i === 0 ? C.slate : "#B8B0A2"}"/>`).join("")}</g>`;
    case "notebook":
      return `<g transform="${tr}"><rect x="-40" y="-30" width="80" height="60" rx="5" fill="${C.coral}"/><rect x="-34" y="-24" width="68" height="48" fill="#FBF7F0"/>${[0, 1, 2].map((i) => `<rect x="-26" y="${-14 + i * 12}" width="44" height="4" fill="#B8B0A2"/>`).join("")}</g>`;
    case "phone":
      return `<g transform="${tr}"><rect x="-16" y="-30" width="32" height="60" rx="6" fill="${C.ink}"/><rect x="-12" y="-24" width="24" height="46" rx="3" fill="#7FB7E0"/></g>`;
  }
}
