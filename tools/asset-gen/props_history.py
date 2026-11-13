"""Historia dhe shoqëria: objektet (lista e prodhimit, kategoria 06).

Ndërtesat janë objekte më vete (jo sfonde), që të vendosen mbi sfonde të ndryshme ose të krahasohen.

Përdorimi: python3 tools/asset-gen/props_history.py
"""
from __future__ import annotations

import math
import random

from editorial import (INK, P, Defs, circle, contact_shadow, ellipse, g, line, obj, path, poly, rect, run, sheen, star)
from props_business import classical_facade
from props_power import column

HIST = ["philosophy", "decisions", "science"]


def roman_senate(d: Defs):
    w, h = 1000, 820
    body = (contact_shadow(d, 500, h, 490, 20)
            + g("building", classical_facade(d, w, h, 8, P["sand"], P["sand3"], name="sn")
                + "".join(rect(x, h - 340, 70, 200, d.v(f"dr{x}", P["wood_dd"], P["wood_ddd"]), rx=4) for x in (310, 620))
                + rect(465, h - 360, 70, 220, d.v("main", P["wood_d"], P["wood_ddd"]), rx=4)
                + path("M330,150 Q500,70 670,150", "none", f'stroke="{P["gold_d"]}" stroke-width="8"')
                + "".join(circle(x, 132, 8, P["gold"]) for x in (400, 500, 600))))
    return obj("Ndërtesa e Senatit romak", (w, h), body, {"ground": [0.5, 1.0]},
               ["senate", "rome", "republic", "politics", "power", "law", "ancient", "history", "debate", "empire"],
               {"building": "statike"},
               "A Roman senate building: eight columns, a pediment, gold garland details and bronze doors.",
               "Ancient politics: the Roman Republic, debate and power, how republics rise and fall.", themes=HIST)


def castle(d: Defs):
    w, h = 1100, 900
    stone, stone_d = P["sand2"], P["sand3"]

    def tower(x, top, tw, name):
        out = rect(x, top, tw, h - 40 - top, d.h(name, stone, stone_d))
        out += "".join(rect(x - 10 + i * (tw + 20) / 4, top - 40, (tw + 20) / 4 - 10, 44, stone) for i in range(4))
        out += rect(x - 10, top - 4, tw + 20, 20, stone_d)
        out += rect(x + tw / 2 - 12, top + 80, 24, 50, INK, rx=12)
        out += poly([(x - 20, top - 40), (x + tw / 2, top - 200), (x + tw + 20, top - 40)], d.v(name + "rf", P["blue"], P["blue_dd"]))
        out += line(f"M{x + tw / 2},{top - 200} V{top - 260}", P["slate_d"], 4) + poly([(x + tw / 2, top - 260), (x + tw / 2 + 50, top - 244), (x + tw / 2, top - 228)], P["red"])
        return out

    wall = rect(200, 420, 700, h - 460, d.v("wall", stone, stone_d)) + "".join(rect(190 + i * 46, 380, 30, 46, stone) for i in range(16))
    bricks = "".join(line(f"M200,{y} H900", stone_d, 2, 'opacity="0.5"') for y in range(470, h - 40, 50))
    body = (contact_shadow(d, 550, h, 540, 22)
            + g("castle", wall + bricks + tower(80, 300, 160, "t1") + tower(860, 300, 160, "t2") + tower(470, 200, 160, "t3")
                + path(f"M470,{h-40} V{h-200} Q550,{h-290} 630,{h-200} V{h-40} Z", d.v("gate", P["wood_dd"], INK))
                + "".join(line(f"M{x},{h-250} V{h-40}", P["slate_d"], 5) for x in range(490, 630, 26))
                + rect(0, h - 40, w, 40, P["green_d"], rx=6)))
    return obj("Kështjellë mesjetare", (w, h), body, {"ground": [0.5, 1.0], "gate": [0.5, 1.0]},
               ["castle", "medieval", "kingdom", "fortress", "power", "defence", "history", "feudal", "war"],
               {"castle": "statike"},
               "A stone medieval castle with three towers, blue conical roofs, red flags, battlements and a portcullis gate.",
               "Medieval power: kingdoms and feudalism, defence and walls, the history of rulers and wars.", themes=HIST)


def palace(d: Defs):
    w, h = 1300, 760
    body = (contact_shadow(d, 650, h, 640, 22)
            + g("palace", rect(60, 260, 1180, h - 300, d.v("wall", P["cream"], P["sand2"]))
                + rect(40, 240, 1220, 30, P["sand3"]) + rect(40, 230, 1220, 14, P["gold"], extra='opacity="0.8"')
                + "".join(rect(100 + i * 110, 320, 70, 130, d.v(f"w{i % 2}", P["sky_l"], P["glass"]), rx=34) + rect(100 + i * 110, 500, 70, 130, d.v(f"wl{i % 2}", P["sky_l"], P["glass"]), rx=6) for i in range(11) if i != 5)
                + rect(520, 140, 260, h - 180, d.v("center", P["cream"], P["sand2"]))
                + poly([(500, 150), (650, 40), (800, 150)], d.v("pd", P["cream"], P["sand3"]))
                + path("M560,140 Q650,-30 740,140 Z", d.v("dome", P["teal"], P["teal_d"])) + circle(650, 30, 14, P["gold"])
                + path(f"M590,{h-40} V{h-220} Q650,{h-280} 710,{h-220} V{h-40} Z", d.v("door", P["wood_d"], P["wood_ddd"]))
                + rect(0, h - 40, w, 40, d.v("st", P["sand"], P["sand3"]))))
    return obj("Pallat mbretëror", (w, h), body, {"ground": [0.5, 1.0], "door": [0.5, 1.0]},
               ["palace", "royalty", "wealth", "power", "monarchy", "aristocracy", "luxury", "history", "elite"],
               {"palace": "statike"},
               "A wide cream-coloured royal palace with rows of arched windows, a central pavilion and a teal dome.",
               "Royal wealth and the elite: monarchy, aristocracy, inequality, the life behind the palace walls.", themes=HIST)


def greek_temple(d: Defs):
    w, h = 1000, 760
    body = (contact_shadow(d, 500, h, 490, 20)
            + g("temple", poly([(20, 190), (500, 30), (980, 190)], d.v("pd", P["marble_l"], P["marble_d"]))
                + poly([(110, 176), (500, 64), (890, 176)], P["marble_d"], 'opacity="0.45"')
                + rect(10, 190, 980, 50, d.v("ent", P["marble_l"], P["marble_d"])) + rect(30, 240, 940, 28, P["marble_d"])
                + "".join(column(d, 90 + i * 117, 268, h - 90, 72, f"c{i}") for i in range(8))
                + rect(0, h - 90, w, 30, P["marble_l"]) + rect(0, h - 60, w, 60, d.v("st", P["marble"], P["marble_d"]))))
    return obj("Tempull i lashtë grek", (w, h), body, {"ground": [0.5, 1.0]},
               ["temple", "greek", "ancient", "parthenon", "democracy", "religion", "classical", "history", "philosophy"],
               {"temple": "statike"},
               "A white marble ancient Greek temple with eight columns, a triangular pediment and steps.",
               "Ancient Greece: the birth of democracy and philosophy, gods and myths, classical civilisation.", themes=HIST)


def printing_press(d: Defs):
    w, h = 700, 780
    wood, wood_d = P["wood"], P["wood_ddd"]
    body = (contact_shadow(d, 350, h, 320, 18)
            + g("frame", rect(100, 40, 60, h - 80, d.h("p1", wood, wood_d)) + rect(540, 40, 60, h - 80, d.h("p2", wood, wood_d))
                + rect(80, 20, 540, 70, d.v("top", wood, wood_d), rx=8) + rect(80, 300, 540, 50, d.v("mid", wood, wood_d), rx=6)
                + rect(60, h - 160, 580, 40, d.v("bed", P["wood_d"], wood_d), rx=6) + rect(80, h - 120, 40, 120, wood_d) + rect(580, h - 120, 40, 120, wood_d))
            + g("screw", rect(330, 90, 40, 220, d.h("sc", P["steel_l"], P["steel_dd"])) + "".join(line(f"M330,{y} L370,{y+10}", P["steel_dd"], 3) for y in range(100, 300, 18))
                + rect(200, 190, 300, 18, P["steel_d"], rx=8) + circle(200, 199, 18, P["steel_dd"]))
            + g("platen", rect(220, 350, 260, 70, d.v("pl", P["steel_l"], P["steel_d"]), rx=6), (350, 350))
            + g("sheet", poly([(180, h - 166), (520, h - 166), (500, h - 186), (200, h - 186)], P["white"])
                + "".join(line(f"M{220 + k * 6},{h - 180} H{480 - k * 6}", P["cream3"], 2) for k in range(2))))
    return obj("Makinë e vjetër shtypi", (w, h), body, {"ground": [0.5, 1.0]},
               ["printing-press", "gutenberg", "information", "media", "revolution", "history", "books", "knowledge", "propaganda"],
               {"platen": "y poshtë-lart = shtyp", "screw": "statike", "frame": "statik", "sheet": "fleta"},
               "A wooden hand-operated printing press with a steel screw, lever and a printed sheet on the bed.",
               "How information spread: the printing press revolution, media and propaganda, books changing the world.", themes=HIST)


def market_stall(d: Defs):
    w, h = 820, 700
    rng = random.Random(11)
    goods = "".join(circle(rng.uniform(140, 680), rng.uniform(470, 500), 22, rng.choice([P["red"], P["orange"], P["green"], P["gold"]])) for _ in range(22))
    body = (contact_shadow(d, 410, h, 400, 18)
            + g("stall", rect(80, 180, 26, h - 200, d.h("p1", P["wood"], P["wood_ddd"])) + rect(714, 180, 26, h - 200, d.h("p2", P["wood"], P["wood_ddd"]))
                + path("M40,200 L410,60 L780,200 Z", d.v("cloth", P["red_l"], P["red_d"]))
                + "".join(path(f"M{40 + i * 74},200 Q{77 + i * 74},240 {114 + i * 74},200", P["red_d"] if i % 2 else P["parch_l"]) for i in range(10))
                + rect(100, 500, 620, 40, d.v("tbl", P["wood"], P["wood_dd"]), rx=6) + rect(110, 540, 600, h - 560, d.v("box", P["wood_d"], P["wood_ddd"]))
                + goods + "".join(rect(x, 420, 70, 60, d.v(f"bk{x}", P["parch"], P["parch_d"]), rx=8) for x in (150, 360, 560))
                + "".join(ellipse(x, 420, 35, 10, P["parch_d"]) for x in (185, 395, 595))))
    return obj("Tezgë tregu mesjetar", (w, h), body, {"ground": [0.5, 1.0]},
               ["market", "medieval", "trade", "merchant", "economy", "barter", "history", "village", "commerce"],
               {"stall": "statike"},
               "A wooden medieval market stall with a striped red cloth roof, baskets and fruit on the counter.",
               "Early trade and markets: merchants, barter, the origins of the economy, village life.", themes=["money", "philosophy", "decisions"])


def merchant_shop(d: Defs):
    w, h = 820, 800
    body = (contact_shadow(d, 410, h, 400, 18)
            + g("shop", rect(40, 120, 740, h - 150, d.v("wall", P["parch"], P["parch_d"]))
                + poly([(20, 140), (410, 20), (800, 140)], d.v("roof", P["wood_d"], P["wood_ddd"]))
                + "".join(line(f"M40,{y} H780", P["wood_dd"], 14) for y in (160, 420))
                + "".join(line(f"M{x},160 V{h-30}", P["wood_dd"], 14) for x in (60, 410, 760))
                + rect(120, 460, 230, 180, d.v("win", P["warm_light"], P["gold"])) + line("M235,460 V640 M120,550 H350", P["wood_dd"], 8)
                + rect(470, 440, 160, h - 470, d.v("door", P["wood"], P["wood_ddd"]), rx=6) + circle(610, 620, 8, P["brass"])
                + line("M640,230 H720", P["wood_ddd"], 8) + path("M680,230 V260", "none", f'stroke="{P["steel_d"]}" stroke-width="4"')
                + ellipse(680, 300, 46, 40, d.d("sign", P["brass_l"], P["brass_d"])) + circle(680, 300, 16, P["brass_d"])
                + "".join(rect(x, 250, 50, 120, d.v(f"barrel{x}", P["wood"], P["wood_dd"]), rx=18) for x in (120, 190))))
    return obj("Dyqan i vjetër tregtari", (w, h), body, {"ground": [0.5, 1.0], "door": [550 / w, 1.0]},
               ["merchant", "shop", "old", "trade", "history", "commerce", "craft", "town", "economy"],
               {"shop": "statike"},
               "An old timber-framed merchant's shop with a warm lit window, a wooden door and a round brass hanging sign.",
               "Traders and craftsmen of the past: the history of commerce, small family businesses, the old town.", themes=["money", "philosophy", "decisions"])


def sailing_ship(d: Defs):
    w, h = 1000, 1000
    hull = (path("M80,720 L920,700 Q880,860 760,900 L260,900 Q140,860 80,720 Z", d.v("hull", P["wood"], P["wood_ddd"]))
            + "".join(line(f"M{100 + k * 10},{740 + k * 36} Q500,{760 + k * 30} {900 - k * 20},{720 + k * 36}", P["wood_dd"], 4, 'opacity="0.7"') for k in range(4))
            + "".join(circle(x, 790, 12, INK) for x in range(250, 800, 90)) + rect(60, 690, 880, 30, P["wood_d"], rx=8))
    sails = ""
    for x, top, sw in ((300, 120, 220), (520, 60, 250), (740, 160, 200)):
        sails += rect(x - 8, top - 40, 16, 700 - top + 40, P["wood_ddd"])
        for k, (y0, y1) in enumerate(((top, top + 200), (top + 230, top + 440))):
            sails += path(f"M{x - sw / 2},{y0} Q{x},{y0 + 30} {x + sw / 2},{y0} L{x + sw / 2 + 10},{y1} Q{x},{y1 + 40} {x - sw / 2 - 10},{y1} Z", d.h(f"s{x}{k}", P["white"], P["parch"]))
        sails += poly([(x, top - 40), (x + 50, top - 28), (x, top - 16)], P["red"])
    body = (g("ship", sails + hull + line("M80,720 L-20,520", P["wood_ddd"], 10), (500, 900))
            + g("sea", path(f"M0,880 Q120,850 250,880 T500,880 T750,880 T1000,880 V{h} H0 Z", d.v("sea", P["blue"], P["blue_dd"]))
                + "".join(path(f"M{x},900 q30,-14 60,0", "none", f'stroke="{P["sky_l"]}" stroke-width="5"') for x in range(30, 980, 140))))
    return obj("Anije me vela prej druri", (w, h), body, {"ground": [0.5, 0.88]},
               ["ship", "sailing", "exploration", "voyage", "trade", "colonialism", "history", "adventure", "risk"],
               {"ship": "bob/sway = lundron", "sea": "statik"},
               "A three-masted wooden sailing ship with white sails and red pennants on the waves.",
               "Voyages and exploration: the age of discovery, trade routes, taking a big risk into the unknown.", themes=HIST)


def vintage_newspaper(d: Defs):
    w, h = 460, 560
    body = (contact_shadow(d, 230, h, 190, 10, 0.15)
            + g("paper", rect(30, 20, 400, 520, d.v("pp", P["parch_l"], P["parch"]), rx=4)
                + rect(60, 46, 340, 44, INK, rx=4, extra='opacity="0.85"') + line("M60,104 H400 M60,112 H400", P["wood_dd"], 2)
                + rect(60, 130, 340, 30, P["wood_dd"], rx=4, extra='opacity="0.75"')
                + rect(60, 180, 160, 130, d.v("photo", P["steel"], P["slate_l"])) + path("M60,310 L110,240 L150,280 L190,230 L220,310 Z", P["slate_d"], 'opacity="0.6"')
                + "".join(rect(240, 180 + i * 18, 160, 8, P["parch_d"], rx=3) for i in range(7))
                + "".join(rect(60 + c * 116, 330 + i * 18, 100, 8, P["parch_d"], rx=3) for c in range(3) for i in range(10))))
    return obj("Gazetë e vjetër", (w, h), body, {"center": [0.5, 0.5]},
               ["newspaper", "vintage", "news", "history", "media", "headline", "propaganda", "event", "public-opinion"],
               {"paper": "pop_in, spin+zoom (titulli i madh)"},
               "A yellowed vintage newspaper page: a dark headline bar, a grey photo and columns of text as bars. No readable words.",
               "History making the news: a big headline moment, media and propaganda, how the public learned about events.", themes=HIST)


def historical_document(d: Defs):
    w, h = 460, 580
    body = (contact_shadow(d, 230, h, 190, 10, 0.15)
            + g("document", path("M40,30 Q230,10 420,30 L430,520 Q230,540 30,520 Z", d.v("pp", P["parch_l"], P["parch"]))
                + path("M40,30 Q60,60 44,90 M420,30 Q404,70 424,110", "none", f'stroke="{P["parch_d"]}" stroke-width="4"')
                + rect(120, 70, 220, 20, P["wood_dd"], rx=6, extra='opacity="0.7"')
                + "".join(rect(70, 120 + i * 24, 320 * (0.55 if i % 4 == 3 else 1), 7, P["wood_d"], rx=3, extra='opacity="0.6"') for i in range(14))
                + path("M260,470 Q290,440 320,470 T380,466", "none", f'stroke="{P["wood_ddd"]}" stroke-width="4"')
                + path("M130,480 L110,560 L140,540 L160,570 L170,486 Z", P["red_d"]) + path("M150,480 L170,560 L190,538 L214,566 L190,486 Z", P["red"])
                + circle(150, 470, 40, d.d("seal", P["red_l"], P["red_d"])) + star(150, 470, 22, 10, 8, P["red_d"])))
    return obj("Dokument historik", (w, h), body, {"center": [0.5, 0.5]},
               ["document", "historical", "treaty", "charter", "law", "declaration", "history", "agreement", "rights"],
               {"document": "pop_in, slide"},
               "An old parchment charter with lines of handwriting as soft strokes, a signature and a red wax seal with ribbons.",
               "Historic agreements: treaties, charters and declarations, laws that changed societies.", themes=HIST)


def wax_seal(d: Defs):
    w, h = 300, 300
    rng = random.Random(6)
    blob_pts = " ".join(f"{150 + (110 + rng.uniform(-10, 10)) * math.cos(a):.1f},{150 + (110 + rng.uniform(-10, 10)) * math.sin(a):.1f}" for a in [i * math.pi / 14 for i in range(28)])
    body = (g("seal", f'<polygon points="{blob_pts}" fill="{d.d("wax", P["red_l"], P["red_d"])}"/>'
              + circle(150, 150, 80, d.d("in", P["red"], P["red_d"])) + f'<circle cx="150" cy="150" r="80" fill="none" stroke="{P["red_d"]}" stroke-width="6"/>'
              + star(150, 150, 50, 20, 6, P["red_d"]) + circle(150, 150, 14, P["red_l"])
              + sheen("M80,110 Q100,70 140,60 Q100,90 94,130 Z", 0.4)))
    return obj("Vulë dylli", (w, h), body, {"center": [0.5, 0.5]},
               ["wax-seal", "seal", "official", "authority", "secret", "letter", "history", "authentic", "commitment"],
               {"seal": "pop_in, scale_pulse = vuloset"},
               "A red wax seal with an irregular edge and a star emblem pressed into it.",
               "Making it official: sealed letters and secrets, authority and authenticity, a decision that cannot be undone.",
               animations=("pop_in", "fade", "slide", "scale_pulse"), themes=HIST)


def pocket_watch(d: Defs):
    w, h = 320, 480
    cx, cy, r = 160, 300, 130
    chain = "".join(ellipse(160 + 60 * math.sin(t / 3), 20 + t * 12, 9, 6, P["gold_d"]) for t in range(12))
    body = (contact_shadow(d, cx, h, 120, 8, 0.15)
            + g("chain", chain)
            + g("watch", rect(146, 150, 28, 30, d.h("cr", P["gold_l"], P["gold_d"]), rx=6) + circle(160, 150, 18, "none", f'stroke="{P["gold"]}" stroke-width="7"')
                + circle(cx, cy, r, d.d("cs", P["gold_l"], P["gold_d"])) + circle(cx, cy, r - 18, d.d("fc", P["cream"], P["parch"]))
                + "".join(rect(cx - 2, cy - r + 26, 4, 16 if a % 90 else 24, INK, extra=f'transform="rotate({a} {cx} {cy})"') for a in range(0, 360, 30))
                + circle(cx, cy + 50, 26, "none", f'stroke="{P["parch_d"]}" stroke-width="3"'))
            + g("hour", rect(cx - 4, cy - 56, 8, 60, INK, rx=4, extra=f'transform="rotate(-40 {cx} {cy})"'), (cx, cy))
            + g("minute", rect(cx - 3, cy - 84, 6, 88, INK, rx=3, extra=f'transform="rotate(70 {cx} {cy})"'), (cx, cy))
            + circle(cx, cy, 8, P["gold_d"]) + sheen(f"M{cx-90},{cy-50} Q{cx-50},{cy-110} {cx+10},{cy-112} Q{cx-50},{cy-90} {cx-80},{cy-20} Z", 0.45))
    return obj("Orë xhepi e vjetër", (w, h), body, {"center": [0.5, cy / h], "top": [0.5, 0.0]},
               ["pocket-watch", "time", "history", "vintage", "past", "nostalgia", "patience", "old-world", "memory"],
               {"watch": "sway = lëkundet në zinxhir", "hour": "rotation", "minute": "rotation"},
               "An antique gold pocket watch with a cream dial, black hands and a gold chain.",
               "Time in history: the past, nostalgia, a moment frozen in time, patience and old values.",
               animations=("pop_in", "fade", "slide", "sway"), themes=HIST)


def sword(d: Defs):
    w, h = 220, 900
    body = g("sword", path("M100,40 L120,40 L126,640 L110,690 L94,640 Z", d.h("bl", P["steel_l"], P["steel_d"], P["white"]))
             + line("M110,60 V630", P["steel_dd"], 3)
             + rect(20, 640, 180, 30, d.v("gd", P["gold_l"], P["gold_d"]), rx=12) + rect(96, 670, 28, 160, d.h("gr", P["wood_d"], P["wood_ddd"]), rx=8)
             + "".join(line(f"M96,{y} L124,{y+12}", P["wood_ddd"], 3) for y in range(680, 820, 16))
             + circle(110, 850, 30, d.d("pm", P["gold_l"], P["gold_d"])) + circle(110, 850, 12, P["red"]), (110, 760))
    return obj("Shpatë mesjetare", (w, h), body, {"center": [0.5, 0.5], "hilt": [0.5, 0.82]},
               ["sword", "medieval", "war", "power", "conflict", "honour", "knight", "history", "battle", "force"],
               {"sword": "rotation/slide; pop_in"},
               "A medieval longsword with a polished steel blade, gold crossguard, leather grip and a red pommel stone.",
               "War and force: knights and battles, conflict, power taken by violence, honour.",
               themes=HIST)


def military_helmet(d: Defs):
    w, h = 440, 320
    body = (contact_shadow(d, 220, h, 190, 12)
            + g("helmet", path("M40,250 Q30,60 220,40 Q410,60 400,250 Z", d.d("hm", P["green_d"], P["green_dd"]))
                + path("M20,250 Q220,290 420,250 L410,280 Q220,310 30,280 Z", d.v("brim", P["green_d"], P["green_dd"]))
                + line("M60,230 Q220,250 380,230", P["green_dd"], 6) + sheen("M90,190 Q90,90 190,64 Q120,110 120,200 Z", 0.25)
                + line("M120,260 Q130,300 160,310 M320,260 Q310,300 280,310", P["wood_d"], 6)))
    return obj("Helmetë ushtarake", (w, h), body, {"ground": [0.5, 1.0]},
               ["helmet", "military", "war", "soldier", "history", "conflict", "world-war", "sacrifice", "duty"],
               {"helmet": "statike; pop_in"},
               "An olive green steel soldier's helmet with a chin strap.",
               "War and its cost: soldiers, the world wars, duty and sacrifice, conflict between nations.", themes=HIST)


def stone_bridge(d: Defs):
    w, h = 1200, 520
    stone, stone_d = P["sand2"], P["sand3"]
    arches = "".join(path(f"M{x},{h} V360 Q{x + 130},200 {x + 260},360 V{h}", P["blue_d"]) for x in (110, 470, 830))
    body = (contact_shadow(d, 600, h, 590, 18)
            + g("water", rect(0, h - 70, w, 70, d.v("wt", P["blue"], P["blue_dd"])))
            + g("bridge", path(f"M0,200 Q600,120 1200,200 V{h} H0 Z", d.v("st", stone, stone_d))
                + arches.replace(P["blue_d"], d.v("shadow", P["slate_d"], P["blue_dd"]))
                + "".join(line(f"M0,{y} Q600,{y - 80} 1200,{y}", stone_d, 2, 'opacity="0.6"') for y in (250, 300))
                + path("M0,160 Q600,80 1200,160 V200 Q600,120 0,200 Z", P["parch"])
                + "".join(rect(x, 100 + abs(x - 600) * 0.06, 24, 50, stone_d) for x in range(40, 1180, 90))))
    return obj("Urë guri", (w, h), body, {"ground": [0.5, 1.0], "deck": [0.5, 120 / h]},
               ["bridge", "stone", "connection", "history", "crossing", "transition", "old-town", "path", "unity"],
               {"bridge": "statike", "water": "statike"},
               "An old arched stone bridge with three arches over dark blue water.",
               "Connection and crossing over: bridging two sides, transition between stages of life, old towns.",
               themes=["philosophy", "decisions", "growth"])


def steam_train(d: Defs):
    w, h = 1200, 560
    wheel = lambda x, r: circle(x, 470, r, P["red_d"]) + circle(x, 470, r * 0.7, INK) + circle(x, 470, r * 0.2, P["steel"]) + "".join(
        line(f"M{x},{470} L{x + r * 0.7 * math.cos(a):.0f},{470 + r * 0.7 * math.sin(a):.0f}", P["red_d"], 5) for a in [k * math.pi / 4 for k in range(8)])
    body = (contact_shadow(d, 600, h, 590, 16)
            + g("smoke", "".join(circle(x, y, r, P["steel"], 'opacity="0.6"') for x, y, r in [(250, 90, 50), (190, 60, 64), (120, 40, 70), (60, 30, 60)]), (250, 120))
            + g("train", rect(160, 270, 560, 170, d.v("boiler", INK, P["slate_dd"]), rx=80) + rect(220, 140, 60, 140, d.h("stack", P["slate"], INK))
                + rect(200, 120, 100, 30, P["slate_d"], rx=6) + circle(400, 260, 34, P["gold"]) + "".join(rect(x, 270, 14, 170, P["gold_d"]) for x in (340, 520))
                + rect(700, 170, 260, 270, d.v("cab", P["red"], P["red_d"]), rx=8) + rect(680, 150, 300, 30, INK, rx=6)
                + rect(740, 210, 90, 90, d.v("cw", P["warm_light"], P["gold"]), rx=6) + rect(850, 210, 90, 90, d.v("cw2", P["warm_light"], P["gold"]), rx=6)
                + poly([(100, 440), (160, 340), (160, 440)], P["red_d"]) + rect(990, 290, 190, 150, d.v("tender", P["slate"], INK), rx=6)
                + rect(80, 430, 1110, 20, P["slate_dd"])
                + wheel(260, 56) + wheel(420, 56) + wheel(580, 56) + wheel(800, 40) + wheel(1080, 40)
                + line("M260,470 L580,470", P["steel"], 10))
            + rect(0, 520, w, 16, P["wood_dd"]) + rect(0, 530, w, 8, P["steel_d"]))
    return obj("Tren historik me avull", (w, h), body, {"ground": [0.5, 1.0]},
               ["train", "steam", "locomotive", "industrial-revolution", "progress", "history", "travel", "railway", "momentum"],
               {"train": "slide (x) = lëviz", "smoke": "float/fade"},
               "A black steam locomotive with a red cab, gold bands and red wheels, puffing smoke, on rails.",
               "Progress and momentum: the industrial revolution, railways connecting nations, an unstoppable force.",
               themes=["science", "philosophy", "decisions"])


PROPS = [
    ("prop_roman_senate_01", roman_senate), ("prop_castle_01", castle), ("prop_palace_01", palace),
    ("prop_greek_temple_01", greek_temple), ("prop_printing_press_01", printing_press), ("prop_market_stall_01", market_stall),
    ("prop_merchant_shop_01", merchant_shop), ("prop_sailing_ship_01", sailing_ship), ("prop_vintage_newspaper_01", vintage_newspaper),
    ("prop_historical_document_01", historical_document), ("prop_wax_seal_01", wax_seal), ("prop_pocket_watch_01", pocket_watch),
    ("prop_sword_01", sword), ("prop_military_helmet_01", military_helmet), ("prop_stone_bridge_01", stone_bridge),
    ("prop_steam_train_01", steam_train),
]


def main() -> None:
    print(f"{len(run(PROPS, 'history'))} objekte (histori)")


if __name__ == "__main__":
    main()
