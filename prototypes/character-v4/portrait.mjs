/* global process */
/**
 * Character v4 prototype: the portrait (approval piece for the artistic direction). Not production code.
 *
 * Daniel Vos, 44, the cast's reporter archetype. Original character: the reference photographs informed anatomy
 * and proportion only.
 */
import { makeHead, svgHead } from "./head.mjs";
import { svgHair, svgBeard } from "./hair.mjs";
import { smooth, taper, rng, sample, lerp, f } from "./lib.mjs";

export function headLayers(view = {}) {
  const H = makeHead(view);
  const h = svgHead(H, { look: [0.14, 0.06] });
  const hair = svgHair();
  const beard = svgBeard(H, { lips: h.lips });
  const bare = process.env.BARE === "1";
  return {
    defs: h.defs + hair.defs + beard.defs,
    neck: h.neck,
    head: h.face + h.features + (bare ? "" : beard.svg + hair.svg) + h.ear,
    H,
  };
}

// ------------------------------------------------------------------------------------------------ wardrobe

const NAVY = "#25314A";
const NAVY_LIT = "#3A4A69";
const NAVY_HI = "#5A6D90";
const NAVY_DARK = "#121827";
const KNIT = "#CDBFA8";
const KNIT_SHADE = "#8F8270";

/**
 * Bust: a navy cotton chore jacket (point collar, top-stitching, a chest patch pocket) over an oatmeal crewneck
 * knit. The body is turned a little further from the camera than the head.
 */
export function bustSvg() {
  const R = rng(5);
  const defs = [];
  const out = [];
  defs.push(
    `<filter id="twill" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1 0.3" numOctaves="2" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.68  0 0 0 0 0.82  0 0 0 -1.7 0.95"/></filter>`,
    `<filter id="knitTex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.06 0.42" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.24  0 0 0 -1.6 1.0"/></filter>`,
  );
  const clip = (id, pts, k = 0.14) => {
    const d = smooth(pts, true, k);
    defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    return d;
  };

  // the knit: the crew neck sits at the base of the neck, the body shows between the jacket fronts
  const knitD = clip("knitClip", [
    [690, 1424],
    [760, 1496],
    [840, 1528],
    [930, 1520],
    [1030, 1480],
    [1120, 1424],
    [1150, 1500],
    [1060, 2000],
    [700, 2000],
    [660, 1500],
  ]);
  out.push(`<path d="${knitD}" fill="${KNIT}"/>`);
  out.push(
    `<g clip-path="url(#knitClip)">`,
    `<rect x="620" y="1380" width="560" height="640" filter="url(#knitTex)" opacity=".45"/>`,
    // the neck and the jacket shade the knit; it turns away into the near side
    `<path d="${smooth(
      [
        [690, 1440],
        [840, 1540],
        [1120, 1440],
        [1150, 1580],
        [840, 1620],
        [690, 1540],
      ],
      true,
    )}" fill="${KNIT_SHADE}" opacity=".55" filter="url(#b16)"/>`,
    `<path d="${smooth(
      [
        [930, 1520],
        [1160, 1440],
        [1160, 2000],
        [960, 2000],
      ],
      true,
    )}" fill="#5E5446" opacity=".6" filter="url(#b24)"/>`,
    `<path d="${smooth(
      [
        [700, 1560],
        [760, 1600],
        [780, 2000],
        [700, 2000],
      ],
      true,
    )}" fill="#E6DAC4" opacity=".35" filter="url(#b16)"/>`,
    `</g>`,
  );
  // ribbed neckband
  const bandOuter = sample(
    [
      [690, 1424],
      [760, 1496],
      [840, 1528],
      [930, 1520],
      [1030, 1480],
      [1120, 1424],
    ],
    70,
  );
  const bandInner = sample(
    [
      [706, 1394],
      [770, 1458],
      [842, 1488],
      [926, 1482],
      [1020, 1446],
      [1106, 1394],
    ],
    70,
  );
  out.push(`<path d="${smooth([...bandOuter, ...bandInner.slice().reverse()], true, 0.1)}" fill="#D8CCB6"/>`);
  let ribs = "";
  for (let i = 0; i < 70; i++) {
    const a = bandOuter[i],
      b = bandInner[i];
    ribs += `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} `;
  }
  out.push(`<path d="${ribs}" stroke="#A39580" stroke-width="2.2" fill="none" opacity=".6"/>`);
  out.push(
    `<path d="${smooth(bandInner, false)}" stroke="#6E604E" stroke-width="5" fill="none" opacity=".6" filter="url(#b2)"/>`,
  );
  out.push(
    `<path d="${smooth(
      [
        [930, 1500],
        [1040, 1470],
        [1120, 1424],
        [1130, 1460],
        [1040, 1510],
        [940, 1530],
      ],
      true,
    )}" fill="#5E5446" opacity=".55" filter="url(#b6)"/>`,
  );

  // the collar stand behind the neck (near side), then the two jacket fronts
  const standD = clip("standClip", [
    [1110, 1360],
    [1160, 1316],
    [1214, 1300],
    [1250, 1340],
    [1236, 1420],
    [1150, 1440],
  ]);
  out.push(`<path d="${standD}" fill="#1A2234"/>`);
  out.push(
    `<path d="${smooth(
      [
        [1160, 1316],
        [1214, 1300],
        [1250, 1340],
      ],
      false,
    )}" stroke="#8DA6C2" stroke-width="3" fill="none" opacity=".5" filter="url(#b1)"/>`,
  );

  const farJ = [
    [0, 2000],
    [0, 1640],
    [90, 1560],
    [250, 1500],
    [420, 1462],
    [560, 1436],
    [660, 1414],
    [700, 1420],
    [728, 1500],
    [752, 1620],
    [764, 1760],
    [766, 2000],
  ];
  const nearJ = [
    [1010, 2000],
    [1004, 1800],
    [996, 1660],
    [1010, 1540],
    [1060, 1470],
    [1130, 1420],
    [1200, 1380],
    [1290, 1404],
    [1400, 1444],
    [1500, 1490],
    [1580, 1550],
    [1600, 1600],
    [1600, 2000],
  ];
  const farD = clip("jf", farJ);
  const nearD = clip("jn", nearJ);
  out.push(`<path d="${farD}" fill="${NAVY}"/>`);
  out.push(
    `<g clip-path="url(#jf)">`,
    // the far half faces the key: the shoulder plane is lit, the chest turns into the opening
    `<path d="${smooth(
      [
        [60, 1600],
        [300, 1500],
        [600, 1440],
        [700, 1480],
        [640, 1600],
        [380, 1680],
        [120, 1760],
      ],
      true,
    )}" fill="${NAVY_LIT}" opacity=".9" filter="url(#b24)"/>`,
    `<path d="${smooth(
      [
        [140, 1560],
        [380, 1490],
        [600, 1446],
        [560, 1490],
        [330, 1540],
        [150, 1600],
      ],
      true,
    )}" fill="${NAVY_HI}" opacity=".45" filter="url(#b10)"/>`,
    `<path d="${smooth(
      [
        [640, 1460],
        [740, 1500],
        [770, 2000],
        [680, 2000],
        [660, 1700],
      ],
      true,
    )}" fill="${NAVY_DARK}" opacity=".55" filter="url(#b16)"/>`,
    // the yoke seam and the drag folds from the shoulder toward the chest
    `<path d="${smooth(
      [
        [40, 1640],
        [200, 1600],
        [380, 1572],
        [560, 1548],
        [690, 1530],
      ],
      false,
    )}" stroke="${NAVY_DARK}" stroke-width="5" fill="none" opacity=".55" filter="url(#b2)"/>`,
    `<path d="${smooth(
      [
        [40, 1648],
        [200, 1608],
        [380, 1580],
        [560, 1556],
        [690, 1538],
      ],
      false,
    )}" stroke="#7186AA" stroke-width="1.6" stroke-dasharray="8 6" fill="none" opacity=".55"/>`,
    `<path d="${taper(
      sample(
        [
          [260, 1700],
          [420, 1720],
          [600, 1700],
          [700, 1660],
        ],
        16,
      ),
      9,
      0.5,
    )}" fill="${NAVY_DARK}" opacity=".5" filter="url(#b4)"/>`,
    `<path d="${taper(
      sample(
        [
          [250, 1690],
          [420, 1708],
          [600, 1688],
        ],
        16,
      ),
      6,
      0.4,
    )}" fill="${NAVY_HI}" opacity=".35" filter="url(#b3)"/>`,
    `<path d="${taper(
      sample(
        [
          [120, 1860],
          [330, 1880],
          [560, 1840],
          [700, 1780],
        ],
        16,
      ),
      11,
      0.5,
    )}" fill="${NAVY_DARK}" opacity=".45" filter="url(#b6)"/>`,
    // the chest patch pocket, top-stitched
    `<path d="${smooth(
      [
        [420, 1760],
        [640, 1736],
        [652, 1950],
        [432, 1976],
      ],
      true,
      0.04,
    )}" fill="#2C3A57" opacity=".7"/>`,
    `<path d="${smooth(
      [
        [420, 1760],
        [640, 1736],
        [652, 1950],
        [432, 1976],
      ],
      true,
      0.04,
    )}" fill="none" stroke="${NAVY_DARK}" stroke-width="3" opacity=".6"/>`,
    `<path d="M430 1772 L632 1749" stroke="#7186AA" stroke-width="1.6" stroke-dasharray="8 6" opacity=".6"/>`,
    `<path d="M428 1792 L634 1769" stroke="#7186AA" stroke-width="1.6" stroke-dasharray="8 6" opacity=".45"/>`,
    `<path d="M418 1770 L436 1972" stroke="#7186AA" stroke-width="1.6" stroke-dasharray="8 6" opacity=".4"/>`,
    `<rect x="0" y="1380" width="800" height="640" filter="url(#twill)" opacity=".16"/>`,
    `</g>`,
    // the front edge: top-stitching and a dark edge where the cloth turns
    `<path d="${smooth(
      [
        [714, 1460],
        [738, 1560],
        [752, 1680],
        [758, 2000],
      ],
      false,
    )}" stroke="#7186AA" stroke-width="1.6" stroke-dasharray="8 6" fill="none" opacity=".5"/>`,
    `<path d="${smooth(
      [
        [700, 1420],
        [728, 1500],
        [752, 1620],
        [764, 1760],
        [766, 2000],
      ],
      false,
    )}" stroke="${NAVY_DARK}" stroke-width="4" fill="none" opacity=".8"/>`,
  );
  out.push(`<path d="${nearD}" fill="${NAVY}"/>`);
  out.push(
    `<g clip-path="url(#jn)">`,
    // the near half turns away from the key; a cool rim on the shoulder line
    `<path d="${smooth(
      [
        [1000, 1500],
        [1200, 1400],
        [1600, 1560],
        [1600, 2000],
        [1000, 2000],
      ],
      true,
    )}" fill="${NAVY_DARK}" opacity=".6" filter="url(#b24)"/>`,
    `<path d="${smooth(
      [
        [1004, 1560],
        [1060, 1480],
        [1100, 1600],
        [1060, 2000],
        [1004, 2000],
      ],
      true,
    )}" fill="${NAVY_LIT}" opacity=".45" filter="url(#b16)"/>`,
    `<path d="${smooth(
      [
        [1200, 1384],
        [1290, 1406],
        [1400, 1446],
        [1500, 1492],
        [1580, 1552],
      ],
      false,
    )}" stroke="#A9C2DA" stroke-width="10" fill="none" opacity=".4" filter="url(#b6)"/>`,
    `<path d="${smooth(
      [
        [1070, 1620],
        [1240, 1590],
        [1420, 1580],
        [1600, 1600],
      ],
      false,
    )}" stroke="${NAVY_DARK}" stroke-width="5" fill="none" opacity=".6" filter="url(#b2)"/>`,
    `<path d="${smooth(
      [
        [1070, 1628],
        [1240, 1598],
        [1420, 1588],
        [1600, 1608],
      ],
      false,
    )}" stroke="#5A6E92" stroke-width="1.6" stroke-dasharray="8 6" fill="none" opacity=".45"/>`,
    `<path d="${taper(
      sample(
        [
          [1080, 1760],
          [1260, 1740],
          [1460, 1780],
        ],
        14,
      ),
      9,
      0.5,
    )}" fill="#090D16" opacity=".5" filter="url(#b4)"/>`,
    `<path d="${taper(
      sample(
        [
          [1060, 1900],
          [1300, 1880],
          [1560, 1940],
        ],
        14,
      ),
      11,
      0.5,
    )}" fill="#090D16" opacity=".45" filter="url(#b6)"/>`,
    `<rect x="980" y="1360" width="640" height="660" filter="url(#twill)" opacity=".12"/>`,
    `</g>`,
    `<path d="${smooth(
      [
        [1018, 1540],
        [1008, 1660],
        [1014, 1800],
        [1022, 2000],
      ],
      false,
    )}" stroke="#4E6088" stroke-width="1.6" stroke-dasharray="8 6" fill="none" opacity=".5"/>`,
    `<path d="${smooth(
      [
        [1010, 1540],
        [996, 1660],
        [1004, 1800],
        [1010, 2000],
      ],
      false,
    )}" stroke="#0B0F18" stroke-width="4" fill="none" opacity=".8"/>`,
  );

  // collars: point collars turned down over the fronts
  const farCollar = [
    [688, 1392],
    [706, 1416],
    [730, 1484],
    [756, 1580],
    [700, 1560],
    [610, 1500],
    [568, 1452],
    [620, 1418],
  ];
  const nearCollar = [
    [1196, 1352],
    [1250, 1376],
    [1268, 1420],
    [1200, 1500],
    [1060, 1590],
    [1040, 1530],
    [1080, 1470],
    [1150, 1400],
  ];
  const fcD = clip("fc", farCollar, 0.1);
  const ncD = clip("nc", nearCollar, 0.1);
  out.push(
    `<path d="${fcD}" fill="#05070C" opacity=".5" transform="translate(6 10)" filter="url(#b6)"/>`,
    `<path d="${fcD}" fill="#2F3D5C"/>`,
    `<g clip-path="url(#fc)">`,
    `<path d="${smooth(
      [
        [600, 1440],
        [690, 1400],
        [720, 1480],
        [650, 1500],
      ],
      true,
    )}" fill="${NAVY_HI}" opacity=".55" filter="url(#b10)"/>`,
    `<path d="${smooth(
      [
        [700, 1500],
        [760, 1590],
        [700, 1600],
        [660, 1540],
      ],
      true,
    )}" fill="${NAVY_DARK}" opacity=".5" filter="url(#b6)"/>`,
    `</g>`,
    `<path d="${smooth(
      [
        [575, 1456],
        [618, 1500],
        [700, 1552],
        [744, 1572],
      ],
      false,
    )}" stroke="#7186AA" stroke-width="1.5" stroke-dasharray="7 5" fill="none" opacity=".55"/>`,
    `<path d="${fcD}" fill="none" stroke="#0B0F18" stroke-width="2.5" opacity=".7"/>`,
    `<path d="${ncD}" fill="#05070C" opacity=".55" transform="translate(6 10)" filter="url(#b6)"/>`,
    `<path d="${ncD}" fill="#1D2638"/>`,
    `<g clip-path="url(#nc)">`,
    `<path d="${smooth(
      [
        [1060, 1540],
        [1150, 1440],
        [1200, 1460],
        [1100, 1580],
      ],
      true,
    )}" fill="#33415E" opacity=".6" filter="url(#b10)"/>`,
    `<path d="${smooth(
      [
        [1196, 1352],
        [1250, 1376],
        [1268, 1420],
      ],
      false,
    )}" stroke="#A9C2DA" stroke-width="5" fill="none" opacity=".45" filter="url(#b2)"/>`,
    `</g>`,
    `<path d="${smooth(
      [
        [1250, 1392],
        [1190, 1470],
        [1070, 1566],
      ],
      false,
    )}" stroke="#4E6088" stroke-width="1.5" stroke-dasharray="7 5" fill="none" opacity=".5"/>`,
    `<path d="${ncD}" fill="none" stroke="#0B0F18" stroke-width="2.5" opacity=".75"/>`,
  );
  // the outer silhouette of the shoulders: a soft dark edge so the figure sits in the light
  out.push(
    `<path d="${smooth(
      [
        [0, 1640],
        [90, 1560],
        [250, 1500],
        [420, 1462],
        [560, 1436],
        [660, 1414],
      ],
      false,
    )}" stroke="#0B0F18" stroke-width="3" fill="none" opacity=".6"/>`,
  );
  void R;
  void lerp;
  return { defs: defs.join(""), svg: `<g id="wardrobe">${out.join("")}</g>` };
}

// ------------------------------------------------------------------------------------------------ set

function backdrop() {
  const defs = [
    // darker behind the lit side of the face, a cool light behind the shadow side (separation)
    `<radialGradient id="bg" cx="1220" cy="760" r="1250" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4A5C61"/><stop offset=".4" stop-color="#2C383D"/><stop offset="1" stop-color="#11171A"/></radialGradient>`,
    `<radialGradient id="glow" cx="300" cy="520" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C8A270" stop-opacity=".16"/><stop offset="1" stop-color="#C8A270" stop-opacity="0"/></radialGradient>`,
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept=".07"/></feComponentTransfer></filter>`,
    `<filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="6"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 -0.9 0.55"/></filter>`,
    `<radialGradient id="vig" cx="860" cy="900" r="1300" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`,
  ];
  const R = rng(9);
  let bokeh = "";
  for (let i = 0; i < 9; i++) {
    const x = R.range(80, 520),
      y = R.range(260, 1100),
      r = R.range(26, 70);
    bokeh += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#E0C49A" opacity="${f(R.range(0.04, 0.09))}"/>`;
  }
  const svg = `<rect width="1600" height="2000" fill="url(#bg)"/><rect width="1600" height="2000" fill="url(#glow)"/><g filter="url(#b16)">${bokeh}</g><rect width="1600" height="2000" filter="url(#paper)" opacity=".25"/>`;
  return { defs: defs.join(""), svg };
}

export function portraitSvg() {
  const L = headLayers();
  const B = bustSvg();
  const bg = backdrop();
  const grade = `<rect width="1600" height="2000" fill="url(#vig)"/><rect width="1600" height="2000" filter="url(#grain)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000"><defs>${bg.defs}${L.defs}${B.defs}</defs>${bg.svg}${L.neck}${B.svg}${L.head}${grade}</svg>`;
}
