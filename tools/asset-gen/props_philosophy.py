"""Filozofia dhe mendimi kritik: objektet (lista e prodhimit, kategoria 05).

Bustet janë "në stilin e" filozofëve klasikë: figura mermeri të përgjithshme, jo portrete.

Përdorimi: python3 tools/asset-gen/props_philosophy.py
"""
from __future__ import annotations

import math
import random

from editorial import (INK, P, Defs, circle, contact_shadow, ellipse, g, lathe, line, obj, path, poly, rect, run, sheen,
                       smooth_lathe, star)
from props_power import column

PHILO = ["philosophy", "growth", "decisions"]


def plinth(d, cx, top, w, h, name):
    return (rect(cx - w / 2 - 14, top, w + 28, 26, P["marble_l"]) + rect(cx - w / 2, top + 26, w, h - 52, d.h(name, P["marble_l"], P["marble_d"], P["marble"]))
            + rect(cx - w / 2 - 20, top + h - 26, w + 40, 26, P["marble_d"]))


def curls(cx, cy, n, r, spread, rng, fill, shade):
    """Kaçurrela skulpture: rreth me spirale të gdhendur."""
    out = ""
    for _ in range(n):
        x, y = cx + rng.uniform(-spread[0], spread[0]), cy + rng.uniform(-spread[1], spread[1])
        out += (circle(x, y + 2, r, shade) + circle(x, y, r, fill)
                + f'<path d="M{x - r * 0.55:.1f},{y:.1f} A{r * 0.55:.1f},{r * 0.55:.1f} 0 1 1 {x:.1f},{y + r * 0.55:.1f} A{r * 0.3:.1f},{r * 0.3:.1f} 0 1 1 {x + r * 0.05:.1f},{y - r * 0.05:.1f}" '
                  f'fill="none" stroke="{shade}" stroke-width="{max(2.0, r * 0.18):.1f}" stroke-linecap="round"/>')
    return out


def bust(d: Defs, style: str):
    w, h = 420, 640
    cx = 210
    rng = random.Random({"socratic": 1, "platonic": 2, "aristotelian": 3}[style])
    m_l, m, m_d, m_dd = P["marble_l"], P["marble"], P["marble_d"], P["marble_dd"]
    edge = f'stroke="{m_dd}" stroke-width="3"' 
    face = d.d("face", m_l, m_d)
    chest = (path(f"M60,470 Q70,350 150,330 L270,330 Q350,350 360,470 Z", d.d("ch", m_l, m_d), edge)
             + path("M150,332 Q110,380 100,470 L160,470 Q150,400 210,350 Z", m_d, 'opacity="0.55"')        # palosje e togës
             + line("M240,340 Q290,380 300,470 M260,336 Q320,370 334,470", m_dd, 5, 'opacity="0.5"'))
    neck = rect(180, 270, 60, 80, d.h("nk", m_l, m_d))
    head = ellipse(cx, 190, 92, 116, face, edge)
    features = (path(f"M{cx-46},170 Q{cx-30},160 {cx-14},170 M{cx+14},170 Q{cx+30},160 {cx+46},170", "none", f'stroke="{m_dd}" stroke-width="5" stroke-linecap="round"')
                + ellipse(cx - 30, 182, 12, 6, m_d) + ellipse(cx + 30, 182, 12, 6, m_d)
                + path(f"M{cx},178 L{cx-14},{230 if style != 'socratic' else 222} Q{cx},{238 if style != 'socratic' else 232} {cx+12},{228}", m_d))
    if style == "socratic":
        hair = (curls(cx - 84, 176, 10, 15, (12, 40), rng, m_d, m_dd) + curls(cx + 84, 176, 10, 15, (12, 40), rng, m_d, m_dd))
        beard = path(f"M{cx-88},200 Q{cx-92},304 {cx},336 Q{cx+92},304 {cx+88},200 Q{cx+60},250 {cx},250 Q{cx-60},250 {cx-88},200 Z", m_d, edge) + curls(cx, 290, 30, 13, (66, 32), rng, m, m_dd)
        brow = path(f"M{cx-60},120 Q{cx},96 {cx+60},120", "none", f'stroke="{m_d}" stroke-width="4" opacity="0.6"')
        name, ext = "Bust filozofi (stil Sokrati)", "A bald marble philosopher bust with curls at the sides, a broad face and a thick curly beard."
    elif style == "platonic":
        hair = (path(f"M{cx-98},176 Q{cx-102},70 {cx},64 Q{cx+102},70 {cx+98},176 Q{cx+70},110 {cx},110 Q{cx-70},110 {cx-98},176 Z", m_d, edge) + curls(cx, 92, 24, 14, (82, 22), rng, m, m_dd)
                + rect(cx - 94, 116, 188, 12, m_dd, rx=6))
        beard = path(f"M{cx-82},208 Q{cx-82},332 {cx-30},358 L{cx+30},358 Q{cx+82},332 {cx+82},208 Q{cx+50},250 {cx},250 Q{cx-50},250 {cx-82},208 Z", m_d, edge) + "".join(
            line(f"M{cx - 62 + k * 15},{250 + abs(k - 4) * 4} Q{cx - 66 + k * 15},{300} {cx - 52 + k * 13},{352}", m_dd, 5) for k in range(9))
        brow = ""
        name, ext = "Bust filozofi (stil Platoni)", "A marble philosopher bust with thick wavy hair held by a band and a long, full square beard."
    else:
        hair = path(f"M{cx-96},164 Q{cx-98},74 {cx},70 Q{cx+98},74 {cx+96},164 Q{cx+66},116 {cx},118 Q{cx-66},116 {cx-96},164 Z", m_d, edge) + "".join(
            line(f"M{cx - 80 + k * 20},{92 + abs(k - 4) * 6} Q{cx - 74 + k * 20},{110} {cx - 70 + k * 20},{130}", m_dd, 5) for k in range(9))
        beard = path(f"M{cx-84},210 Q{cx-78},294 {cx},304 Q{cx+78},294 {cx+84},210 Q{cx+50},246 {cx},246 Q{cx-50},246 {cx-84},210 Z", m_d, edge) + curls(cx, 274, 16, 10, (56, 16), rng, m, m_dd)
        brow = ""
        name, ext = "Bust filozofi (stil Aristoteli)", "A marble philosopher bust with short combed hair and a short trimmed beard."
    mouth = line(f"M{cx-18},258 Q{cx},262 {cx+18},258", m_dd, 4)
    body = (contact_shadow(d, cx, h, 160, 12)
            + g("plinth", plinth(d, cx, 470, 220, 170, "pl"))
            + g("bust", chest + neck + head + hair + brow + features + beard + mouth
                + sheen(f"M{cx-70},130 Q{cx-60},90 {cx-24},80 Q{cx-50},120 {cx-56},200 Z", 0.45), (cx, 470)))
    return obj(name, (w, h), body, {"ground": [0.5, 1.0], "head": [0.5, 190 / h]},
               ["philosopher", "bust", "statue", "ancient-greece", "wisdom", "classical", "philosophy", "stoic", "marble", style],
               {"bust": "statik; pop_in/fade", "plinth": "statik"},
               ext + " A generic classical figure, not a portrait.",
               "Ancient wisdom: quoting a classical philosopher, Socratic questioning, ethics, Stoicism, the history of ideas.",
               themes=["philosophy", "growth", "decisions"])


def bust_socratic(d):
    return bust(d, "socratic")


def bust_platonic(d):
    return bust(d, "platonic")


def bust_aristotelian(d):
    return bust(d, "aristotelian")


def greek_column(d: Defs):
    w, h = 300, 1100
    cx = 150
    ionic = (path(f"M{cx-110},150 Q{cx-140},150 {cx-140},120 Q{cx-140},90 {cx-110},90 H{cx+110} Q{cx+140},90 {cx+140},120 Q{cx+140},150 {cx+110},150 Z", d.v("cap", P["marble_l"], P["marble_d"]))
             + f'<circle cx="{cx-108}" cy="120" r="20" fill="none" stroke="{P["marble_dd"]}" stroke-width="5"/>'
             + f'<circle cx="{cx+108}" cy="120" r="20" fill="none" stroke="{P["marble_dd"]}" stroke-width="5"/>'
             + rect(cx - 130, 60, 260, 30, P["marble_l"]))
    body = (contact_shadow(d, cx, h, 140, 12)
            + g("column", column(d, cx, 150, h, 150, "col") + ionic))
    return obj("Kolonë greke", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, 60 / h]},
               ["column", "greek", "ancient", "classical", "philosophy", "pillar", "foundation", "principles", "history"],
               {"column": "statike"},
               "A single white marble Greek column with an Ionic capital and fluted shaft.",
               "Pillars of thought: foundational principles, ancient Greece, the classical roots of philosophy and democracy.",
               themes=["philosophy", "decisions", "growth"])


def toga_figure(d, cx, top, m, m_d, broken=False):
    """Figurë në togë, në këmbë, me peshën mbi një këmbë."""
    head = "" if broken else ellipse(cx, top + 60, 46, 58, d.d("hd", P["marble_l"], m_d)) + path(f"M{cx-46},{top+50} Q{cx-44},{top} {cx},{top} Q{cx+44},{top} {cx+46},{top+50} Q{cx+20},{top+28} {cx},{top+28} Q{cx-20},{top+28} {cx-46},{top+50} Z", m)
    neck = "" if broken else rect(cx - 18, top + 108, 36, 30, m)
    torso = path(f"M{cx-90},{top+150} Q{cx},{top+120} {cx+90},{top+150} L{cx+100},{top+420} Q{cx},{top+440} {cx-100},{top+420} Z", d.d("ts", P["marble_l"], m_d))
    drape = (path(f"M{cx-90},{top+150} Q{cx-20},{top+260} {cx+100},{top+250} L{cx+100},{top+300} Q{cx-10},{top+320} {cx-100},{top+200} Z", m)
             + "".join(line(f"M{cx - 60 + k * 30},{top + 300 + k * 6} Q{cx - 50 + k * 32},{top + 560} {cx - 70 + k * 36},{top + 800}", m_d, 5, 'opacity="0.55"') for k in range(5)))
    skirt = path(f"M{cx-100},{top+420} Q{cx},{top+440} {cx+100},{top+420} L{cx+120},{top+820} Q{cx},{top+840} {cx-110},{top+820} Z", d.v("sk", P["marble_l"], m_d))
    arms = "" if broken else (path(f"M{cx-90},{top+160} Q{cx-130},{top+300} {cx-110},{top+420} L{cx-80},{top+420} Q{cx-90},{top+300} {cx-60},{top+200} Z", m)
                              + path(f"M{cx+90},{top+160} Q{cx+140},{top+260} {cx+120},{top+340} L{cx+50},{top+330} L{cx+60},{top+300} L{cx+90},{top+300} Q{cx+100},{top+250} {cx+60},{top+200} Z", m)
                              + rect(cx + 20, top + 300, 40, 70, P["marble_d"], rx=10))
    stumps = "" if not broken else (path(f"M{cx-90},{top+150} Q{cx-118},{top+190} {cx-110},{top+230} L{cx-80},{top+222} Z", m)
                                    + path(f"M{cx+90},{top+150} Q{cx+118},{top+190} {cx+110},{top+230} L{cx+80},{top+222} Z", m)
                                    + poly([(cx - 30, top + 130), (cx - 10, top + 112), (cx + 14, top + 126), (cx + 30, top + 110), (cx + 34, top + 136)], m_d))
    feet = rect(cx - 90, top + 820, 70, 30, m, rx=10) + rect(cx + 20, top + 820, 80, 30, m, rx=10)
    return skirt + torso + drape + arms + stumps + neck + head + feet


def marble_statue(d: Defs):
    w, h = 440, 1240
    cx = 220
    body = (contact_shadow(d, cx, h, 200, 14)
            + g("plinth", plinth(d, cx, h - 230, 300, 230, "pl"))
            + g("statue", toga_figure(d, cx, 140, P["marble"], P["marble_d"]) + sheen(f"M{cx-70},300 Q{cx-80},500 {cx-60},900 L{cx-40},900 Q{cx-56},500 {cx-50},300 Z", 0.4), (cx, h - 230)))
    return obj("Statujë mermeri (antike)", (w, h), body, {"ground": [0.5, 1.0], "plinth_top": [0.5, (h - 230) / h]},
               ["statue", "marble", "ancient", "classical", "greek", "roman", "history", "ideal", "legacy", "stoic"],
               {"statue": "statike; fade", "plinth": "statik"},
               "A white marble classical statue of a figure in a draped toga holding a scroll, on a tall plinth.",
               "Ancient ideals and legacy: Greek and Roman history, how great figures are remembered, Stoic calm.",
               themes=["philosophy", "decisions", "science"])


def broken_statue(d: Defs):
    w, h = 640, 1100
    cx = 260
    head = (f'<g transform="rotate(-70 520 1010)">' + ellipse(520, 1010, 46, 58, d.d("hd", P["marble_l"], P["marble_d"]))
            + path("M474,1000 Q476,950 520,950 Q564,950 566,1000 Q540,978 520,978 Q500,978 474,1000 Z", P["marble"])
            + ellipse(504, 1012, 8, 4, P["marble_dd"]) + ellipse(536, 1012, 8, 4, P["marble_dd"]) + "</g>")
    body = (contact_shadow(d, 320, h, 300, 16)
            + g("plinth", plinth(d, cx, h - 210, 300, 210, "pl") + poly([(cx + 80, h - 210), (cx + 164, h - 210), (cx + 164, h - 150)], P["marble_dd"]))
            + g("statue", f'<g transform="translate(0 -40)">' + toga_figure(d, cx, 130, P["marble"], P["marble_d"], broken=True) + "</g>"
                + line(f"M{cx-40},400 L{cx+10},520 L{cx-10},620", P["marble_dd"], 4))
            + g("debris", head + "".join(poly([(x, h - 6), (x + 20, h - 30), (x + 40, h - 4)], P["marble_d"]) for x in (420, 600, 40))))
    return obj("Statujë e thyer", (w, h), body, {"ground": [0.5, 1.0]},
               ["statue", "broken", "fallen", "ruin", "fall-of-empire", "ego", "legacy", "impermanence", "history", "ozymandias"],
               {"statue": "statike", "debris": "koka dhe copat në tokë"},
               "A headless, armless marble statue on a cracked plinth, with its head lying on the ground.",
               "The fall of greatness: empires collapsing, fragile legacies, impermanence, a reputation that breaks.",
               themes=["philosophy", "decisions", "science"])


def ancient_book(d: Defs):
    w, h = 460, 300
    body = (contact_shadow(d, 230, h, 210, 12)
            + g("book", poly([(40, 140), (380, 120), (430, 190), (90, 214)], d.v("pg", P["parch_l"], P["parch_d"]))
                + "".join(line(f"M{86 + 4 * k},{204 - 4 * k} L{424 - 4 * k},{180 - 4 * k}", P["parch_d"], 2) for k in range(8))
                + poly([(30, 100), (380, 76), (380, 120), (40, 140)], d.v("cv", P["red_d"], INK)) + poly([(30, 100), (40, 140), (90, 214), (80, 174)], P["red_d"])
                + poly([(80, 174), (430, 150), (430, 190), (90, 214)], d.v("cv2", P["red"], P["red_d"]))
                + poly([(150, 92), (300, 82), (306, 110), (156, 120)], P["gold"], 'opacity="0.8"')
                + "".join(poly([(x, 80 + (380 - x) * 0.07), (x + 26, 78 + (380 - x) * 0.07), (x + 30, 196 - (x - 90) * 0.07), (x + 4, 198 - (x - 90) * 0.07)], P["gold_d"]) for x in (110, 320))
                + star(230, 100, 14, 6, 4, P["gold_l"])))
    return obj("Libër i lashtë biblioteke", (w, h), body, {"ground": [0.5, 1.0]},
               ["book", "ancient", "knowledge", "wisdom", "library", "history", "secret", "manuscript", "tradition"],
               {"book": "pop_in, float"},
               "A thick antique leather book with gold clasps and a gold emblem, lying closed. No text.",
               "Old knowledge: ancient wisdom, forgotten books, traditions, the library of human thought.", themes=PHILO)


def open_book(d: Defs):
    w, h = 520, 340
    pages = "".join(line(f"M{70 if s < 0 else 280},{110 + i * 26} Q{170 if s < 0 else 370},{100 + i * 26} {240 if s < 0 else 450},{110 + i * 26}", P["cream3"], 5)
                    for s in (-1, 1) for i in range(6))
    body = (contact_shadow(d, 260, h, 240, 14)
            + g("book", path("M20,300 Q140,270 260,300 Q380,270 500,300 L500,310 Q380,284 260,316 Q140,284 20,310 Z", d.v("cv", P["blue_d"], P["blue_dd"]))
                + path("M40,290 Q150,250 260,290 V70 Q150,30 40,70 Z", d.h("lp", P["white"], P["cream2"]))
                + path("M480,290 Q370,250 260,290 V70 Q370,30 480,70 Z", d.h("rp", P["cream2"], P["white"]))
                + line("M260,70 V292", P["cream3"], 4) + pages)
            + g("glow", ellipse(260, 160, 200, 120, d.glow("gl", P["warm_light"], 0.35, 0.0))))
    return obj("Libër i hapur", (w, h), body, {"ground": [0.5, 1.0], "pages": [0.5, 0.45]},
               ["book", "open-book", "reading", "learning", "knowledge", "study", "education", "wisdom", "story"],
               {"book": "statik", "glow": "pulse/fade = zbulim"},
               "An open book with blank pages showing lines of text as soft grey strokes, a faint glow above.",
               "Learning and reading: knowledge, education, opening a new chapter, finding an answer in a book.", themes=PHILO)


def scroll(d: Defs):
    w, h = 520, 340
    body = (contact_shadow(d, 260, h, 220, 12)
            + g("scroll", rect(80, 60, 360, 220, d.v("pp", P["parch_l"], P["parch"]))
                + "".join(rect(120, 100 + i * 28, 280 * (0.6 if i % 3 == 2 else 1), 8, P["parch_d"], rx=4) for i in range(6))
                + rect(40, 40, 60, 260, d.h("r1", P["parch"], P["parch_d"]), rx=30) + rect(420, 40, 60, 260, d.h("r2", P["parch"], P["parch_d"]), rx=30)
                + "".join(rect(x, y, 40, 24, d.v(f"k{x}{y}", P["wood"], P["wood_dd"]), rx=10) for x in (50, 430) for y in (20, 296))))
    return obj("Rrotull e lashtë", (w, h), body, {"center": [0.5, 0.5]},
               ["scroll", "ancient", "manuscript", "law", "wisdom", "history", "decree", "philosophy", "knowledge"],
               {"scroll": "pop_in, slide"},
               "An open parchment scroll on two wooden rods, lines of text shown as soft brown strokes.",
               "Ancient texts and laws: philosophical writings, decrees, history recorded by hand.", themes=PHILO)


def quill(d: Defs):
    w, h = 240, 560
    barbs = "".join(line(f"M{120 + (k - 14) * 0.3:.0f},{40 + k * 20} Q{70 - (k % 3) * 6},{40 + k * 20 - 30} {50 + abs(k - 10) * 3},{20 + k * 20}", P["white"], 6, 'opacity="0.9"')
                    + line(f"M{120},{40 + k * 20} Q{170 + (k % 3) * 6},{40 + k * 20 - 30} {190 - abs(k - 10) * 3},{20 + k * 20}", P["cream2"], 6, 'opacity="0.9"') for k in range(18))
    body = g("quill", f'<g transform="rotate(18 120 280)">'
             + path("M120,20 Q20,140 60,380 Q90,420 120,440 Q150,420 180,380 Q220,140 120,20 Z", d.h("fv", P["white"], P["marble_d"]))
             + barbs + line("M120,20 Q118,300 120,520", P["marble_dd"], 5)
             + path("M112,440 L128,440 L124,540 L120,556 L116,540 Z", d.h("nib", P["slate"], INK)) + "</g>", (120, 540))
    return obj("Pendë shkrimi", (w, h), body, {"center": [0.5, 0.5], "tip": [0.62, 0.98]},
               ["quill", "writing", "author", "history", "philosophy", "ideas", "ink", "manuscript", "journal"],
               {"quill": "sway/rotation = shkruan"},
               "A white feather quill pen with a dark nib.",
               "Writing ideas down: philosophers and authors, history being written, journaling your thoughts.", themes=PHILO)


def ink_bottle(d: Defs):
    w, h = 220, 260
    cx = 110
    body = (contact_shadow(d, cx, h, 90, 8)
            + g("bottle", smooth_lathe(d, "gl", cx, [(70, 24), (100, 28), (130, 62), (200, 66), (250, 62)], P["night3"], INK, P["night2"])
                + rect(cx - 36, 40, 72, 34, d.h("nk", P["night2"], INK), rx=6) + rect(cx - 42, 26, 84, 18, P["gold_d"], rx=6)
                + ellipse(cx, 160, 46, 16, P["night"], 'opacity="0.6"') + sheen(f"M{cx-48},150 Q{cx-44},124 {cx-28},114 Q{cx-38},150 {cx-36},226 Z", 0.4)))
    return obj("Shishe boje", (w, h), body, {"ground": [0.5, 1.0], "mouth": [0.5, 26 / h]},
               ["ink", "ink-bottle", "writing", "author", "history", "philosophy", "classic", "desk"],
               {"bottle": "statike"},
               "A dark glass ink bottle with a gold-rimmed neck.",
               "The writer's desk: putting ideas on paper, old letters and treaties, the craft of thinking in writing.", themes=PHILO)


def candle_holder(d: Defs):
    w, h = 220, 520
    cx = 110
    body = (contact_shadow(d, cx, h, 90, 8)
            + g("glow", circle(cx, 70, 90, d.glow("gl", P["warm_light"], 0.65, 0.0)), (cx, 70))
            + g("holder", smooth_lathe(d, "br", cx, [(220, 70), (234, 22), (300, 14), (380, 20), (440, 50), (480, 80), (508, 90)], P["brass_l"], P["brass_d"], P["brass"])
                + ellipse(cx, 220, 72, 14, P["brass_d"]) + ellipse(cx, 214, 68, 12, P["brass_l"]))
            + g("candle", rect(cx - 26, 110, 52, 110, d.h("cd", P["cream"], P["marble_d"], P["white"]), rx=4) + path(f"M{cx-26},116 Q{cx-26},104 {cx-10},106 L{cx+18},106 Q{cx+26},106 {cx+26},120 L{cx+26},140 Q{cx+20},150 {cx+18},132 Q{cx+10},126 {cx+4},150 Q{cx},160 {cx-4},144 Z", P["white"]) + line(f"M{cx},108 V90", INK, 3))
            + g("flame", path(f"M{cx},40 Q{cx+18},66 {cx+14},80 Q{cx+10},94 {cx},94 Q{cx-10},94 {cx-14},80 Q{cx-18},66 {cx},40 Z", d.v("fl", P["warm_light2"], P["orange"])), (cx, 94)))
    return obj("Shandan me qiri", (w, h), body, {"ground": [0.5, 1.0], "flame": [0.5, 70 / h]},
               ["candle", "candlestick", "brass", "night", "study", "philosophy", "contemplation", "light", "history"],
               {"flame": "sway", "glow": "pulse", "holder": "statik"},
               "A brass candlestick with a lit white candle.",
               "Studying late at night by candlelight: contemplation, philosophers at work, a quiet room in history.",
               animations=("pop_in", "fade", "slide", "sway", "pulse"), themes=PHILO)


def globe(d: Defs):
    w, h = 400, 560
    cx, cy, r = 200, 220, 150
    lands = (path(f"M{cx-90},{cy-90} Q{cx-40},{cy-120} {cx-10},{cy-70} Q{cx-30},{cy-20} {cx-80},{cy-10} Q{cx-120},{cy-40} {cx-90},{cy-90} Z", P["parch_d"])
             + path(f"M{cx+20},{cy-40} Q{cx+80},{cy-60} {cx+110},{cy-10} Q{cx+100},{cy+70} {cx+40},{cy+90} Q{cx},{cy+40} {cx+20},{cy-40} Z", P["parch_d"])
             + path(f"M{cx-70},{cy+40} Q{cx-30},{cy+30} {cx-20},{cy+80} Q{cx-50},{cy+120} {cx-80},{cy+90} Z", P["parch_d"]))
    body = (contact_shadow(d, cx, h, 140, 10)
            + g("stand", rect(cx - 10, cy + r + 10, 20, 120, d.h("pl", P["wood"], P["wood_ddd"])) + smooth_lathe(d, "bs", cx, [(h - 70, 20), (h - 40, 70), (h - 14, 110)], P["wood"], P["wood_ddd"]))
            + g("globe", circle(cx, cy, r, d.d("sea", P["parch_l"], P["parch"])) + lands
                + "".join(f'<ellipse cx="{cx}" cy="{cy}" rx="{r * k:.0f}" ry="{r}" fill="none" stroke="{P["parch_d"]}" stroke-width="2" opacity="0.6"/>' for k in (0.35, 0.7))
                + "".join(line(f"M{cx - r * math.cos(math.asin(t)):.0f},{cy + r * t:.0f} H{cx + r * math.cos(math.asin(t)):.0f}", P["parch_d"], 2, 'opacity="0.6"') for t in (-0.5, 0, 0.5))
                + sheen(f"M{cx-110},{cy-60} Q{cx-80},{cy-130} {cx-10},{cy-146} Q{cx-80},{cy-110} {cx-100},{cy-20} Z", 0.45), (cx, cy))
            + g("meridian", f'<path d="M{cx},{cy-r-22} A{r+22},{r+22} 0 0 1 {cx},{cy+r+22}" fill="none" stroke="{P["brass"]}" stroke-width="12"/>'
                + f'<path d="M{cx},{cy-r-22} A{r+22},{r+22} 0 0 0 {cx-r*0.6:.0f},{cy+r*0.9:.0f}" fill="none" stroke="{P["brass_d"]}" stroke-width="6" opacity="0"/>'))
    return obj("Glob antik", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, cy / h]},
               ["globe", "world", "antique", "exploration", "history", "geography", "travel", "perspective", "global"],
               {"globe": "spin = bota rrotullohet", "stand": "statik", "meridian": "statik"},
               "An antique parchment-coloured desk globe on a wooden stand with a brass meridian ring.",
               "The world view: history and exploration, global perspective, empires and trade routes.",
               animations=("pop_in", "fade", "slide", "spin"), themes=["philosophy", "science", "decisions"])


def telescope(d: Defs):
    w, h = 520, 720
    body = (contact_shadow(d, 260, h, 200, 12)
            + g("tripod", line(f"M260,330 L120,{h-10} M260,330 L400,{h-10} M260,330 L270,{h-10}", P["wood_dd"], 16) + circle(260, 330, 22, P["brass_d"]))
            + g("tube", f'<g transform="rotate(-32 260 320)">'
                + rect(60, 286, 420, 70, d.v("tb", P["brass_l"], P["brass_d"]), rx=10) + rect(0, 296, 90, 50, d.v("ey", P["brass"], P["brass_d"]), rx=8)
                + rect(460, 274, 60, 94, d.v("lens", P["brass_l"], P["brass_d"]), rx=10) + ellipse(520, 321, 12, 46, P["sky"])
                + "".join(rect(x, 282, 14, 78, P["brass_d"]) for x in (160, 300, 420)) + sheen("M70,292 H470 V302 H70 Z", 0.5) + "</g>", (260, 330)))
    return obj("Teleskop", (w, h), body, {"ground": [0.5, 1.0]},
               ["telescope", "astronomy", "discovery", "curiosity", "science", "vision", "future", "exploration", "perspective"],
               {"tube": "rotation = drejton qiellin", "tripod": "statik"},
               "A brass telescope on a wooden tripod, pointing up to the sky.",
               "Curiosity and discovery: looking far ahead, science and astronomy, seeing the bigger picture.",
               themes=["science", "philosophy", "growth"])


def magnifier(d: Defs):
    w, h = 380, 420
    body = (g("magnifier", f'<g transform="rotate(-38 190 210)">'
              + rect(170, 260, 40, 170, d.h("hd", P["wood"], P["wood_ddd"]), rx=14) + rect(166, 246, 48, 30, P["brass"], rx=6)
              + circle(190, 140, 118, d.d("rim", P["brass_l"], P["brass_d"])) + circle(190, 140, 100, d.d("gl", P["sky_l"], P["glass"]), 'opacity="0.85"')
              + sheen("M120,100 Q140,60 190,50 Q150,80 140,130 Z", 0.7) + "</g>", (190, 210)))
    return obj("Lupë (xham zmadhues)", (w, h), body, {"center": [0.5, 0.5], "lens": [0.38, 0.45]},
               ["magnifying-glass", "investigation", "detail", "analysis", "critical-thinking", "search", "evidence", "focus", "research"],
               {"magnifier": "slide/sway = kërkon, zmadhon"},
               "A brass magnifying glass with a wooden handle.",
               "Looking closer: critical thinking, checking the evidence, investigation, confirmation bias (seeing only what you look for).",
               themes=["philosophy", "science", "decisions"])


def question_sculpture(d: Defs):
    w, h = 420, 820
    q = (f"M120,250 Q110,90 220,80 Q340,80 340,210 Q340,300 260,340 Q220,360 220,420 V470 L160,470 V410 Q160,320 240,280 "
         f"Q284,256 280,210 Q276,150 220,150 Q176,150 176,250 Z")
    body = (contact_shadow(d, 210, h, 160, 12)
            + g("plinth", plinth(d, 210, h - 200, 240, 200, "pl"))
            + g("question", path(q, d.d("q", P["marble_l"], P["marble_dd"])) + path(q, P["white"], 'opacity="0.15" transform="translate(-6 -6)"')
                + circle(190, 560, 42, d.d("dot", P["marble_l"], P["marble_dd"])), (210, 600)))
    return obj("Skulpturë pikëpyetjeje", (w, h), body, {"ground": [0.5, 1.0]},
               ["question", "question-mark", "doubt", "curiosity", "critical-thinking", "philosophy", "unknown", "mystery", "why"],
               {"question": "pop_in, float, sway", "plinth": "statik"},
               "A large white marble question mark sculpture standing on a plinth.",
               "The big question: doubt and curiosity, 'why?', philosophy's unanswered questions, thinking before believing.",
               animations=("pop_in", "fade", "slide", "float", "sway"), themes=PHILO)


def puzzle_cube(d: Defs):
    w, h = 400, 400
    cols = [P["red"], P["gold"], P["teal"], P["white"], P["orange"], P["blue"]]
    rng = random.Random(4)

    def face(o, u, v, shade):
        out = ""
        for i in range(3):
            for j in range(3):
                p0 = (o[0] + u[0] * i / 3 + v[0] * j / 3, o[1] + u[1] * i / 3 + v[1] * j / 3)
                pts = [p0, (p0[0] + u[0] / 3, p0[1] + u[1] / 3), (p0[0] + u[0] / 3 + v[0] / 3, p0[1] + u[1] / 3 + v[1] / 3), (p0[0] + v[0] / 3, p0[1] + v[1] / 3)]
                c = [(x * 0.88 + cxm * 0.12, y * 0.88 + cym * 0.12) for x, y in pts for cxm, cym in [(sum(q[0] for q in pts) / 4, sum(q[1] for q in pts) / 4)]]
                out += poly(c, rng.choice(cols), f'opacity="{shade}"')
        return out

    top = (200, 40)
    body = (contact_shadow(d, 200, h, 160, 12)
            + g("cube", poly([(200, 40), (360, 120), (360, 300), (200, 380), (40, 300), (40, 120)], INK)
                + face((40, 120), (160, -80), (160, 80), 1) + face((40, 120), (160, 80), (0, 180), 0.92) + face((200, 200), (160, -80), (0, 180), 0.8)))
    return obj("Kub enigme", (w, h), body, {"ground": [0.5, 0.95], "center": [0.5, 0.5]},
               ["puzzle-cube", "problem-solving", "logic", "complexity", "patience", "strategy", "intelligence", "challenge"],
               {"cube": "spin, pop_in"},
               "A scrambled 3x3 colour puzzle cube in three-quarter view.",
               "Problem solving: complex problems that need patience and method, logic, thinking several steps ahead.",
               animations=("pop_in", "fade", "slide", "spin"), themes=["philosophy", "science", "growth"])


def light_beam(d: Defs):
    w, h = 1000, 1800
    rng = random.Random(8)
    motes = "".join(circle(rng.uniform(340, 660), rng.uniform(120, 1600), rng.uniform(2, 6), P["warm_light2"], f'opacity="{rng.uniform(0.4, 0.9):.2f}"') for _ in range(40))
    body = (g("beam", poly([(380, 0), (620, 0), (760, h - 110), (240, h - 110)], d.v("bm", P["warm_light2"], P["warm_light"]), 'opacity="0.5"')
              + poly([(450, 0), (550, 0), (620, h - 110), (380, h - 110)], P["white"], 'opacity="0.35"'), (500, 0))
            + g("pool", ellipse(500, h - 110, 360, 80, d.glow("pool", P["warm_light2"], 0.9, 0.0, 0.45)))
            + g("motes", motes))
    return obj("Rreze drite", (w, h), body, {"ground": [0.5, (h - 110) / h], "center_stage": [0.5, (h - 110) / h]},
               ["light", "beam", "enlightenment", "truth", "insight", "revelation", "clarity", "hope", "awakening"],
               {"beam": "receta `shine`: drita zbret dhe zgjerohet", "pool": "drita në tokë", "motes": "grimca drite (float)"},
               "A soft column of warm light coming down from above, with floating dust motes and a glowing pool on the ground.",
               "Enlightenment and truth: a moment of clarity, an insight, the light of reason (Plato's cave), hope.",
               animations=("pop_in", "fade", "pulse", "shine"), themes=["philosophy", "growth", "psychology"])


def stone_staircase(d: Defs):
    w, h = 1100, 820
    steps = ""
    for i in range(10):
        x, y = 40 + i * 100, h - 40 - i * 72
        steps += rect(x, y, 1060 - x, 72, d.v(f"s{i % 2}", P["sand"] if i % 2 else P["sand2"], P["sand3"])) + rect(x, y, 1060 - x, 12, P["parch_l"], extra='opacity="0.7"')
        steps += "".join(line(f"M{x + 140 * k + (i % 2) * 70},{y + 12} V{y + 72}", P["sand3"], 3, 'opacity="0.7"') for k in range(int((1060 - x) / 140)))
    body = contact_shadow(d, 550, h, 540, 16) + g("stairs", steps + rect(0, h - 40, w, 40, d.v("bs", P["sand2"], P["sand3"])))
    return obj("Shkallë guri", (w, h), body, {"ground": [0.5, 1.0], "top": [0.95, (h - 40 - 9 * 72) / h], "bottom": [0.05, 1.0]},
               ["stairs", "stone", "ancient", "climb", "progress", "path", "journey", "wisdom", "temple"],
               {"stairs": "statike"},
               "A wide ancient stone staircase rising from left to right, blocks with joints.",
               "The long climb: the path to wisdom or mastery, an ancient temple approach, steady progress.",
               themes=["philosophy", "growth", "decisions"])


def empty_frame(d: Defs):
    w, h = 520, 640
    body = (g("frame", rect(10, 10, 500, 620, d.d("fr", P["gold_l"], P["gold_d"]), rx=8) + rect(40, 40, 440, 560, P["gold_d"])
              + rect(56, 56, 408, 528, d.d("in", P["cream"], P["sand"]))
              + "".join(circle(x, y, 18, d.d("orn", P["warm_light2"], P["gold_d"])) for x, y in [(10, 10), (510, 10), (10, 630), (510, 630)])
              + "".join(circle(x, y, 10, P["gold"]) for x, y in [(260, 24), (260, 616), (24, 320), (496, 320)])
              + f'<rect x="26" y="26" width="468" height="588" fill="none" stroke="{P["gold_l"]}" stroke-width="4" opacity="0.8"/>'))
    return obj("Kornizë bosh", (w, h), body, {"center": [0.5, 0.5], "inside": [0.5, 0.5]},
               ["frame", "empty", "absence", "identity", "art", "framing", "perspective", "missing", "memory"],
               {"frame": "statike; vendos çfarëdo brenda te anchor `inside`"},
               "An ornate gold picture frame, empty, with a pale cream inside.",
               "Framing and absence: what is missing, a lost person or memory, the framing effect, an identity not yet defined.",
               themes=["philosophy", "psychology", "decisions"])


PROPS = [
    ("prop_bust_socratic_01", bust_socratic), ("prop_bust_platonic_01", bust_platonic), ("prop_bust_aristotelian_01", bust_aristotelian),
    ("prop_greek_column_01", greek_column), ("prop_marble_statue_01", marble_statue), ("prop_ancient_book_01", ancient_book),
    ("prop_open_book_01", open_book), ("prop_scroll_01", scroll), ("prop_quill_01", quill), ("prop_ink_bottle_01", ink_bottle),
    ("prop_candle_holder_01", candle_holder), ("prop_globe_01", globe), ("prop_telescope_01", telescope),
    ("prop_magnifier_01", magnifier), ("prop_question_sculpture_01", question_sculpture), ("prop_puzzle_cube_01", puzzle_cube),
    ("prop_broken_statue_01", broken_statue), ("prop_stone_staircase_01", stone_staircase), ("prop_empty_frame_01", empty_frame),
]
METAPHORS = [("met_light_beam_01", light_beam)]


def main() -> None:
    a = run(PROPS, "philosophy")
    b = run(METAPHORS, "philosophy", folder="metaphors", category="metaphor", subcategory="interactive", kind="animated_metaphor")
    print(f"{len(a)} objekte + {len(b)} metafora (filozofi)")


if __name__ == "__main__":
    main()
