/* global console */
/**
 * Builds the interactive review page: the prototype modules inlined (each in its own scope) + a rig panel.
 *   node prototypes/character-v3/build-page.mjs   (from the repository root)
 */
import { readFileSync, writeFileSync } from "node:fs";

const dir = "prototypes/character-v3";
const mod = (file, imports, exports) => {
  let src = readFileSync(`${dir}/${file}`, "utf8");
  src = src
    .replace(/^import[^;]+;\n/gm, "")
    .replace(/^export \{[^}]*\};\n/gm, "")
    .replace(/^export /gm, "");
  return `const ${file.replace(".mjs", "").toUpperCase()} = (() => {\n${imports}\n${src}\nreturn { ${exports} };\n})();\n`;
};
const lib =
  mod("head.mjs", "", "head, EXPRESSIONS, FACE_REST, SKIN") +
  mod(
    "body.mjs",
    "const { head: drawHead, FACE_REST, SKIN } = HEAD;",
    "character, hand, HAND_POSES, POSE_REST",
  ) +
  mod(
    "perform.mjs",
    "const { EXPRESSIONS, FACE_REST } = HEAD; const { POSE_REST } = BODY;",
    "FPS, track, expressionAt, gazeSolver, blinkAt, armAt",
  );

const html = `<!DOCTYPE html>
<html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erkasa Character v3</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&display=swap" rel="stylesheet">
<style>
/* VOICE: an animator's rig panel, calm and precise.
   IDEA: the model sheet on the desk: the character on a warm wall, the controls like a rig's dials.
   PICTURE: the character itself, large, alive (breathing, blinking, eyes following you).
   COLOUR and TYPE: warm paper wall, ink, the character's teal as the one accent; Montserrat (the studio's type).
   LAYOUT: stage left and large, controls right in groups; stacked on phones (stage, then controls). */
:root{color-scheme:light dark;--bg:light-dark(#EFE6D6,#16130F);--panel:light-dark(#F8F2E7,#211C17);--ink:light-dark(#1D1B19,#F1E8DA);--mute:light-dark(#6B6157,#A99C8B);--acc:#2F6E73;--line:light-dark(#DDD0BB,#3A322A)}
:root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}
*{box-sizing:border-box;min-width:0}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Montserrat,system-ui,sans-serif;overflow-x:clip}
header{padding:22px max(4vw,16px) 8px}
h1{font-size:clamp(26px,3.4vw,40px);line-height:1.05;margin:0;font-weight:800;text-wrap:balance}
header p{margin:6px 0 0;color:var(--mute);max-width:70ch}
main{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:20px;padding:12px max(4vw,16px) 40px}
.stage{position:relative;aspect-ratio:9/12;background:radial-gradient(120% 90% at 35% 30%,#EADCC4,#C9B597);border-radius:16px;overflow:hidden;touch-action:none}
.stage svg{position:absolute;inset:0;width:100%;height:100%}
.hint{position:absolute;left:12px;bottom:10px;font-size:13px;color:#4A4036;background:#F4EBDDcc;padding:4px 10px;border-radius:20px}
.panel{display:grid;gap:14px;align-content:start}
section{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
h2{font-size:16px;margin:0 0 10px;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:8px}
button{font:600 15px Montserrat,sans-serif;min-height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer}
button[aria-pressed=true],button.primary{background:var(--acc);border-color:var(--acc);color:#fff}
button:focus-visible,input:focus-visible{outline:3px solid #E9A23B;outline-offset:2px}
.sl{display:grid;grid-template-columns:7.5em minmax(0,1fr) 3em;align-items:center;gap:8px;font-size:14px}
.sl output{text-align:right;color:var(--mute);font-variant-numeric:tabular-nums}
input[type=range]{width:100%;accent-color:var(--acc);height:28px}
label.tog{display:flex;align-items:center;gap:8px;font-size:15px;min-height:44px}
label.tog input{width:20px;height:20px;accent-color:var(--acc)}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px}
small{color:var(--mute);font-size:13px}
@media(max-width:820px){main{grid-template-columns:minmax(0,1fr)}.stage{aspect-ratio:3/4}.grid2{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.hint{display:none}}
</style></head><body>
<header><h1>Erkasa Character v3: prototype for design review</h1>
<p>Sytë ndjekin kursorin, shprehjet përzihen butë dhe çdo kontroll i fytyrës ka rrëshqitësin e vet. Është i njëjti kod që prodhoi videon. Nuk është production.</p></header>
<main>
<div class="stage" id="stage" aria-label="Personazhi"><svg id="svg" viewBox="0 0 1080 1440" role="img" aria-label="Character v3"></svg><span class="hint">Lëviz kursorin mbi skenë: sytë e ndjekin</span></div>
<div class="panel">
<section><h2>Performanca</h2><div class="chips"><button class="primary" id="play">Luaj performancën (8 s)</button><button id="blink">Shkel syrin</button></div>
<label class="tog"><input type="checkbox" id="follow" checked> Sytë ndjekin kursorin (smooth pursuit)</label>
<label class="tog"><input type="checkbox" id="auto" checked> Shkelje e syrit automatike</label></section>
<section><h2>Emocioni</h2><div class="chips" id="expr"></div><small>Kalim i butë 0,6 s mes shprehjeve: njësi veprimi, jo pozë koke.</small></section>
<section><h2>Gjesti dhe dora</h2><div class="sl"><span>Gjesti</span><input type="range" id="gesture" min="0" max="1" step="0.01" value="0"><output id="o-gesture">0</output></div><div class="chips" id="hands" style="margin-top:8px"></div></section>
<section><h2>Kontrollet e fytyrës</h2><div class="grid2" id="sliders"></div></section>
</div></main>
<script>
{
${lib}
const { character, HAND_POSES } = BODY;
const { EXPRESSIONS, FACE_REST } = HEAD;
const { FPS, track, expressionAt, gazeSolver, blinkAt, armAt } = PERFORM;
const svg = document.getElementById("svg");
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SL = [["browIn","Vetulla e brendshme",-1,1],["browOut","Vetulla e jashtme",-1,1],["knit","Vetullat bashkë",0,1],["lidUp","Qepalla e sipërme",-0.3,1],["squint","Qepalla e poshtme",0,1],["wide","Sy të hapur",0,1],["pupil","Bebëza",-1,1],["smile","Buzëqeshja",-1,1],["cheek","Faqet",0,1],["open","Nofulla",0,1],["round","Buzët rrumbullak",0,1],["press","Buzët shtrënguar",0,1],["wideM","Goja e gjerë",-1,1],["sneer","Përbuzja",0,1],["tilt","Koka anash",-10,10],["nod","Koka lart/poshtë",-1,1]];
const NAMES = {neutral:"Neutral",joy:"Gëzim",sadness:"Trishtim",worry:"Shqetësim",fear:"Frikë",anger:"Zemërim",surprise:"Habi",convince:"Bind",reassure:"Qetëso",thinking:"Mendim"};
let face = { ...FACE_REST }, from = null, to = null, t0 = 0;
let hand = "relaxed", handFrom = "relaxed", handT = 1;
let gesture = 0, gaze = { gx: 0.6, gy: 0, nod: 0 }, pointer = null, blinkStart = -9, playing = null, cur = "neutral";
const exprBox = document.getElementById("expr");
exprBox.innerHTML = Object.keys(EXPRESSIONS).map((k) => '<button data-e="' + k + '" aria-pressed="' + (k === cur) + '">' + NAMES[k] + "</button>").join("");
document.getElementById("hands").innerHTML = Object.keys(HAND_POSES).map((k) => '<button data-h="' + k + '" aria-pressed="' + (k === hand) + '">' + k + "</button>").join("");
document.getElementById("sliders").innerHTML = SL.map(([k, l, a, b]) => '<div class="sl"><span>' + l + '</span><input type="range" id="s-' + k + '" min="' + a + '" max="' + b + '" step="0.01" value="0"><output id="o-' + k + '">0</output></div>').join("");
const setExpr = (k) => { cur = k; from = { ...face }; to = { ...FACE_REST, ...EXPRESSIONS[k] }; t0 = performance.now(); exprBox.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.e === k))); };
exprBox.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setExpr(b.dataset.e); });
document.getElementById("hands").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; handFrom = hand; hand = b.dataset.h; handT = 0; document.querySelectorAll("#hands button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.h === hand))); if (gesture < 0.3) { gesture = 0.85; document.getElementById("gesture").value = 0.85; } });
SL.forEach(([k]) => document.getElementById("s-" + k).addEventListener("input", (e) => { from = to = null; face[k] = Number(e.target.value); }));
document.getElementById("gesture").addEventListener("input", (e) => { gesture = Number(e.target.value); });
document.getElementById("blink").addEventListener("click", () => { blinkStart = performance.now(); });
const stage = document.getElementById("stage");
stage.addEventListener("pointermove", (e) => { const r = stage.getBoundingClientRect(); pointer = [(e.clientX - r.left) / r.width * 1080, (e.clientY - r.top) / r.height * 1440]; });
stage.addEventListener("pointerleave", () => { pointer = null; });
// the scene of the performance (the same as the video)
const paper = (t) => { const u = clamp((t - 1.3) / 1.5, 0, 1); return [560 - u * 200 + Math.sin(u * 7) * 60, -760 + u * 1600]; };
const pts = { partner: () => [900, -250], paper, floor: () => [-160, 760] };
const solve = gazeSolver([[0, "partner"], [1.22, "paper"], [3.05, "floor"], [4.25, "partner"]], [22, -206]);
const blinksP = [0.85, 1.22, 3.05, 4.25, 6.9];
const exprP = [[0, "neutral"], [1.32, "surprise"], [2.7, "worry"], [4.35, "reassure"], [6.2, "convince"]];
const rest = { arm: 6, fore: 10, wrist: 0, handN: "relaxed" };
const armP = [[0, rest], [4.45, rest], [4.62, { arm: 2, fore: 4, wrist: 4, handN: "relaxed" }], [5.05, { arm: 20, fore: 104, wrist: -22, handN: "explain" }], [5.9, { arm: 22, fore: 100, wrist: -18, handN: "explain" }], [6.35, { arm: 26, fore: 90, wrist: -8, handN: "point" }], [7.2, { arm: 24, fore: 94, wrist: -10, handN: "point" }], [7.9, rest]];
document.getElementById("play").addEventListener("click", () => { playing = performance.now(); });
let nextBlink = performance.now() + 2500, blinkN = 0;
const X = 430, Y = 760, S = 1.45; // character placement in the 1080 x 1440 stage
function frame(now) {
  const t = now / 1000;
  let f, pose, paperSvg = "";
  if (playing !== null) {
    const pt = (now - playing) / 1000;
    if (pt > 8.4) { playing = null; } else {
      const g = solve(pt, pts);
      f = expressionAt(exprP, pt);
      f.gx = g.gx; f.gy = g.gy + (f.gy ?? 0) * 0.2; f.nod = (f.nod ?? 0) + g.nod; f.lidUp = Math.max(f.lidUp ?? 0, blinkAt(blinksP, pt));
      pose = { ...armAt(armP, pt), breath: 0.5 + 0.5 * Math.sin(pt * 1.6), lean: track([[0, 0], [6.1, 0], [6.5, 4], [7.6, 4], [8.2, 1]], pt), shrug: track([[0, 0], [1.3, 0], [1.45, 0.35], [2.0, 0.15], [2.8, 0.25], [4.3, 0.25], [4.8, 0]], pt), armF: 4, foreF: 14 };
      const [px, py] = paper(pt);
      if (pt > 1.25) paperSvg = '<g transform="translate(' + px + " " + py + ") rotate(" + Math.sin(pt * 5) * 28 + ')"><rect x="-60" y="-40" width="120" height="80" rx="3" fill="#F7F4EC" stroke="#C9C2B4" stroke-width="2"/><path d="M-44 -20 H40 M-44 -4 H36 M-44 12 H28" stroke="#9AA3B0" stroke-width="4"/></g>';
    }
  }
  if (!f) {
    if (from && to) { const k = ease(clamp((now - t0) / 600, 0, 1)); for (const key of Object.keys(to)) face[key] = from[key] + (to[key] - from[key]) * k; if (k >= 1) from = null; SL.forEach(([kk]) => { document.getElementById("s-" + kk).value = face[kk]; document.getElementById("o-" + kk).textContent = (+face[kk]).toFixed(2); }); }
    // gaze: toward the pointer (two frames of lag), else toward the person off screen on the right
    let tg = [1500, 300];
    if (pointer && document.getElementById("follow").checked) tg = pointer;
    const ex = X + 22 * S, ey = Y - 206 * S;
    const dx = tg[0] - ex, dy = tg[1] - ey;
    const ang = Math.atan2(dy, Math.max(80, Math.abs(dx))) * 180 / Math.PI;
    const want = { gx: clamp(dx / 420, -1, 1), nod: clamp((ang * clamp((Math.abs(ang) - 12) / 40, 0, 0.6)) / 22, -1, 1) };
    want.gy = clamp((ang - want.nod * 22) / 28, -1, 1);
    for (const k of ["gx", "gy", "nod"]) gaze[k] += (want[k] - gaze[k]) * 0.35;
    if (document.getElementById("auto").checked && now > nextBlink) { blinkStart = now; blinkN++; nextBlink = now + 2600 + ((blinkN * 997) % 1800); }
    const bl = blinkAt([blinkStart / 1000], t);
    f = { ...face, gx: gaze.gx, gy: clamp(gaze.gy + (face.gy ?? 0) * 0.3, -1, 1), nod: (face.nod ?? 0) + gaze.nod, lidUp: Math.max(face.lidUp, bl) };
    handT = Math.min(1, handT + 1 / 15);
    const g = ease(gesture);
    pose = { arm: 6 + (20 - 6) * g, fore: 10 + (104 - 10) * ease(clamp(gesture * 1.15 - 0.1, 0, 1)), wrist: -22 * ease(clamp(gesture * 1.3 - 0.25, 0, 1)), handNBlend: { from: handFrom, to: hand, k: ease(handT) }, breath: 0.5 + 0.5 * Math.sin(t * 1.6), armF: 4, foreF: 14 };
  }
  const c = character(pose, f, {}, {});
  svg.innerHTML = "<defs>" + c.defs + '</defs><rect x="700" y="120" width="300" height="460" rx="6" fill="#F3E7D2" opacity=".55"/><g transform="translate(' + X + " " + Y + ") scale(" + S + ')">' + paperSvg + c.svg + "</g>";
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
</script></body></html>`;
writeFileSync(`${dir}/out/character-v3.html`, html);
console.info(`wrote ${dir}/out/character-v3.html (${html.length} bytes)`);
