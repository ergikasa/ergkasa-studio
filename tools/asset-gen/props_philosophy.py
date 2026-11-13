"""Filozofia dhe mendimi kritik: objektet (lista e prodhimit, kategoria 05).

Bustet janë "në stilin e" filozofëve klasikë: figura mermeri të përgjithshme, jo portrete.

Përdorimi: python3 tools/asset-gen/props_philosophy.py
"""
from __future__ import annotations

import math
import random

from editorial import (INK, P, Defs, blob, circle, contact_shadow, ellipse, g, lathe, line, obj, path, poly, rect, run, sheen,
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


def _statue_figure(d: Defs, cx, base, head=True, arm=True, cracked=False):
    """Figurë klasike me togë, e gdhendur: kontrapost (pesha mbi këmbën e djathtë), palosje të thella,
    konturë e lehtë që e ndan nga sfondet e çelëta. Pa portret: fytyrë e përgjithshme."""
    m, ml, md, mdd = P["marble"], P["marble_l"], P["marble_d"], P["marble_dd"]
    stroke = f'stroke="{mdd}" stroke-width="3" stroke-linejoin="round"'
    # trupi nën togë: nga supet te këmbët, pak i përkulur
    robe = (f"M{cx-62},{base-470} Q{cx-78},{base-330} {cx-70},{base-150} Q{cx-74},{base-60} {cx-66},{base} "
            f"L{cx+58},{base} Q{cx+68},{base-80} {cx+60},{base-180} Q{cx+70},{base-330} {cx+58},{base-470} Z")
    out = path(robe, d.h("robe", ml, md, m), stroke)
    # palosjet: vija të errëta dhe shirita drite
    for i, (x0, x1) in enumerate(((-44, -50), (-22, -30), (2, -4), (24, 30), (44, 48))):
        out += line(f"M{cx + x0},{base - 420 + i * 18} Q{cx + (x0 + x1) / 2 - 6},{base - 220} {cx + x1},{base - 8}", mdd, 4, 'stroke-opacity="0.55"')
        out += line(f"M{cx + x0 + 7},{base - 410 + i * 18} Q{cx + (x0 + x1) / 2},{base - 220} {cx + x1 + 7},{base - 12}", P["white"], 3, 'stroke-opacity="0.5"')
    # rripi diagonal i togës nga supi i majtë te ija e djathtë
    out += path(f"M{cx-64},{base-470} L{cx-30},{base-476} L{cx+62},{base-300} L{cx+60},{base-262} Z", d.h("sash", ml, md), stroke)
    # këmba e lirë del përpara (kontrapost), gishtat poshtë cepit
    out += path(f"M{cx-40},{base-6} Q{cx-36},{base-30} {cx-12},{base-26} L{cx-8},{base} Z", md, stroke)
    out += path(f"M{cx+14},{base-4} Q{cx+20},{base-24} {cx+44},{base-20} L{cx+48},{base} Z", m, stroke)
    # krahu i majtë poshtë, mbi togë
    out += path(f"M{cx-66},{base-460} Q{cx-96},{base-380} {cx-86},{base-280} Q{cx-80},{base-250} {cx-64},{base-262} Q{cx-70},{base-360} {cx-50},{base-440} Z",
                d.h("arml", ml, md), stroke)
    if arm:  # krahu i djathtë i përkulur, mban një rrotull
        out += path(f"M{cx+56},{base-462} Q{cx+92},{base-400} {cx+84},{base-330} L{cx+28},{base-312} L{cx+30},{base-340} L{cx+60},{base-350} Q{cx+62},{base-410} {cx+44},{base-440} Z",
                    d.h("armr", ml, md), stroke)
        out += rect(cx + 4, base - 346, 34, 70, d.h("scr", ml, md), rx=10, extra=stroke)
    else:  # krahu i thyer: vetëm cungu i supit, me sipërfaqe të thyer
        out += path(f"M{cx+56},{base-462} Q{cx+84},{base-430} {cx+80},{base-398} L{cx+62},{base-404} L{cx+70},{base-416} L{cx+56},{base-420} Z", md, stroke)
    # qafa dhe koka
    out += rect(cx - 16, base - 506, 32, 44, d.h("neck", ml, md), rx=8, extra=stroke)
    if head:
        out += (ellipse(cx, base - 548, 42, 50, d.h("head", ml, md, m), stroke)
                + path(f"M{cx-42},{base-556} Q{cx-44},{base-604} {cx},{base-606} Q{cx+44},{base-604} {cx+42},{base-556} Q{cx+28},{base-586} {cx},{base-584} Q{cx-28},{base-586} {cx-42},{base-556} Z",
                       d.h("hair", m, mdd), stroke)
                + "".join(circle(cx + dx, base - 590 + abs(dx) * 0.2, 9, md, stroke) for dx in (-30, -14, 2, 18, 32))
                + line(f"M{cx-18},{base-552} q8,-4 14,0 M{cx+6},{base-552} q8,-4 14,0", mdd, 3)
                + line(f"M{cx-1},{base-546} q-6,16 4,20", mdd, 3) + line(f"M{cx-10},{base-520} q10,5 20,0", mdd, 3))
    else:  # qafa e thyer
        out += path(f"M{cx-16},{base-506} L{cx-6},{base-516} L{cx+2},{base-506} L{cx+10},{base-518} L{cx+16},{base-506} Z", md, stroke)
    if cracked:
        out += line(f"M{cx+10},{base-420} L{cx-4},{base-350} L{cx+14},{base-300} L{cx-2},{base-220}", mdd, 4)
    return out


def _plinth(d: Defs, cx, top, w, h, cracked=False):
    stroke = f'stroke="{P["marble_dd"]}" stroke-width="3"'
    out = (rect(cx - w / 2 - 16, top, w + 32, 28, d.v("pcap", P["marble_l"], P["marble_d"]), rx=4, extra=stroke)
           + rect(cx - w / 2, top + 28, w, h - 56, d.h("pbody", P["marble_l"], P["marble_d"], P["marble"]), extra=stroke)
           + rect(cx - w / 2 - 22, top + h - 28, w + 44, 28, d.v("pbase", P["marble"], P["marble_dd"]), rx=4, extra=stroke))
    if cracked:
        out += line(f"M{cx + w / 2 - 30},{top + 28} L{cx + w / 2 - 50},{top + 90} L{cx + w / 2 - 34},{top + 130} L{cx + w / 2 - 58},{top + h - 28}", P["marble_dd"], 4)
    return out


def marble_statue(d: Defs):
    w, h = 340, 900
    cx, plinth_h = 170, 230
    body = (contact_shadow(d, cx, h, 150, 12)
            + g("plinth", _plinth(d, cx, h - plinth_h, 190, plinth_h))
            + g("statue", _statue_figure(d, cx, h - plinth_h)))
    return obj("Statujë mermeri (antike)", (w, h), body, {"ground": [0.5, 1.0], "plinth_top": [0.5, (h - 230) / h]},
               ["statue", "marble", "ancient", "classical", "greek", "roman", "history", "ideal", "legacy", "stoic"],
               {"statue": "statike; fade", "plinth": "statik"},
               "A white marble classical statue of a figure in a draped toga holding a scroll, on a tall plinth.",
               "Ancient ideals and legacy: Greek and Roman history, how great figures are remembered, Stoic calm.",
               themes=["philosophy", "decisions", "science"])


def broken_statue(d: Defs):
    w, h = 460, 900
    cx, plinth_h = 190, 230
    stroke = f'stroke="{P["marble_dd"]}" stroke-width="3"'
    head = (ellipse(392, h - 40, 44, 38, d.h("fh", P["marble_l"], P["marble_d"]), stroke + ' transform="rotate(-70 392 860)"')
            + path(f"M362,{h-74} Q350,{h-40} 366,{h-8} Q378,{h-30} 380,{h-60} Z", d.h("fhh", P["marble"], P["marble_dd"]), stroke)
            + line(f"M398,{h-62} q-4,8 2,12 M410,{h-50} q-4,8 2,12", P["marble_dd"], 3))
    debris = "".join(poly([(x, h - 2), (x + s * 0.5, h - s), (x + s, h - 2)], P["marble_d"], stroke) for x, s in ((300, 26), (40, 22), (330, 16)))
    debris += path(f"M250,{h-2} L262,{h-36} L300,{h-44} L318,{h-2} Z", d.h("arm", P["marble_l"], P["marble_d"]), stroke)
    body = (contact_shadow(d, 230, h, 210, 12)
            + g("plinth", _plinth(d, cx, h - plinth_h, 190, plinth_h, cracked=True))
            + g("statue", _statue_figure(d, cx, h - plinth_h, head=False, arm=False, cracked=True))
            + g("debris", head + debris))
    return obj("Statujë e thyer", (w, h), body, {"ground": [0.5, 1.0]},
               ["statue", "broken", "fallen", "ruin", "fall-of-empire", "ego", "legacy", "impermanence", "history", "ozymandias"],
               {"statue": "statike", "debris": "koka dhe copat në tokë"},
               "A headless, armless marble statue on a cracked plinth, with its head lying on the ground.",
               "The fall of greatness: empires collapsing, fragile legacies, impermanence, a reputation that breaks.",
               themes=["philosophy", "decisions", "science"])


def ancient_book(d: Defs):
    """Libër i trashë i mbyllur, parë nga lart-përpara (3/4): kopertina, faqet në buzë, kurrizi me shirita."""
    w, h = 560, 360
    # faqet: blloku i bardhë në anën e përparme dhe të djathtë
    pages = (poly([(70, 200), (450, 238), (452, 300), (72, 262)], d.v("pf", P["parch_l"], P["parch"]))
             + "".join(line(f"M76,{208 + i * 9} L448,{246 + i * 9}", P["parch_d"], 1.6, 'stroke-opacity="0.6"') for i in range(6))
             + poly([(450, 238), (500, 176), (502, 236), (452, 300)], d.v("pr", P["parch"], P["parch_d"])))
    # kopertina e poshtme (duket si buzë) dhe e sipërme
    bottom = poly([(60, 262), (452, 304), (512, 240), (512, 252), (452, 318), (60, 276)], d.v("cb", P["red_d"], P["wood_ddd"]))
    cover_top = [(56, 196), (118, 128), (512, 166), (452, 238)]
    cover = (poly(cover_top, d.d("ct", P["red_l"], P["red_d"]))
             + poly([(56, 196), (452, 238), (452, 252), (56, 210)], P["red_d"])
             + poly([(452, 238), (512, 166), (514, 180), (454, 252)], P["wood_ddd"]))
    # kurrizi majtas: shiritat e ngritur
    spine = (path("M56,196 Q34,200 32,232 Q34,266 60,276 L60,262 Q46,252 46,232 Q48,212 70,206 Z", d.v("sp", P["red"], P["wood_ddd"]))
             + line("M42,214 Q38,222 40,232", P["gold_d"], 4) + line("M44,246 Q42,254 48,262", P["gold_d"], 4))
    # zbukurimet e arta: këndet, emblema në mes, kapëset
    corners = "".join(poly(pts, d.d(f"gc{i}", P["gold_l"], P["gold_d"])) for i, pts in enumerate((
        [(118, 128), (160, 132), (148, 146), (110, 142)], [(512, 166), (472, 162), (484, 176), (504, 178)],
        [(56, 196), (70, 180), (100, 184), (88, 200)], [(452, 238), (426, 236), (440, 222), (464, 224)])))
    cx, cy = 284, 184
    emblem = (ellipse(cx, cy, 70, 30, d.d("em", P["gold_l"], P["gold_d"]), 'transform="rotate(6 284 184)"')
              + ellipse(cx, cy, 52, 21, P["red_d"], 'transform="rotate(6 284 184)"')
              + star(cx, cy, 22, 8, 4, P["gold_l"], extra='transform="matrix(1 0.08 -0.3 0.5 100 92)"'))
    clasps = "".join(rect(x, y, 24, 46, d.v(f"cl{x}", P["gold_l"], P["gold_d"]), rx=4) + circle(x + 12, y + 36, 5, P["gold_d"])
                     for x, y in ((210, 214), (350, 228)))
    body = (contact_shadow(d, 290, h - 30, 240, 16) + g("book", bottom + pages + cover + spine + corners + emblem + clasps))
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


def ancient_map(d: Defs):
    """Hartë e vjetër pa tekst: kontinente të shpikura, male, rrugë me pika, trëndafil i erërave, valë deti."""
    rng = random.Random(55)
    w, h = 820, 600
    sheet = (f"M70,52 Q200,40 330,56 Q470,44 600,58 Q700,48 760,60 L766,120 Q756,260 768,400 Q760,480 766,548 "
             f"Q640,560 500,546 Q360,560 220,548 Q120,560 62,546 L58,470 Q70,330 56,200 Q66,120 70,52 Z")
    land1 = path("M150,150 Q210,104 300,128 Q356,150 340,214 Q370,262 330,310 Q300,360 236,350 Q170,376 140,320 "
                 "Q104,266 128,214 Q120,172 150,150 Z", d.v("l1", P["parch"], P["parch_d"]), f'stroke="{P["wood_d"]}" stroke-width="4"')
    land2 = path("M470,250 Q540,210 620,236 Q690,262 670,330 Q700,392 640,430 Q570,470 510,440 Q450,420 456,360 "
                 "Q430,300 470,250 Z", d.v("l2", P["parch"], P["parch_d"]), f'stroke="{P["wood_d"]}" stroke-width="4"')
    isles = "".join(blob(x, y, r, 7, rng, 0.25, P["parch"], f'stroke="{P["wood_d"]}" stroke-width="3"') for x, y, r in ((420, 150, 22), (390, 196, 14), (560, 140, 18), (260, 450, 20)))
    mountains = "".join(poly([(x - 18, y + 14), (x, y - 18), (x + 18, y + 14)], P["wood_d"]) + poly([(x - 4, y - 8), (x, y - 18), (x + 6, y - 6)], P["parch_l"])
                        for x, y in ((210, 200), (240, 186), (270, 214), (560, 300), (590, 284), (612, 318)))
    forest = "".join(circle(x, y, 9, P["green_dd"], 'fill-opacity="0.7"') for x, y in ((180, 280), (198, 296), (216, 280), (540, 390), (560, 404), (580, 388)))
    waves = "".join(line(f"M{x},{y} q10,-10 20,0 q10,10 20,0", P["blue_d"], 3, 'stroke-opacity="0.6"') for x, y in ((390, 320), (420, 360), (130, 420), (650, 180), (330, 480), (700, 500)))
    route = line("M250,250 Q380,240 420,300 Q470,370 560,360", P["red_d"], 5, 'stroke-dasharray="10 9"') + path("M548,350 l18,10 l-18,10 Z", P["red_d"])
    rose = (f'<circle cx="680" cy="460" r="46" fill="none" stroke="{P["wood_d"]}" stroke-width="3"/>' + star(680, 460, 44, 10, 4, P["wood_dd"])
            + star(680, 460, 26, 6, 4, P["red_d"], rot=-45) + circle(680, 460, 6, P["parch_l"]))
    stains = "".join(blob(x, y, r, 9, rng, 0.2, P["parch_d"], 'fill-opacity="0.35"') for x, y, r in ((120, 500, 34), (700, 100, 28), (430, 520, 18)))
    body = (contact_shadow(d, w / 2, h, 360, 14, 0.25)
            + g("map", path(sheet, d.v("sheet", P["parch_l"], P["parch"])) + stains
                + path("M70,52 Q200,40 330,56 Q470,44 600,58 Q700,48 760,60 L766,120 Q756,260 768,400 Q760,480 766,548 Q640,560 500,546 Q360,560 220,548 Q120,560 62,546 L58,470 Q70,330 56,200 Q66,120 70,52 Z",
                       "none", f'stroke="{P["parch_d"]}" stroke-width="10" stroke-opacity="0.7"')
                + land1 + land2 + isles + forest + mountains + waves + route + rose
                + rect(40, 40, 30, 520, d.h("rod1", P["wood"], P["wood_dd"]), rx=14) + rect(756, 40, 30, 520, d.h("rod2", P["wood"], P["wood_dd"]), rx=14)))
    return obj("Hartë e lashtë", (w, h), body, {"center": [0.5, 0.5], "route_end": [566 / w, 360 / h]},
               ["map", "ancient-map", "world-map", "exploration", "journey", "history", "discovery", "unknown", "route", "plan"],
               {"map": "pop_in, slide"},
               "An old parchment map on two rods: two invented continents, islands, mountains, a dotted red route and a compass rose. No text.",
               "Exploration and the unknown, a long journey or plan, history of trade and empires; the map is not the territory.",
               themes=["philosophy", "decisions", "science"])


PROPS = [
    ("prop_bust_socratic_01", bust_socratic), ("prop_bust_platonic_01", bust_platonic), ("prop_bust_aristotelian_01", bust_aristotelian),
    ("prop_greek_column_01", greek_column), ("prop_marble_statue_01", marble_statue), ("prop_ancient_book_01", ancient_book),
    ("prop_open_book_01", open_book), ("prop_scroll_01", scroll), ("prop_quill_01", quill), ("prop_ink_bottle_01", ink_bottle),
    ("prop_candle_holder_01", candle_holder), ("prop_globe_01", globe), ("prop_telescope_01", telescope),
    ("prop_magnifier_01", magnifier), ("prop_question_sculpture_01", question_sculpture), ("prop_puzzle_cube_01", puzzle_cube),
    ("prop_broken_statue_01", broken_statue), ("prop_ancient_map_01", ancient_map), ("prop_stone_staircase_01", stone_staircase), ("prop_empty_frame_01", empty_frame),
]
METAPHORS = [("met_light_beam_01", light_beam)]


def main() -> None:
    a = run(PROPS, "philosophy")
    b = run(METAPHORS, "philosophy", folder="metaphors", category="metaphor", subcategory="interactive", kind="animated_metaphor")
    print(f"{len(a)} objekte + {len(b)} metafora (filozofi)")


if __name__ == "__main__":
    main()
