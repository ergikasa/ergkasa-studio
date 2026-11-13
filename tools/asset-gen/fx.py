"""Efektet vizuale dhe shtresat mbi ekran (lista e prodhimit, kategoria 09).

Dy lloje, sipas `capabilities.placement`:
- `screen`: shtresë mbi të gjithë kuadrin (vinjetë, kokrriza filmi, rreze drite...). Vizatohen në 1080×1920
  (9:16); kompilatori i shtrin që të mbulojnë çdo format. Në plan përdoren te `scene.effects` me ID-në si preset.
- `world`: efekt i vendosur në skenë si objekt (zjarr, tym, shkëndija, njollë boje...). Në plan janë shtresa
  `object` me ID-në e tyre.

Të gjitha ngjyrat janë nga paleta e stilit; transparenca jepet me `fill-opacity` / `stop-opacity`.
Për teksturat e imëta (kokrriza, fije letre, vija skanimi) përdoret `<pattern>`: një pllakë e vogël që përsëritet,
ndaj skedari mbetet i vogël dhe renderimi i shpejtë.

Përdorimi: python3 tools/asset-gen/fx.py
"""
from __future__ import annotations

import math
import random

from editorial import INK, LICENSE, P, STYLE, Defs, blob, circle, ellipse, g, line, path, poly, rect, star, svg_doc, write_asset

SW, SH = 1080, 1920          # kuadri vertikal, në të cilin vizatohen shtresat e ekranit
PAD = 120                    # teprica rreth kuadrit: `jitter` dhe `drift` nuk zbulojnë kurrë skajin


# ---------------------------------------------------------------- ndihmës
def grad(d: Defs, name: str, stops, x1=0, y1=0, x2=0, y2=1, units="objectBoundingBox", extra="") -> str:
    """Gradient linear me transparencë: `stops` = [(offset, ngjyra, opacity)]."""
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return d._url(name, f'<linearGradient id="{{id}}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" gradientUnits="{units}"{extra}>{s}</linearGradient>')


def radial(d: Defs, name: str, stops, cx=0.5, cy=0.5, r=0.5) -> str:
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return d._url(name, f'<radialGradient id="{{id}}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>')


def pattern(d: Defs, name: str, w: float, h: float, content: str) -> str:
    return d._url(name, f'<pattern id="{{id}}" width="{w}" height="{h}" patternUnits="userSpaceOnUse">{content}</pattern>')


def ribbon(pts, w0: float, w1: float, fill: str, extra: str = "") -> str:
    """Shirit i mbushur përgjatë një vije me pika: gjerësia ndryshon nga `w0` (fillim) te `w1` (fund) dhe
    fryhet në mes, si një rrjedhë boje e hedhur me penel."""
    left, right = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        u = i / (n - 1)
        x0, y0 = pts[max(0, i - 1)]
        x1, y1 = pts[min(n - 1, i + 1)]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        wdt = (w0 + (w1 - w0) * u) * (0.75 + 0.5 * math.sin(math.pi * u)) / 2
        left.append((x - dy / L * wdt, y + dx / L * wdt))
        right.append((x + dy / L * wdt, y - dx / L * wdt))
    return poly(left + right[::-1], fill, extra)


def bezier(p0, p1, p2, p3, n=40):
    return [((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0],
             (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1])
            for t in (i / (n - 1) for i in range(n))]


def full(fill: str, extra: str = "") -> str:
    """Drejtkëndëshi që mbulon kuadrin me tepricë."""
    return rect(-PAD, -PAD, SW + 2 * PAD, SH + 2 * PAD, fill, extra=extra)


def fx(name, body, placement, tags, description, story_use, idle=None, parts=None, anchors=None, size=(SW, SH),
       animations=("fade",), variants=None, themes=("psychology", "philosophy", "decisions")):
    return {"name": name, "body": body, "placement": placement, "tags": tags, "description": description,
            "storyUse": story_use, "idle": idle, "parts": parts or {}, "anchors": anchors or {"center": [0.5, 0.5]},
            "size": size, "animations": list(animations), "variants": variants or {}, "themes": list(themes)}


# ================================================================ shtresa mbi ekran
def vignette(d: Defs):
    body = g("vignette", full(radial(d, "vg", [(0, INK, 0), (0.52, INK, 0), (0.82, INK, 0.38), (1, INK, 0.82)], r=0.62)))
    return fx("Vinjetë", body, "screen", ["vignette", "dark-edges", "focus", "cinematic", "mood", "tension", "memory"],
              "Darkens the edges and corners of the frame, the centre stays clear.",
              "Draws the eye to the centre and adds a cinematic, intimate or tense mood. Higher intensity for dark, inner moments.")


def film_grain(d: Defs):
    rng = random.Random(901)
    tile = "".join(circle(rng.uniform(0, 160), rng.uniform(0, 160), rng.uniform(0.7, 1.7), rng.choice([INK, INK, P["white"]]),
                          f'fill-opacity="{rng.uniform(0.10, 0.26):.2f}"') for _ in range(110))
    body = g("grain", full(pattern(d, "grain", 160, 160, tile)))
    return fx("Kokrriza filmi", body, "screen", ["film-grain", "grain", "texture", "analog", "cinematic", "documentary", "retro"],
              "Fine film grain over the whole frame: tiny light and dark specks that flicker every other frame.",
              "A cinematic, analog texture; makes clean vector scenes feel filmed. Keep the intensity low.", idle="jitter")


def light_rays(d: Defs):
    src = (-140, -220)
    rays = ""
    for i, (ang, wid, a) in enumerate(((22, 70, 0.42), (31, 120, 0.3), (40, 54, 0.46), (49, 150, 0.24), (58, 80, 0.36), (68, 110, 0.22))):
        r, L = math.radians(ang), 2600
        ex, ey = src[0] + math.cos(r) * L, src[1] + math.sin(r) * L
        nx, ny = -math.sin(r) * wid, math.cos(r) * wid
        fill = grad(d, f"ray{i}", [(0, P["warm_light2"], a), (0.55, P["warm_light"], a * 0.45), (1, P["warm_light"], 0)],
                    x1=src[0], y1=src[1], x2=ex, y2=ey, units="userSpaceOnUse")
        rays += poly([(src[0], src[1]), (ex - nx, ey - ny), (ex + nx, ey + ny)], fill)
    body = (g("rays", rays, pivot=src)
            + circle(src[0] + 120, src[1] + 160, 420, radial(d, "src", [(0, P["warm_light2"], 0.55), (1, P["warm_light"], 0)])))
    return fx("Rreze drite", body, "screen", ["light-rays", "god-rays", "sunlight", "hope", "revelation", "insight", "divine", "morning"],
              "Warm sunbeams falling diagonally from the top-left corner, fading as they spread.",
              "Hope, revelation, a moment of clarity or insight, morning light. The rays sway gently.",
              idle="drift", parts={"rays": "sway: rrezet lëvizin lehtë rreth burimit"})


def fog(d: Defs):
    rng = random.Random(902)
    back = "".join(ellipse(rng.uniform(-100, SW + 100), rng.uniform(1100, 1500), rng.uniform(320, 520), rng.uniform(90, 150),
                           radial(d, f"fb{i}", [(0, P["white"], 0.5), (1, P["white"], 0)])) for i in range(7))
    front = "".join(ellipse(rng.uniform(-100, SW + 100), rng.uniform(1450, 1900), rng.uniform(380, 600), rng.uniform(110, 180),
                            radial(d, f"ff{i}", [(0, P["cream"], 0.62), (1, P["cream"], 0)])) for i in range(7))
    wash = rect(-PAD, 900, SW + 2 * PAD, SH - 900 + PAD, grad(d, "wash", [(0, P["white"], 0), (1, P["white"], 0.42)]))
    body = g("fog_back", back) + wash + g("fog_front", front)
    return fx("Mjegull", body, "screen", ["fog", "mist", "haze", "uncertainty", "confusion", "mystery", "memory", "unknown"],
              "Low white fog banks drifting across the lower half of the frame.",
              "Uncertainty and confusion, not seeing clearly, mystery, a fading memory.", idle="drift",
              parts={"fog_back": "drift", "fog_front": "drift (më shpejt)"})


def rain(d: Defs):
    rng = random.Random(903)
    streaks = "".join(line(f"M{x:.0f},{y:.0f} l{-L * 0.26:.0f},{L:.0f}", P["steel_l"], rng.uniform(1.6, 3.2),
                           f'stroke-opacity="{rng.uniform(0.28, 0.6):.2f}"')
                      for x, y, L in ((rng.uniform(-80, SW + 160), rng.uniform(-PAD, SH), rng.uniform(46, 110)) for _ in range(300)))
    splashes = "".join(ellipse(rng.uniform(0, SW), rng.uniform(1700, 1900), rng.uniform(10, 22), 3, P["steel_l"], 'fill-opacity="0.35"')
                       for _ in range(26))
    body = full(P["night2"], 'fill-opacity="0.2"') + g("streaks", streaks) + splashes
    return fx("Shi", body, "screen", ["rain", "storm", "sad", "melancholy", "lonely", "night", "weather", "gloomy"],
              "Slanted rain streaks over the whole frame with a cool, dim wash and small splashes near the bottom.",
              "Sadness, loneliness, a hard time, gloomy weather over a scene. For falling animated drops use the rain particle effect.",
              idle="jitter")


def shadow_overlay(d: Defs):
    blinds = "".join(poly([(-400, 200 + i * 150), (SW + 400, -150 + i * 150), (SW + 400, -88 + i * 150), (-400, 262 + i * 150)], INK,
                          'fill-opacity="0.22"') for i in range(16))
    frame = (poly([(560, -PAD), (612, -PAD), (512, SH + PAD), (460, SH + PAD)], INK, 'fill-opacity="0.24"'))
    soft = full(grad(d, "soft", [(0, INK, 0.0), (1, INK, 0.25)], x1=0, y1=0, x2=1, y2=1))
    body = g("blinds", blinds + frame) + soft
    return fx("Hije grilash", body, "screen", ["shadow", "blinds", "noir", "secret", "suspicion", "manipulation", "detective", "dark"],
              "Diagonal shadows of window blinds and a window frame falling across the scene, film-noir style.",
              "Secrets, suspicion, manipulation and hidden motives; an interrogation or a detective mood.")


def glass_reflection(d: Defs):
    def streak(name, x, w, a):
        fill = grad(d, name, [(0, P["white"], 0), (0.5, P["white"], a), (1, P["white"], 0)], x1=0, y1=0, x2=1, y2=0)
        return poly([(x, -PAD), (x + w, -PAD), (x + w - 900, SH + PAD), (x - 900, SH + PAD)], fill)
    body = (full(P["glass"], 'fill-opacity="0.1"')
            + g("streaks", streak("s1", 520, 260, 0.34) + streak("s2", 860, 70, 0.4) + streak("s3", 1240, 180, 0.24) + streak("s4", 1520, 46, 0.36))
            + ellipse(260, 380, 180, 60, P["white"], 'fill-opacity="0.08" transform="rotate(-24 260 380)"'))
    return fx("Reflektim xhami", body, "screen", ["glass", "reflection", "window", "barrier", "separation", "isolation", "invisible-wall"],
              "Diagonal glossy streaks and a faint cool tint, as if the scene is seen through a window.",
              "Looking through glass: separation, an invisible barrier, watching life from the outside, the glass ceiling.",
              idle="drift", parts={"streaks": "slide horizontal = reflektimi kalon"})


def light_leak(d: Defs):
    body = g("leak",
             ellipse(SW + 40, 260, 520, 640, radial(d, "l1", [(0, P["warm_light2"], 0.75), (0.45, P["orange"], 0.45), (1, P["orange"], 0)]))
             + ellipse(SW + 100, 980, 380, 560, radial(d, "l2", [(0, P["red_l"], 0.5), (1, P["red"], 0)]))
             + ellipse(SW - 60, 1720, 520, 360, radial(d, "l3", [(0, P["gold_l"], 0.45), (1, P["gold"], 0)]))
             + ellipse(-80, 120, 300, 300, radial(d, "l4", [(0, P["orange"], 0.28), (1, P["orange"], 0)])))
    return fx("Dritë e derdhur", body, "screen", ["light-leak", "warm", "nostalgia", "memory", "film", "dreamy", "retro", "summer"],
              "Warm orange, red and gold glows bleeding in from the right edge, like light leaking onto film.",
              "Nostalgia and warm memories, a dreamy or hopeful moment, a soft transition.", idle="drift",
              parts={"leak": "opacity pulse = drita merr frymë"})


def screen_glitch(d: Defs):
    rng = random.Random(904)
    scan = pattern(d, "scan", 8, 8, rect(0, 0, 8, 2, INK, extra='fill-opacity="0.14"'))
    bars = ""
    for _ in range(11):
        y, h = rng.uniform(0, SH), rng.uniform(10, 70)
        dx = rng.uniform(-60, 60)
        bars += rect(-PAD + dx, y, SW + 2 * PAD, h, rng.choice([P["red"], P["teal"], P["blue_l"]]), extra=f'fill-opacity="{rng.uniform(0.18, 0.36):.2f}"')
    blocks = "".join(rect(rng.uniform(0, SW), rng.uniform(0, SH), rng.uniform(40, 220), rng.uniform(6, 18), rng.choice([P["white"], INK]),
                          extra=f'fill-opacity="{rng.uniform(0.3, 0.6):.2f}"') for _ in range(26))
    body = full(scan) + g("bars", bars + blocks)
    return fx("Defekt ekrani", body, "screen", ["glitch", "distortion", "digital", "error", "hacked", "anxiety", "technology", "matrix"],
              "Digital screen distortion: scanlines, coloured horizontal bars shifted sideways and broken pixel blocks.",
              "Something is wrong: a digital error, hacking, information overload, anxiety, a broken reality or a reveal.",
              idle="jitter", parts={"bars": "opacity flicker"})


def paper_texture(d: Defs):
    rng = random.Random(905)
    tile = ""
    for _ in range(46):
        x, y, L, a = rng.uniform(0, 240), rng.uniform(0, 240), rng.uniform(10, 34), rng.uniform(0, 180)
        tile += line(f"M{x:.0f},{y:.0f} q{L * 0.4:.0f},{rng.uniform(-6, 6):.0f} {L * math.cos(math.radians(a)):.0f},{L * math.sin(math.radians(a)):.0f}",
                     rng.choice([P["sand3"], P["parch_d"], P["white"]]), 1.4, f'stroke-opacity="{rng.uniform(0.25, 0.5):.2f}"')
    tile += "".join(circle(rng.uniform(0, 240), rng.uniform(0, 240), rng.uniform(1, 3.5), P["parch_d"], 'fill-opacity="0.2"') for _ in range(16))
    body = (full(P["parch_l"], 'fill-opacity="0.2"') + full(pattern(d, "fibre", 240, 240, tile))
            + full(radial(d, "edge", [(0, P["parch_d"], 0), (0.7, P["parch_d"], 0), (1, P["parch_d"], 0.32)], r=0.65)))
    return fx("Teksturë letre", body, "screen", ["paper", "texture", "old", "parchment", "history", "handmade", "journal", "vintage"],
              "A warm paper texture: faint fibres, specks and slightly darker edges over the whole frame.",
              "Gives scenes a handmade, printed or historical feel: stories from the past, a diary, a philosophical text.")


def old_film(d: Defs):
    rng = random.Random(906)
    scratches = "".join(line(f"M{x:.0f},{rng.uniform(-PAD, 600):.0f} l{rng.uniform(-6, 6):.0f},{rng.uniform(600, 1900):.0f}",
                             rng.choice([P["white"], INK]), rng.uniform(1.2, 2.6), f'stroke-opacity="{rng.uniform(0.25, 0.55):.2f}"')
                        for x in (rng.uniform(0, SW) for _ in range(9)))
    dust = "".join(circle(rng.uniform(0, SW), rng.uniform(0, SH), rng.uniform(2, 6), rng.choice([P["white"], INK]), f'fill-opacity="{rng.uniform(0.3, 0.6):.2f}"')
                   for _ in range(34))
    hairs = "".join(line(f"M{x:.0f},{y:.0f} q{rng.uniform(-30, 30):.0f},{rng.uniform(-30, 30):.0f} {rng.uniform(-50, 50):.0f},{rng.uniform(20, 60):.0f}",
                         INK, 2, 'stroke-opacity="0.45"') for x, y in ((rng.uniform(0, SW), rng.uniform(0, SH)) for _ in range(4)))
    body = (full(P["wood"], 'fill-opacity="0.22"')
            + full(radial(d, "vig", [(0, P["wood_ddd"], 0), (0.6, P["wood_ddd"], 0.05), (1, P["wood_ddd"], 0.6)], r=0.62))
            + g("damage", scratches + dust + hairs))
    return fx("Film i vjetër", body, "screen", ["old-film", "vintage", "sepia", "history", "archive", "memory", "past", "documentary"],
              "Old film look: a sepia wash, darker burnt corners, vertical scratches, dust specks and hairs that jump every other frame.",
              "History and the past: archive footage, how things were, an old memory or a historical example.", idle="jitter",
              parts={"damage": "jitter"})


def speed_lines(d: Defs, variant=None):
    rng = random.Random(907)
    cx, cy = SW / 2, SH / 2
    if variant == "horizontal":
        lines = "".join(rect(rng.uniform(-300, SW), y, rng.uniform(180, 620), rng.uniform(3, 9), P["white"], rx=4,
                             extra=f'fill-opacity="{rng.uniform(0.35, 0.8):.2f}"') for y in (rng.uniform(0, SH) for _ in range(70)))
        return fx("Vija shpejtësie (horizontale)", g("lines", lines), "screen", [], "", "")
    wedges = ""
    for _ in range(84):
        a = rng.uniform(0, math.tau)
        w = rng.uniform(0.004, 0.016)
        # largësia deri te skaji i kuadrit në këtë drejtim: vijat nisin te ~60% e saj, kudo njësoj
        edge = min(abs(cx / math.cos(a)) if math.cos(a) else 1e9, abs(cy / math.sin(a)) if math.sin(a) else 1e9)
        r0, r1 = edge * rng.uniform(0.55, 0.75), edge * 1.9
        p0 = (cx + math.cos(a) * r0, cy + math.sin(a) * r0)
        wedges += poly([p0, (cx + math.cos(a - w) * r1, cy + math.sin(a - w) * r1), (cx + math.cos(a + w) * r1, cy + math.sin(a + w) * r1)],
                       P["white"], f'fill-opacity="{rng.uniform(0.45, 0.9):.2f}"')
    return fx("Vija shpejtësie", g("lines", wedges), "screen",
              ["speed-lines", "motion", "focus", "impact", "shock", "realization", "fast", "urgency", "manga"],
              "Radial speed lines rushing in from the edges towards the centre (variant `horizontal`: horizontal motion streaks).",
              "A sudden realisation or shock, urgency and speed, all focus on one thing. The horizontal variant suggests fast movement.",
              idle="jitter", variants={"horizontal": "horizontal.svg"})


# ================================================================ efekte në skenë (world)
def smoke(d: Defs):
    rng = random.Random(908)
    w, h = 520, 860
    soft = radial(d, "puff", [(0, P["steel_l"], 1), (0.55, P["steel"], 0.85), (1, P["steel"], 0)])
    dark = radial(d, "puffd", [(0, P["steel_dd"], 0.95), (0.55, P["steel_d"], 0.8), (1, P["steel_d"], 0)])
    puffs = ""
    for i in range(30):
        u = i / 29
        cx = 260 + math.sin(u * 4.2) * 70 * u + rng.uniform(-22, 22) * (0.4 + u)
        cy = h - 50 - u * (h - 210) + rng.uniform(-14, 14)
        r = 48 + u * 130 + rng.uniform(-10, 10)
        fill = dark if u < 0.3 and i % 2 == 0 else soft
        puffs += ellipse(cx, cy, r, r * rng.uniform(0.82, 1.0), fill, f'fill-opacity="{1.0 - u * 0.5:.2f}"')
    return fx("Tym", g("smoke", puffs, pivot=(230, h)), "world",
              ["smoke", "fire", "burnout", "destruction", "loss", "mystery", "aftermath", "pollution"],
              "A grey plume of smoke rising and widening, fading towards the top.",
              "Aftermath and loss, burnout, something destroyed or a plan going up in smoke; also mystery.",
              idle="float", size=(w, h), anchors={"ground": [0.5, 1.0]}, animations=("fade", "pop_in", "grow"),
              parts={"smoke": "float / drift"}, themes=("psychology", "decisions", "money"))


def fire(d: Defs):
    w, h = 380, 520
    cx = 190

    def flame(scale, fill, dy=0):
        s = scale
        return path(f"M{cx},{h - 40 - 420 * s + dy} Q{cx + 40 * s},{h - 40 - 300 * s + dy} {cx + 120 * s},{h - 40 - 210 * s + dy} "
                    f"Q{cx + 170 * s},{h - 40 - 120 * s + dy} {cx + 130 * s},{h - 40 + dy} Q{cx},{h - 10 + dy} {cx - 130 * s},{h - 40 + dy} "
                    f"Q{cx - 170 * s},{h - 40 - 140 * s + dy} {cx - 90 * s},{h - 40 - 260 * s + dy} Q{cx - 60 * s},{h - 40 - 180 * s + dy} "
                    f"{cx - 30 * s},{h - 40 - 240 * s + dy} Q{cx - 30 * s},{h - 40 - 340 * s + dy} {cx},{h - 40 - 420 * s + dy} Z", fill)
    body = (ellipse(cx, h - 160, 200, 220, radial(d, "glow", [(0, P["orange"], 0.5), (1, P["orange"], 0)]))
            + g("flame_outer", flame(1.0, grad(d, "fo", [(0, P["red_l"], 1), (1, P["red"], 1)])), pivot=(cx, h - 40))
            + g("flame_mid", flame(0.72, grad(d, "fm", [(0, P["gold"], 1), (1, P["orange"], 1)]), 6), pivot=(cx, h - 40))
            + g("flame_core", flame(0.44, grad(d, "fc", [(0, P["warm_light2"], 1), (1, P["gold_l"], 1)]), 10), pivot=(cx, h - 40))
            + "".join(rect(cx + dx, h - 46 + abs(dx) * 0.04, 150, 22, P["wood_dd"], rx=11, extra=f'transform="rotate({r} {cx + dx + 75} {h - 35})"')
                      for dx, r in ((-150, 14), (-10, -14)))
            + circle(cx - 60, 160, 6, P["gold_l"]) + circle(cx + 70, 120, 5, P["orange"]) + circle(cx + 20, 60, 4, P["gold_l"]))
    return fx("Zjarr", body, "world", ["fire", "flame", "passion", "anger", "danger", "destruction", "energy", "urgency", "burn"],
              "A campfire-style flame in three layers (red, orange, warm yellow) over two logs, with a soft glow.",
              "Passion and anger, danger and destruction, burning motivation or burnout, an urgent crisis.",
              idle="pulse", size=(w, h), anchors={"ground": [0.5, 1.0]}, animations=("fade", "pop_in", "grow"),
              parts={"flame_outer": "scaleY flicker", "flame_mid": "scaleY flicker", "flame_core": "scaleY flicker"})


def sparks(d: Defs):
    rng = random.Random(909)
    w = h = 560
    c = 280
    streaks = ""
    for i in range(22):
        a = math.tau * i / 22 + rng.uniform(-0.08, 0.08)
        r0, r1 = rng.uniform(60, 90), rng.uniform(170, 270)
        streaks += line(f"M{c + math.cos(a) * r0:.0f},{c + math.sin(a) * r0:.0f} L{c + math.cos(a) * r1:.0f},{c + math.sin(a) * r1:.0f}",
                        rng.choice([P["gold_l"], P["warm_light2"], P["orange"]]), rng.uniform(4, 9))
        streaks += circle(c + math.cos(a) * (r1 + 14), c + math.sin(a) * (r1 + 14), rng.uniform(4, 8), P["gold_l"])
    body = (circle(c, c, 200, radial(d, "glow", [(0, P["warm_light2"], 0.9), (0.4, P["gold_l"], 0.45), (1, P["gold"], 0)]))
            + g("burst", streaks, pivot=(c, c)) + star(c, c, 46, 18, 4, P["white"]))
    return fx("Shkëndija", body, "world", ["sparks", "spark", "idea", "impact", "breakthrough", "energy", "conflict", "flash", "insight"],
              "A bright burst of sparks: golden streaks and dots radiating from a white star at the centre.",
              "The spark of an idea, a breakthrough, the impact of a decision, a clash between two people.",
              size=(w, h), animations=("pop_in", "fade", "grow"), parts={"burst": "scale 0 → 1 = shpërthimi"})


def ink_spread(d: Defs):
    rng = random.Random(910)
    w = h = 900
    c = 450
    body = blob(c, c, 270, 26, rng, 0.16, INK)
    # spërkatje: pika që hollohen jashtë qendrës, të gjitha në një drejtim të përbashkët me ndryshime të vogla
    for _ in range(14):
        a = rng.uniform(0, math.tau)
        r0, r1 = rng.uniform(220, 250), rng.uniform(300, 420)
        wd = rng.uniform(14, 34)
        body += ribbon([(c + math.cos(a) * (r0 + (r1 - r0) * t), c + math.sin(a) * (r0 + (r1 - r0) * t)) for t in (i / 9 for i in range(10))],
                       wd, 2, INK)
    body += "".join(ellipse(c + math.cos(a) * r, c + math.sin(a) * r, rr, rr * 0.8, INK, f'transform="rotate({math.degrees(a):.0f} {c + math.cos(a) * r:.0f} {c + math.sin(a) * r:.0f})"')
                    for a, r, rr in ((rng.uniform(0, math.tau), rng.uniform(330, 440), rng.uniform(3, 11)) for _ in range(30)))
    body += blob(c - 50, c - 60, 140, 12, rng, 0.2, P["night2"], 'fill-opacity="0.35"')
    return fx("Njollë boje", g("ink", body, pivot=(c, c)), "world",
              ["ink", "splash", "stain", "mistake", "chaos", "emotion", "transition", "rorschach", "art"],
              "A black ink splash with drips and droplets around it.",
              "A mistake that leaves a mark, an emotional outburst, chaos; scaled up from 0 it works as an ink transition.",
              size=(w, h), animations=("grow", "pop_in", "fade"), parts={"ink": "scale 0 → 1 = boja përhapet"})


def liquid_ink(d: Defs):
    w, h = 900, 1200
    body = (ribbon(bezier((140, 1160), (60, 860), (430, 820), (380, 600)) + bezier((380, 600), (330, 380), (80, 420), (150, 230))[1:]
                   + bezier((150, 230), (200, 80), (420, 40), (530, 130))[1:], 70, 6, INK)
            + ribbon(bezier((320, 1180), (360, 900), (650, 920), (600, 700)) + bezier((600, 700), (560, 480), (360, 520), (430, 320))[1:]
                     + bezier((430, 320), (480, 170), (690, 150), (770, 250))[1:], 52, 4, P["night2"])
            + ribbon(bezier((580, 1190), (660, 980), (840, 980), (790, 780)) + bezier((790, 780), (750, 610), (570, 630), (610, 470))[1:], 40, 3, P["blue_dd"])
            + ribbon(bezier((210, 990), (270, 870), (380, 890), (340, 760)), 22, 2, INK)
            + "".join(ellipse(x, y, r, r * 1.25, INK) for x, y, r in ((560, 104, 14), (592, 70, 8), (794, 270, 10), (626, 440, 9), (350, 730, 6)))
            + ribbon(bezier((168, 260), (220, 120), (380, 80), (470, 130)), 10, 2, P["slate_l"], 'fill-opacity="0.45"'))
    return fx("Bojë e lëngshme", g("ink", body, pivot=(450, 1200)), "world",
              ["ink", "liquid", "flow", "thoughts", "emotion", "change", "creativity", "subconscious", "fluid"],
              "Flowing ribbons of dark ink curling upwards, with a few round droplets.",
              "Thoughts and feelings flowing, the subconscious, creativity, change that cannot be held still.",
              idle="sway", size=(w, h), anchors={"bottom": [0.5, 1.0]}, animations=("fade", "pop_in", "grow"),
              parts={"ink": "sway"})


def glow_outline(d: Defs):
    w = h = 620
    c = 310
    body = (circle(c, c, 290, radial(d, "halo", [(0, P["gold_l"], 0), (0.72, P["gold_l"], 0), (0.86, P["gold_l"], 0.55), (1, P["gold"], 0)]))
            + f'<circle cx="{c}" cy="{c}" r="248" fill="none" stroke="{P["warm_light2"]}" stroke-width="10"/>'
            + f'<circle cx="{c}" cy="{c}" r="248" fill="none" stroke="{P["gold_l"]}" stroke-width="24" stroke-opacity="0.4"/>')
    return fx("Konturë që ndriçon", g("ring", body, pivot=(c, c)), "world",
              ["glow", "highlight", "outline", "focus", "attention", "important", "chosen", "spotlight"],
              "A glowing golden ring with a soft halo, empty in the middle.",
              "Highlights what matters: put it around an object or a person to say 'look here', 'this one', 'the key'.",
              idle="pulse", size=(w, h), animations=("pop_in", "fade", "grow"), parts={"ring": "pulse"})


EFFECTS = [
    ("fx_vignette_01", vignette), ("fx_film_grain_01", film_grain), ("fx_light_rays_01", light_rays), ("fx_fog_01", fog),
    ("fx_rain_01", rain), ("fx_shadow_overlay_01", shadow_overlay), ("fx_glass_reflection_01", glass_reflection),
    ("fx_light_leak_01", light_leak), ("fx_screen_glitch_01", screen_glitch), ("fx_paper_texture_01", paper_texture),
    ("fx_old_film_01", old_film), ("fx_speed_lines_01", speed_lines),
    ("fx_smoke_01", smoke), ("fx_fire_01", fire), ("fx_sparks_01", sparks), ("fx_ink_spread_01", ink_spread),
    ("fx_liquid_ink_01", liquid_ink), ("fx_glow_outline_01", glow_outline),
]


def main() -> None:
    for asset_id, fn in EFFECTS:
        d = Defs(asset_id)
        e = fn(d)
        w, h = e["size"]
        files = {"asset.svg": svg_doc(asset_id, w, h, d.xml(), e["body"])}
        for key, fname in e["variants"].items():
            dv = Defs(f"{asset_id}_{key}")
            files[fname] = svg_doc(asset_id, w, h, dv.xml(), fn(dv, key)["body"])
        screen = e["placement"] == "screen"
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": e["name"], "description": e["description"],
            "category": "effect", "subcategory": "overlay" if screen else "local", "collection": "effects", "storyUse": e["storyUse"],
            "kind": "overlay", "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"},
            **({"variants": e["variants"]} if e["variants"] else {}),
            "viewBox": [0, 0, w, h],
            "capabilities": {
                "placement": e["placement"],
                "animations": e["animations"],
                **({"idle": e["idle"]} if e["idle"] else {}),
                **({"cover": "shtrihet që të mbulojë kuadrin; opaciteti = intensiteti"} if screen else
                   {"scale": "1 = shkalla e personazhit standard (0.92)"}),
            },
            "anchors": e["anchors"], "parts": e["parts"], "themes": e["themes"], "tags": e["tags"], "license": LICENSE,
        }
        write_asset("effects", meta, files)
    print(f"{len(EFFECTS)} efekte")


if __name__ == "__main__":
    main()
