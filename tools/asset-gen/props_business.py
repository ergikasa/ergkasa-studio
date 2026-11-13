"""Biznesi dhe ekonomia: objektet (lista e prodhimit, kategoria 04).

Asnjë tekst ose numër brenda vizatimeve: kartëmonedhat, faturat dhe raportet tregohen me forma.

Përdorimi: python3 tools/asset-gen/props_business.py
"""
from __future__ import annotations

import random

from props_power import column
from editorial import (INK, P, TABLE_TOP_ABOVE_FLOOR, Defs, circle, contact_shadow, ellipse, g, line, obj, path, poly, rect,
                       run, sheen, star)

MONEY = ["money", "decisions", "growth"]


def banknote(d, x, y, w, h, c1, c2, mark, name, rot=0):
    """Kartëmonedhë pa tekst: kornizë, portret ovale dhe shenja e monedhës."""
    out = (rect(x, y, w, h, d.v(name, c1, c2), rx=8) + rect(x + 10, y + 10, w - 20, h - 20, "none", rx=6, extra=f'stroke="{c2}" stroke-width="3" opacity="0.7"')
           + ellipse(x + w * 0.5, y + h * 0.5, h * 0.3, h * 0.36, c2, 'opacity="0.45"')
           + circle(x + w * 0.5, y + h * 0.42, h * 0.13, c1) + path(f"M{x+w*0.5-h*0.2},{y+h*0.78} Q{x+w*0.5},{y+h*0.5} {x+w*0.5+h*0.2},{y+h*0.78} Z", c1)
           + circle(x + w * 0.15, y + h * 0.5, h * 0.2, "none", f'stroke="{c2}" stroke-width="4" opacity="0.6"')
           + circle(x + w * 0.85, y + h * 0.5, h * 0.2, "none", f'stroke="{c2}" stroke-width="4" opacity="0.6"') + mark(x + w * 0.85, y + h * 0.5, h * 0.13, c2))
    return f'<g transform="rotate({rot} {x + w / 2} {y + h / 2})">{out}</g>' if rot else out


def dollar_mark(cx, cy, r, c):
    return (path(f"M{cx+r*0.7},{cy-r*0.6} Q{cx},{cy-r*1.1} {cx-r*0.6},{cy-r*0.5} Q{cx-r*0.8},{cy} {cx},{cy} Q{cx+r*0.8},{cy} {cx+r*0.6},{cy+r*0.5} Q{cx},{cy+r*1.1} {cx-r*0.7},{cy+r*0.6}",
                 "none", f'stroke="{c}" stroke-width="{r*0.32:.1f}" stroke-linecap="round"') + line(f"M{cx},{cy-r*1.25} V{cy+r*1.25}", c, r * 0.22))


def euro_mark(cx, cy, r, c):
    return (path(f"M{cx+r*0.8},{cy-r*0.75} A{r},{r} 0 1 0 {cx+r*0.8},{cy+r*0.75}", "none", f'stroke="{c}" stroke-width="{r*0.3:.1f}" stroke-linecap="round"')
            + line(f"M{cx-r*1.2},{cy-r*0.25} H{cx+r*0.4} M{cx-r*1.2},{cy+r*0.25} H{cx+r*0.3}", c, r * 0.2))


def bills(d, mark, c1, c2, c3, label, tags, story):
    w, h = 460, 280
    stack = "".join(rect(40, 150 + i * 12, 380, 12, c2 if i % 2 else c1) for i in range(8))
    body = (contact_shadow(d, 230, h, 210, 12)
            + g("stack", stack + rect(170, 150, 40, 96, P["cream"], extra='opacity="0.85"') + rect(40, 150, 380, 6, P["white"], extra='opacity="0.35"'))
            + g("note_1", banknote(d, 40, 40, 380, 150, c1, c3, mark, "n1", -4), (230, 115))
            + g("note_2", banknote(d, 70, 10, 360, 140, c1, c2, mark, "n2", 7), (250, 80)))
    return obj(label, (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.45]}, tags,
               {"note_1": "slide/fall = kartëmonedha që lëvizin", "note_2": "float", "stack": "statike"},
               f"A stack of {label.split()[0].lower()} banknotes with two loose notes on top. No text: a portrait oval and a currency sign only.", story,
               animations=("pop_in", "fade", "slide", "float", "bounce"), themes=MONEY)


def dollar_bills(d: Defs):
    return bills(d, dollar_mark, P["green_l"], P["green"], P["green_dd"], "Kartëmonedha dollari",
                 ["money", "dollar", "cash", "banknotes", "wealth", "salary", "spending", "economy", "usd"],
                 "Cash and wealth: salaries, spending, saving, the psychology of money, inflation.")


def euro_bills(d: Defs):
    return bills(d, euro_mark, P["sky"], P["blue_l"], P["blue_dd"], "Kartëmonedha euro",
                 ["money", "euro", "cash", "banknotes", "europe", "wealth", "spending", "economy", "eur"],
                 "Cash in Europe: prices, salaries, savings and spending; any money story set in the eurozone.")


def coin_stacks(d: Defs):
    w, h = 400, 340

    def stack(x, n, name):
        out = ""
        for i in range(n):
            y = h - 30 - i * 22
            out += ellipse(x, y + 8, 56, 16, P["gold_d"]) + rect(x - 56, y - 8, 112, 16, d.h(name, P["gold_l"], P["gold_d"], P["gold"])) + ellipse(x, y - 8, 56, 16, P["gold_l"])
        top_y = h - 30 - (n - 1) * 22 - 8
        return out + ellipse(x, top_y, 40, 10, "none", f'stroke="{P["gold_d"]}" stroke-width="3"')

    body = (contact_shadow(d, 200, h, 190, 12)
            + g("stack_1", stack(80, 5, "c1"), (80, h)) + g("stack_2", stack(200, 9, "c2"), (200, h)) + g("stack_3", stack(320, 12, "c3"), (320, h)))
    return obj("Stiva monedhash", (w, h), body, {"ground": [0.5, 1.0]},
               ["coins", "savings", "compound-interest", "growth", "money", "investing", "wealth", "small-steps"],
               {"stack_1": "pop_in", "stack_2": "pop_in (pas të parës)", "stack_3": "pop_in (e fundit) = rritje"},
               "Three stacks of gold coins growing from short to tall.",
               "Saving and growth: compound interest, small steps adding up, investing over time.",
               animations=("pop_in", "fade", "slide", "bounce"), themes=MONEY)


def gold_bars(d: Defs):
    w, h = 460, 300

    def bar(x, y, name):
        return (poly([(x, y), (x + 150, y), (x + 170, y + 50), (x - 20, y + 50)], d.v(name + "f", P["gold"], P["gold_d"]))
                + poly([(x + 14, y - 26), (x + 136, y - 26), (x + 150, y), (x, y)], d.v(name + "t", P["warm_light2"], P["gold_l"]))
                + sheen(f"M{x+20},{y-22} H{x+70} L{x+60},{y-4} H{x+10} Z", 0.6))

    body = (contact_shadow(d, 230, h, 210, 14)
            + g("bars", bar(40, 230, "a") + bar(250, 230, "b") + bar(145, 154, "c")))
    return obj("Shufra ari", (w, h), body, {"ground": [0.5, 1.0]},
               ["gold", "gold-bars", "wealth", "safe-haven", "investment", "rich", "value", "treasure", "economy"],
               {"bars": "pop_in, shine"},
               "Three shiny gold bars stacked in a small pyramid.",
               "Store of value and wealth: safe investments, the rich, inflation fears, treasure and greed.",
               animations=("pop_in", "fade", "slide", "pulse"), themes=MONEY)


def safe(d: Defs):
    w, h = 460, 560
    body = (contact_shadow(d, 230, h, 210, 14)
            + g("body", rect(30, 40, 400, 480, d.v("bd", P["slate_l"], P["slate_dd"]), rx=20) + rect(30, 500, 400, 30, P["slate_dd"], rx=8)
                + rect(60, 520, 50, 30, INK, rx=4) + rect(350, 520, 50, 30, INK, rx=4)
                + rect(60, 70, 340, 410, d.v("inside", P["night"], P["night2"]), rx=10)
                + rect(90, 300, 120, 50, d.v("gb", P["gold_l"], P["gold_d"]), rx=6) + rect(230, 300, 140, 50, d.v("cash", P["green_l"], P["green_d"]), rx=6) + rect(70, 360, 320, 10, P["slate"]))
            + g("door", rect(56, 66, 348, 418, d.d("dr", P["steel_l"], P["slate_l"]), rx=16) + rect(76, 86, 308, 378, "none", rx=12, extra=f'stroke="{P["slate"]}" stroke-width="5"')
                + circle(230, 260, 70, d.d("dial", P["steel_l"], P["steel_dd"])) + circle(230, 260, 44, P["slate"])
                + "".join(rect(228, 196, 4, 14, P["steel_l"], extra=f'transform="rotate({a} 230 260)"') for a in range(0, 360, 30))
                + rect(310, 230, 60, 18, P["steel_dd"], rx=8) + rect(330, 200, 18, 80, P["steel_d"], rx=8)
                + "".join(rect(400, y, 16, 46, P["steel_dd"], rx=4) for y in (120, 380)), (56, 275)))
    return obj("Kasafortë", (w, h), body, {"ground": [0.5, 1.0], "dial": [0.5, 260 / h]},
               ["safe", "vault", "security", "savings", "secrets", "wealth", "protection", "loss-aversion", "locked"],
               {"door": "scaleX 1 → 0.1 = hapet dhe zbulon arin dhe paratë", "body": "statik"},
               "A heavy dark steel safe with a combination dial; behind the door there are gold bars and cash.",
               "Protecting what you have: savings, loss aversion, security versus risk, secrets locked away.",
               animations=("pop_in", "fade", "slide", "shake"), themes=MONEY)


def classical_facade(d, w, h, n_cols, body_light, body_dark, pediment=True, name="fc"):
    from props_power import column  # noqa: PLC0415
    top = 160 if pediment else 60
    out = (rect(0, h - 70, w, 70, d.v(name + "st", P["marble"], P["marble_d"])) + rect(30, h - 110, w - 60, 44, P["marble_l"])
           + rect(50, top + 80, w - 100, h - top - 190, d.v(name + "wall", body_light, body_dark)))
    if pediment:
        out += poly([(20, top), (w / 2, 20), (w - 20, top)], d.v(name + "pd", P["marble_l"], P["marble_d"])) + poly([(90, top - 16), (w / 2, 54), (w - 90, top - 16)], P["marble_d"], 'opacity="0.5"')
    out += rect(20, top, w - 40, 50, d.v(name + "ent", P["marble_l"], P["marble_d"])) + rect(40, top + 50, w - 80, 30, P["marble_d"])
    gap = (w - 140) / (n_cols - 1)
    out += "".join(column(d, 70 + i * gap, top + 80, h - 110, 70, f"{name}c{i}") for i in range(n_cols))
    return out


def bank_building(d: Defs):
    w, h = 900, 780
    body = (contact_shadow(d, 450, h, 440, 20)
            + g("building", classical_facade(d, w, h, 6, P["sand"], P["sand3"]))
            + g("door", rect(390, h - 330, 120, 220, d.v("dr", P["wood_dd"], P["wood_ddd"]), rx=6) + rect(380, h - 340, 140, 14, P["gold_d"]))
            + circle(450, 120, 30, d.d("seal", P["gold_l"], P["gold_d"])) + star(450, 120, 18, 8, 5, P["gold_d"]))
    return obj("Ndërtesë banke (klasike)", (w, h), body, {"ground": [0.5, 1.0], "door": [0.5, (h - 110) / h]},
               ["bank", "finance", "institution", "trust", "money", "loans", "economy", "history", "power"],
               {"building": "statike", "door": "statike"},
               "A classical bank building with six marble columns, a pediment with a gold seal, steps and a heavy wooden door. No text.",
               "Banks and trust in institutions: loans, debt, financial crises, the history of money, old money and power.",
               themes=["money", "decisions", "philosophy"])


def stock_chart(d: Defs):
    w, h = 680, 440
    rng = random.Random(9)
    candles, y = "", 330
    for i in range(16):
        x = 70 + i * 34
        target = 340 - i * 15                      # trendi rritet, por qëndron brenda ekranit
        c = max(90, min(370, target + rng.uniform(-30, 30)))
        o = y
        dy = c - o
        up = c < o
        col = P["green_l"] if up else P["red_l"]
        candles += line(f"M{x+9},{min(o,c)-rng.uniform(10,30):.0f} V{max(o,c)+rng.uniform(10,30):.0f}", col, 3) + rect(x, min(o, c), 18, max(abs(dy), 6), col, rx=2)
        y = c
    body = (g("screen", rect(0, 0, w, h, d.d("bz", P["slate"], P["slate_dd"]), rx=22) + rect(18, 18, w - 36, h - 36, d.v("sc", P["night2"], P["night"]), rx=12)
              + "".join(line(f"M40,{y2} H{w-40}", P["night3"], 2) for y2 in range(80, h - 30, 60)))
            + g("candles", candles)
            + g("trend", path("M60,330 Q200,300 300,250 T620,90", "none", f'stroke="{P["gold"]}" stroke-width="5" opacity="0.85"'))
            + sheen(f"M18,18 H220 L120,{h - 18} Z", 0.06))
    return obj("Grafik i bursës", (w, h), body, {"center": [0.5, 0.5]},
               ["stocks", "stock-market", "trading", "investing", "chart", "volatility", "bull-market", "speculation", "economy"],
               {"candles": "fade/slide = qirinjtë shfaqen", "trend": "fade", "screen": "statik"},
               "A dark trading screen with green and red candlesticks rising and a gold trend line. No numbers.",
               "Markets and investing: volatility, speculation, herd behaviour, FOMO, bull and bear markets.",
               animations=("pop_in", "fade", "slide", "pulse"), themes=MONEY)


def growth_chart(d: Defs, mode: str = "up"):
    w, h = 560, 480
    hs = [80, 130, 190, 260, 340] if mode == "up" else [340, 260, 190, 130, 80]
    c1, c2 = (P["teal"], P["teal_d"]) if mode == "up" else (P["red_l"], P["red_d"])
    bars = ""
    for i, bh in enumerate(hs):
        x = 60 + i * 92
        bars += (poly([(x, h - 40 - bh), (x + 60, h - 40 - bh), (x + 60, h - 40), (x, h - 40)], d.v(f"b{i}", c1, c2))
                 + poly([(x + 60, h - 40 - bh), (x + 80, h - 54 - bh), (x + 80, h - 54), (x + 60, h - 40)], c2)
                 + poly([(x, h - 40 - bh), (x + 20, h - 54 - bh), (x + 80, h - 54 - bh), (x + 60, h - 40 - bh)], c1, 'opacity="0.7"'))
    if mode == "up":
        arrow = path("M50,360 L200,250 L290,290 L470,110", "none", f'stroke="{P["gold"]}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"') + poly([(430, 90), (510, 70), (490, 150)], P["gold"])
    else:
        arrow = path("M50,90 L200,200 L290,170 L470,360", "none", f'stroke="{P["red"]}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"') + poly([(430, 380), (510, 400), (490, 320)], P["red"])
    body = (contact_shadow(d, 280, h, 260, 14) + rect(30, h - 44, 500, 10, P["slate_d"], rx=4) + g("bars", bars) + g("arrow", arrow))
    up = mode == "up"
    return obj("Grafik rritjeje" if up else "Grafik rënieje", (w, h), body, {"ground": [0.5, 1.0]},
               ["chart", "growth" if up else "decline", "progress" if up else "loss", "success" if up else "crisis", "business", "economy", "trend", "profit" if up else "recession"],
               {"bars": "pop_in një nga një", "arrow": "fade/slide"},
               "Five 3D bars rising from left to right with a gold arrow going up. Variant `down`: red bars falling and a red arrow down.",
               "Growth and progress (or decline): profits and losses, a company or habit improving, a recession, things getting worse.",
               animations=("pop_in", "fade", "slide", "bounce"), variants={"down": "down.svg"} if up else {}, themes=MONEY)


def calculator(d: Defs):
    w, h = 260, 380
    keys = "".join(rect(34 + c * 50, 150 + r * 50, 40, 40, (P["orange"] if c == 3 else P["steel_l"] if r == 0 else P["white"]), rx=8)
                   for r in range(4) for c in range(4))
    body = (contact_shadow(d, 130, h, 110, 8)
            + g("calc", rect(14, 14, 232, 352, d.v("cs", P["slate_l"], P["slate_dd"]), rx=24)
                + rect(34, 40, 192, 80, d.v("lcd", P["green_l"], P["green"]), rx=8) + rect(130, 70, 80, 30, P["green_dd"], rx=4, extra='opacity="0.35"')
                + keys))
    return obj("Kalkulator financiar", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.5]},
               ["calculator", "math", "budget", "accounting", "costs", "rational", "numbers", "finance", "planning"],
               {"calc": "pop_in, shake"},
               "A dark grey calculator with a green display and orange operation keys. No digits.",
               "Doing the maths: budgets, costs versus benefits, rational decisions versus emotional ones.", themes=MONEY)


def laptop_front(d: Defs):
    w, h = 560, 380
    body = (contact_shadow(d, 280, h, 260, 12)
            + g("lid", rect(80, 10, 400, 270, d.d("lid", P["steel_l"], P["steel_dd"]), rx=16) + rect(96, 26, 368, 236, d.v("sc", P["blue"], P["night2"]), rx=6)
                + ellipse(280, 144, 170, 100, d.glow("gl", P["screen"], 0.45, 0.0)) + sheen("M96,26 H220 L140,262 H96 Z", 0.1))
            + g("base", poly([(40, 300), (520, 300), (560, 350), (0, 350)], d.v("bs", P["steel_l"], P["steel_d"]))
                + poly([(84, 306), (476, 306), (500, 332), (60, 332)], P["steel_d"], 'opacity="0.5"') + rect(230, 336, 100, 8, P["steel_dd"], rx=4)
                + rect(0, 346, 560, 12, P["steel_dd"], rx=6)))
    return obj("Laptop (pamje ballore)", (w, h), body, {"ground": [0.5, 0.95], "screen": [0.5, 144 / h], "top": [0.5, 0.95]},
               ["laptop", "computer", "work", "remote-work", "tech", "productivity", "online", "screen", "study"],
               {"lid": "statik; vendos përmbajtje mbi anchor `screen`", "base": "statike"},
               "An open silver laptop seen from the front with a glowing blue screen.",
               "Work and study, remote work, endless screen time, online life. Put any content on the screen anchor.",
               themes=["money", "growth", "psychology"])


def desktop_computer(d: Defs):
    w, h = 640, 560
    body = (contact_shadow(d, 320, h, 300, 14)
            + g("monitor", rect(80, 10, 480, 300, d.d("bz", P["slate"], P["slate_dd"]), rx=16) + rect(98, 28, 444, 264, d.v("sc", P["sky"], P["blue"]), rx=6)
                + rect(130, 60, 180, 110, P["white"], rx=6, extra='opacity="0.75"') + rect(330, 60, 180, 200, P["white"], rx=6, extra='opacity="0.45"')
                + rect(130, 190, 180, 70, P["white"], rx=6, extra='opacity="0.45"')
                + rect(296, 310, 48, 90, d.h("nk", P["steel_l"], P["steel_d"])) + ellipse(320, 404, 110, 18, P["steel_d"]))
            + g("keyboard", poly([(120, 470), (500, 470), (530, 520), (90, 520)], d.v("kb", P["steel_l"], P["steel_d"]))
                + "".join(rect(124 + i * 30, 480, 22, 12, P["white"], rx=3) for i in range(13)) + "".join(rect(116 + i * 31, 498, 23, 12, P["white"], rx=3) for i in range(13)))
            + g("mouse", ellipse(580, 500, 26, 36, d.d("ms", P["white"], P["steel"]))))
    return obj("Kompjuter tavoline", (w, h), body, {"ground": [0.5, 1.0], "screen": [0.5, 160 / h]},
               ["computer", "desktop", "office", "work", "screen", "productivity", "data", "tech", "routine"],
               {"monitor": "statik; përmbajtje mbi anchor `screen`", "keyboard": "statike", "mouse": "statik"},
               "A desktop monitor with windows on screen, a keyboard and a mouse, seen from the front.",
               "Office work and routine: emails, spreadsheets, staring at a screen all day, data and productivity.",
               themes=["money", "growth", "psychology"])


def smartphone(d: Defs):
    w, h = 240, 460
    body = (contact_shadow(d, 120, h, 90, 8, 0.2)
            + g("phone", rect(10, 10, 220, 440, d.d("cs", P["slate"], INK), rx=34) + rect(22, 22, 196, 416, d.v("sc", P["violet"], P["blue_dd"]), rx=26)
                + rect(90, 30, 60, 16, INK, rx=8)
                + "".join(rect(40 + (i % 4) * 44, 80 + (i // 4) * 54, 32, 32, c, rx=9) for i, c in enumerate(
                    [P["red"], P["gold"], P["teal"], P["sky"], P["green"], P["orange"], P["white"], P["red_l"], P["blue_l"], P["gold_l"], P["green_l"], P["pink"]]))
                + rect(36, 356, 168, 60, P["white"], rx=16, extra='opacity="0.85"') + circle(64, 386, 14, P["red"]) + rect(88, 374, 96, 10, P["slate_l"], rx=5) + rect(88, 392, 64, 8, P["steel"], rx=4)
                + sheen("M22,22 H110 L40,438 H22 Z", 0.12)))
    return obj("Smartphone", (w, h), body, {"center": [0.5, 0.5], "screen": [0.5, 0.5]},
               ["smartphone", "phone", "apps", "notifications", "social-media", "addiction", "dopamine", "screen-time", "tech"],
               {"phone": "pop_in, shake (njoftim), float"},
               "A large modern smartphone with colourful app icons and a notification banner. No text.",
               "Phone addiction and dopamine: notifications, social media, screen time, the attention economy.",
               animations=("pop_in", "fade", "slide", "shake", "float"), themes=["psychology", "money", "decisions"])


def office_desk_front(d: Defs):
    w, h = 900, 372
    top = h - TABLE_TOP_ABOVE_FLOOR
    body = (contact_shadow(d, 450, h, 440, 16)
            + g("desk", rect(0, top, w, 30, d.v("tp", P["wood_l"], P["wood"]), rx=8) + rect(0, top + 22, w, 8, P["wood_d"], rx=4)
                + rect(30, top + 30, 240, h - top - 30, d.v("pl", P["wood"], P["wood_dd"])) + rect(630, top + 30, 240, h - top - 30, d.v("pr", P["wood"], P["wood_dd"]))
                + "".join(rect(x + 16, y, 208, 80, P["wood_d"], rx=6) + rect(x + 96, y + 34, 48, 10, P["gold_d"], rx=5) for x in (30, 630) for y in (top + 50, top + 150, top + 250) if y + 80 < h)
                + rect(270, top + 30, 360, 60, d.v("md", P["wood_d"], P["wood_dd"])) + rect(420, top + 54, 60, 10, P["gold_d"], rx=5)))
    return obj("Tavolinë zyre (pamje ballore)", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, top / h]},
               ["desk", "office", "work", "furniture", "job", "workplace", "career", "boss"],
               {"desk": "shtresë përpara: mbulon personazhin pas saj"},
               "A wooden office desk seen from the front with drawers on both sides. Same height as the other desks.",
               "A front-facing desk for a character sitting or standing behind it: the boss, an interview, a job.",
               themes=["money", "decisions", "growth"])


def paper(d, x, y, w, h, name, lines_n=8, rot=0):
    out = (rect(x + 6, y + 8, w, h, P["marble_d"], rx=6) + rect(x, y, w, h, d.v(name, P["white"], P["cream2"]), rx=6)
           + "".join(rect(x + 30, y + 60 + i * 30, (w - 60) * (0.6 if i % 3 == 2 else 1), 8, P["cream3"], rx=4) for i in range(lines_n)))
    return f'<g transform="rotate({rot} {x + w / 2} {y + h / 2})">{out}</g>' if rot else out


def contract(d: Defs):
    w, h = 380, 480
    body = (contact_shadow(d, 190, h, 150, 10, 0.18)
            + g("paper", paper(d, 30, 20, 320, 440, "pp", 9) + rect(60, 40, 160, 18, P["slate_l"], rx=6)
                + line("M60,400 H200", P["slate_d"], 3)
                + path("M70,392 Q86,360 100,392 T130,388 Q144,370 156,390 Q170,402 196,382", "none", f'stroke="{P["blue_dd"]}" stroke-width="5" stroke-linecap="round"')
                + circle(290, 390, 38, d.d("seal", P["red_l"], P["red_d"])) + star(290, 390, 22, 10, 10, P["red_d"])
                + path("M270,420 L262,470 L282,454 L294,474 L300,424 Z", P["red"])))
    return obj("Kontratë", (w, h), body, {"center": [0.5, 0.5]},
               ["contract", "agreement", "legal", "deal", "commitment", "terms", "fine-print", "obligation", "business"],
               {"paper": "pop_in, slide"},
               "A signed contract: lines of text as grey bars, a blue signature and a red wax seal with a ribbon. No readable text.",
               "Agreements and obligations: the fine print, commitments that are hard to undo, legal deals.", themes=MONEY)


def invoice(d: Defs):
    w, h = 280, 500
    zig = " ".join(f"L{20 + i * 20},{h - 20 if i % 2 == 0 else h - 40}" for i in range(13))
    body = (contact_shadow(d, 140, h, 110, 8, 0.15)
            + g("receipt", path(f"M20,10 H260 V{h-30} {zig} Z", d.v("rc", P["white"], P["cream2"]))
                + rect(50, 40, 180, 22, P["slate_l"], rx=6)
                + "".join(rect(40, 100 + i * 34, 120, 8, P["cream3"], rx=4) + rect(190, 100 + i * 34, 50, 8, P["cream3"], rx=4) for i in range(7))
                + line("M40,350 H240", P["slate_d"], 3, 'stroke-dasharray="8 6"')
                + rect(40, 372, 100, 16, P["slate_d"], rx=6) + rect(170, 366, 70, 26, P["red"], rx=6)))
    return obj("Faturë", (w, h), body, {"center": [0.5, 0.5]},
               ["invoice", "receipt", "bill", "cost", "expenses", "pain-of-paying", "budget", "spending", "debt"],
               {"receipt": "slide lart = fatura del; shake = tronditje"},
               "A long paper receipt with item lines as grey bars and a red total box at the bottom. No digits.",
               "The real cost: the pain of paying, unexpected bills, hidden fees, looking at what you actually spent.", themes=MONEY)


def financial_report(d: Defs):
    w, h = 400, 500
    body = (contact_shadow(d, 200, h, 160, 10, 0.18)
            + g("report", paper(d, 40, 30, 320, 440, "pp", 0) + rect(70, 60, 200, 20, P["blue_d"], rx=6)
                + circle(140, 180, 60, P["teal"]) + path("M140,180 L140,120 A60,60 0 0 1 196,198 Z", P["gold"]) + path("M140,180 L196,198 A60,60 0 0 1 110,232 Z", P["red_l"])
                + "".join(rect(230 + i * 26, 230 - hh, 18, hh, P["blue"]) for i, hh in enumerate((40, 70, 56, 100)))
                + path("M70,380 L130,340 L190,360 L250,300 L320,320", "none", f'stroke="{P["teal"]}" stroke-width="6" stroke-linecap="round"')
                + "".join(rect(70, 270 + i * 22, 250, 8, P["cream3"], rx=4) for i in range(2))
                + "".join(rect(70, 410 + i * 22, 250 * (0.7 if i else 1), 8, P["cream3"], rx=4) for i in range(2))))
    return obj("Raport financiar", (w, h), body, {"center": [0.5, 0.5]},
               ["report", "finance", "data", "analysis", "results", "earnings", "accounting", "business", "numbers"],
               {"report": "pop_in, slide"},
               "A financial report page with a pie chart, a bar chart and a line chart. No numbers or text.",
               "Business results and analysis: quarterly reports, earnings, looking at the data before deciding.", themes=MONEY)


def notebook(d: Defs):
    w, h = 320, 420
    body = (contact_shadow(d, 160, h, 130, 10)
            + g("notebook", rect(30, 20, 260, 380, P["cream2"], rx=10) + rect(20, 14, 260, 380, d.d("cv", P["wood"], P["wood_ddd"]), rx=14)
                + rect(230, 14, 22, 380, d.h("band", P["slate"], INK)) + rect(40, 80, 160, 40, P["wood_l"], rx=6, extra='opacity="0.35"')
                + path("M120,394 V430 L134,416 L148,430 V394 Z", P["red"]) + sheen("M36,26 H140 L60,380 H36 Z", 0.12)))
    return obj("Bllok shënimesh biznesi", (w, h), body, {"center": [0.5, 0.5]},
               ["notebook", "notes", "planning", "ideas", "journal", "goals", "business", "strategy", "writing"],
               {"notebook": "pop_in, slide"},
               "A closed brown leather notebook with a black elastic band and a red ribbon bookmark.",
               "Planning and ideas: writing goals, journaling, a business plan, keeping notes.", themes=["growth", "money", "decisions"])


def pen(d: Defs):
    w, h = 420, 100
    body = g("pen", f'<g transform="rotate(-12 210 50)">'
             + rect(60, 34, 240, 34, d.v("bd", P["slate_l"], INK), rx=17) + rect(290, 34, 50, 34, d.v("gd", P["gold_l"], P["gold_d"]), rx=6)
             + path("M340,38 L400,51 L340,64 Z", d.v("nib", P["gold_l"], P["gold_d"])) + line("M352,51 H392", P["gold_d"], 2)
             + rect(40, 30, 40, 42, d.v("cap", P["gold_l"], P["gold_d"]), rx=10) + rect(80, 24, 150, 10, P["gold"], rx=5)
             + sheen("M70,38 H280 V44 H70 Z", 0.4) + "</g>", (210, 50))
    return obj("Stilolaps (pendë)", (w, h), body, {"center": [0.5, 0.5], "tip": [0.94, 0.4]},
               ["pen", "writing", "signature", "decision", "commitment", "contract", "planning", "journal"],
               {"pen": "rotation/slide = shkruan"},
               "A black fountain pen with a gold nib, clip and bands.",
               "Writing and committing: signing, putting plans on paper, journaling, a decision made official.",
               themes=["money", "decisions", "growth"])


def factory(d: Defs):
    w, h = 980, 760
    body = (contact_shadow(d, 490, h, 480, 20)
            + g("smoke", "".join(circle(x, y, r, P["steel"], 'opacity="0.55"') for x, y, r in [(160, 90, 50), (200, 50, 60), (250, 20, 46), (300, 140, 40), (340, 100, 52), (390, 70, 40)]), (220, 160))
            + g("building", rect(150, 160, 60, 300, d.h("ch1", P["red"], P["red_d"])) + rect(290, 220, 50, 240, d.h("ch2", P["red"], P["red_d"]))
                + rect(144, 156, 72, 20, P["slate_d"]) + rect(284, 216, 62, 18, P["slate_d"])
                + rect(40, 420, 900, h - 460, d.v("wall", P["red_l"], P["red_d"]))
                + poly([(40, 420), (40, 340), (220, 420), (220, 340), (400, 420), (400, 340), (580, 420), (580, 340), (760, 420), (760, 340), (940, 420)], d.v("roof", P["slate_l"], P["slate_d"]))
                + "".join(rect(80 + i * 140, 480, 90, 110, d.v(f"w{i}", P["sky_l"], P["glass"]), rx=4) + line(f"M{125 + i * 140},480 V590 M{80 + i * 140},535 H{170 + i * 140}", P["red_d"], 5) for i in range(6))
                + rect(400, 620, 180, h - 660, d.v("gate", P["slate"], P["slate_dd"])) + "".join(line(f"M400,{y} H580", P["slate_l"], 3) for y in range(640, h - 40, 24))))
    return obj("Fabrikë", (w, h), body, {"ground": [0.5, 1.0]},
               ["factory", "industry", "production", "manufacturing", "industrial-revolution", "work", "economy", "pollution", "jobs"],
               {"smoke": "float/fade = tymi del", "building": "statike"},
               "A brick factory with a saw-tooth roof, tall chimneys with smoke, windows and a loading gate.",
               "Industry and production: the industrial revolution, factory jobs, mass production, pollution, the economy.",
               themes=["money", "science", "decisions"])


def production_machine(d: Defs):
    w, h = 860, 560
    boxes = "".join(rect(x, 300, 80, 70, d.v(f"bx{i}", P["wood_l"], P["wood_d"]), rx=4) + rect(x + 30, 300, 20, 70, P["parch"], extra='opacity="0.6"') for i, x in enumerate((60, 330, 600)))
    body = (contact_shadow(d, 430, h, 420, 18)
            + g("conveyor", rect(20, 370, 820, 40, d.v("belt", P["slate"], P["slate_dd"]), rx=20) + "".join(circle(x, 390, 14, P["steel_d"]) for x in range(50, 830, 70))
                + "".join(rect(x, 410, 20, h - 440, P["slate_d"]) for x in (80, 420, 760)))
            + g("boxes", boxes)
            + g("press", rect(260, 60, 260, 70, d.v("pt", P["gold"], P["gold_d"]), rx=10) + rect(280, 130, 30, 170, P["steel_d"]) + rect(470, 130, 30, 170, P["steel_d"])
                + rect(240, 40, 300, 30, P["slate_d"], rx=8) + circle(390, 95, 18, P["red"]))
            + g("piston", rect(370, 130, 40, 100, d.h("ps", P["steel_l"], P["steel_dd"])) + rect(320, 230, 140, 30, d.v("ph", P["steel"], P["steel_dd"]), rx=6), (390, 130)))
    return obj("Makineri prodhimi", (w, h), body, {"ground": [0.5, 1.0]},
               ["machine", "production", "automation", "assembly-line", "efficiency", "industry", "routine", "system"],
               {"piston": "y lart-poshtë = shtyp", "boxes": "slide (x) mbi rripin", "conveyor": "statik"},
               "A conveyor belt with cardboard boxes passing under a yellow hydraulic press.",
               "Automation and routine: assembly lines, efficiency, people as cogs in a system, mass production.",
               themes=["money", "science", "decisions"])


def warehouse(d: Defs):
    w, h = 1000, 600
    body = (contact_shadow(d, 500, h, 490, 20)
            + g("building", path(f"M40,{h-30} V220 Q500,40 960,220 V{h-30} Z", d.v("wall", P["steel_l"], P["steel_d"]))
                + "".join(line(f"M{x},{220 - (40 if 300 < x < 700 else 0)} V{h-30}", P["steel_d"], 3, 'opacity="0.6"') for x in range(80, 960, 40))
                + path("M30,226 Q500,30 970,226", "none", f'stroke="{P["slate_d"]}" stroke-width="16"')
                + "".join(rect(x, 360, 200, h - 390, d.v(f"dr{x}", P["slate_l"], P["slate_d"])) + "".join(line(f"M{x},{y} H{x+200}", P["slate_dd"], 3) for y in range(380, h - 30, 22)) for x in (110, 400, 690))
                + "".join(rect(x, 240, 140, 40, P["glass"], rx=4) for x in (220, 430, 640))))
    return obj("Magazinë", (w, h), body, {"ground": [0.5, 1.0]},
               ["warehouse", "logistics", "storage", "supply-chain", "inventory", "industry", "distribution", "economy"],
               {"building": "statike"},
               "A large metal warehouse with a curved roof and three roller doors.",
               "Logistics and supply chains: storage, inventory, online shopping, how goods move through the economy.",
               themes=["money", "decisions", "science"])


def shipping_container(d: Defs):
    """Kontejner 20 këmbësh në 3/4: ana e gjatë me brinjë valore, dyert përpara me shufra kyçjeje, kulmi."""
    w, h = 900, 420
    x0, x1, top, bot = 40, 640, 80, 380          # ana e gjatë
    dx, dy = 210, -50                              # thellësia drejt dyerve (djathtas, lart)
    side = rect(x0, top, x1 - x0, bot - top, d.v("side", P["orange"], P["orange_d"]))
    ribs = "".join(rect(x, top + 10, 14, bot - top - 20, P["orange_d"], extra='fill-opacity="0.55"')
                   + rect(x + 14, top + 10, 6, bot - top - 20, P["gold_l"], extra='fill-opacity="0.35"') for x in range(x0 + 22, x1 - 20, 30))
    frame = (rect(x0, top, x1 - x0, 14, P["red_d"]) + rect(x0, bot - 16, x1 - x0, 16, P["red_d"])
             + rect(x0, top, 18, bot - top, P["red_d"]) + rect(x1 - 18, top, 18, bot - top, P["red_d"]))
    roof = poly([(x0, top), (x1, top), (x1 + dx, top + dy), (x0 + dx, top + dy)], d.d("roof", P["gold"], P["orange_d"]))
    front = poly([(x1, top), (x1 + dx, top + dy), (x1 + dx, bot + dy), (x1, bot)], d.h("front", P["orange_d"], P["red_d"]))
    door_line = line(f"M{x1 + dx / 2},{top + dy / 2 + 6} L{x1 + dx / 2},{bot + dy / 2 - 6}", P["red_d"], 5)
    bars = "".join(line(f"M{x1 + dx * t},{top + dy * t + 16} L{x1 + dx * t},{bot + dy * t - 14}", P["steel_d"], 6)
                   + rect(x1 + dx * t - 10, (top + bot) / 2 + dy * t - 8, 20, 16, P["steel_dd"], rx=3) for t in (0.18, 0.36, 0.64, 0.82))
    corners = "".join(rect(x, y, 22, 22, P["slate_d"], rx=3) for x, y in ((x0 - 2, top - 2), (x0 - 2, bot - 20), (x1 - 20, top - 2), (x1 - 20, bot - 20)))
    body = (contact_shadow(d, (x0 + x1 + dx) / 2, h, 440, 18)
            + g("container", roof + side + ribs + frame + front + door_line + bars + corners))
    return obj("Kontejner transporti", (w, h), body, {"ground": [0.5, 1.0]},
               ["container", "shipping", "trade", "globalization", "import", "export", "supply-chain", "logistics", "economy"],
               {"container": "slide (x) / pop_in"},
               "An orange corrugated steel shipping container seen from the side.",
               "Global trade: imports and exports, globalization, supply chain shocks, how cheap goods reach us.",
               themes=["money", "decisions", "science"])


def delivery_truck(d: Defs):
    w, h = 960, 460
    wheel = lambda x: circle(x, 390, 56, P["slate_dd"]) + circle(x, 390, 30, P["steel"]) + circle(x, 390, 10, P["slate_d"])
    body = (contact_shadow(d, 480, h, 460, 16)
            + g("truck", rect(20, 60, 620, 310, d.v("box", P["white"], P["cream3"]), rx=10) + rect(40, 120, 300, 80, P["teal"], rx=10, extra='opacity="0.85"')
                + rect(40, 210, 200, 18, P["teal"], rx=8, extra='opacity="0.6"')
                + path("M640,150 H800 Q850,150 880,230 L930,280 V370 H640 Z", d.v("cab", P["teal"], P["teal_d"]))
                + path("M680,170 H790 Q826,170 846,232 H680 Z", d.v("win", P["sky_l"], P["glass"]))
                + rect(900, 300, 40, 24, P["gold_l"], rx=6) + rect(20, 360, 920, 20, P["slate_d"], rx=6)
                + wheel(150) + wheel(510) + wheel(800)))
    return obj("Kamion dorëzimi", (w, h), body, {"ground": [0.5, 1.0]},
               ["truck", "delivery", "logistics", "shipping", "online-shopping", "transport", "business", "supply-chain"],
               {"truck": "slide (x) = arrin/ikën"},
               "A white box delivery truck with a teal cab, seen from the side. No logo or text.",
               "Deliveries and online shopping: next-day delivery, logistics, small businesses growing, supply chains.",
               themes=["money", "decisions", "science"])


def shop_front(d: Defs):
    w, h = 860, 760
    stripes = "".join(poly([(60 + i * 74, 200), (134 + i * 74, 200), (134 + i * 74 + 10, 290), (60 + i * 74 + 10, 290)], P["red"] if i % 2 == 0 else P["white"]) for i in range(10))
    goods = "".join(rect(x, 520 - hh, 40, hh, c, rx=6) for x, hh, c in [(120, 90, P["gold"]), (170, 70, P["teal"]), (220, 110, P["red_l"]), (270, 80, P["blue_l"]),
                                                                      (560, 100, P["green_l"]), (610, 76, P["orange"]), (660, 92, P["violet"]), (710, 70, P["gold_l"])])
    body = (contact_shadow(d, 430, h, 420, 18)
            + g("building", rect(40, 60, 780, h - 90, d.v("wall", P["sand"], P["sand3"])) + rect(30, 50, 800, 40, P["slate_d"], rx=6)
                + rect(80, 110, 700, 70, P["slate"], rx=8)
                + rect(90, 330, 250, 220, d.v("w1", P["sky_l"], P["glass"]), rx=6) + rect(520, 330, 250, 220, d.v("w2", P["sky_l"], P["glass"]), rx=6)
                + goods + rect(90, 520, 250, 30, P["wood"]) + rect(520, 520, 250, 30, P["wood"])
                + rect(370, 320, 120, h - 350, d.v("dr", P["teal"], P["teal_d"]), rx=6) + rect(386, 340, 88, 150, d.v("dw", P["sky_l"], P["glass"]), rx=4) + circle(466, 560, 9, P["gold"]))
            + g("awning", stripes + path("M60,290 " + " ".join(f"Q{97 + i * 74},{320} {134 + i * 74},290" for i in range(10)), P["red_d"], 'opacity="0.5"'), (430, 200)))
    return obj("Dyqan (fasadë)", (w, h), body, {"ground": [0.5, 1.0], "door": [430 / w, 1.0]},
               ["shop", "store", "retail", "small-business", "consumer", "shopping", "entrepreneur", "main-street"],
               {"building": "statike", "awning": "statike"},
               "A small shop front with a red-and-white striped awning, display windows with goods and a teal door. The sign board is blank.",
               "Retail and small business: shopping habits, entrepreneurs, the local shop versus the big chain.",
               themes=["money", "decisions", "growth"])


def shopping_cart(d: Defs):
    w, h = 460, 420
    wire = P["steel_d"]
    body = (contact_shadow(d, 230, h, 200, 12)
            + g("cart", poly([(70, 80), (420, 80), (380, 270), (120, 270)], P["steel_l"], 'opacity="0.35"')
                + "".join(line(f"M{70 + i * 35},{80} L{120 + i * 26},{270}", wire, 4) for i in range(11))
                + "".join(line(f"M{70 + j * 6},{80 + j * 38} H{420 - j * 8}", wire, 4) for j in range(6))
                + line("M10,40 H60 L70,80", P["slate_dd"], 12) + rect(0, 30, 50, 22, P["red"], rx=8)
                + line("M120,270 L140,340 H380 M380,270 L380,340", wire, 8)
                + circle(160, 370, 26, P["slate_dd"]) + circle(360, 370, 26, P["slate_dd"]) + circle(160, 370, 10, P["steel"]) + circle(360, 370, 10, P["steel"])))
    return obj("Karrocë blerjesh", (w, h), body, {"ground": [0.5, 1.0], "inside": [0.55, 0.4]},
               ["shopping-cart", "consumer", "supermarket", "impulse-buying", "spending", "consumerism", "shopping"],
               {"cart": "slide (x)"},
               "An empty wire shopping cart with a red handle, seen from the side.",
               "Consumer behaviour: impulse buying, spending more than planned, supermarket psychology, consumerism.",
               themes=["money", "psychology", "decisions"])


def office_tower(d: Defs):
    w, h = 560, 1340
    rows = "".join(rect(80 + c * 80, 120 + r * 70, 70, 60, d.v(f"g{(r + c) % 3}", P["sky_l"] if (r + c) % 3 else P["sky"], P["glass"])) for r in range(17) for c in range(5))
    body = (contact_shadow(d, 280, h, 260, 18)
            + g("tower", rect(60, 100, 440, h - 130, d.h("tw", P["blue_l"], P["blue_dd"], P["blue"])) + rows
                + rect(40, 80, 480, 30, P["slate_d"]) + rect(250, 20, 60, 60, P["slate_l"]) + line("M280,20 V-40", P["slate_d"], 6)
                + rect(200, h - 130, 160, 100, d.v("ent", P["slate_l"], P["slate_d"])) + rect(60, h - 40, 440, 10, P["slate_dd"])
                + poly([(60, 100), (180, 100), (60, 600)], P["white"], 'opacity="0.18"')))
    return obj("Kullë zyrash (pasuri e paluajtshme)", (w, h), body, {"ground": [0.5, 1.0]},
               ["skyscraper", "office-tower", "real-estate", "corporation", "city", "business", "wealth", "property", "investment"],
               {"tower": "statike"},
               "A tall modern glass office tower with a blue facade and a dark entrance.",
               "Real estate and big business: corporate power, property investment, the city economy.",
               themes=["money", "decisions", "growth"])


def house(d: Defs):
    w, h = 640, 600
    body = (contact_shadow(d, 320, h, 300, 16)
            + g("house", rect(440, 70, 50, 120, d.h("chm", P["red"], P["red_d"])) + rect(80, 250, 480, h - 280, d.v("wall", P["cream"], P["sand2"]))
                + poly([(40, 270), (320, 60), (600, 270)], d.v("roof", P["red_l"], P["red_d"])) + rect(30, 262, 580, 22, P["red_d"], rx=6)
                + rect(270, 400, 100, h - 430, d.v("dr", P["wood"], P["wood_dd"]), rx=6) + circle(350, 500, 8, P["gold"])
                + "".join(rect(x, 340, 110, 100, P["white"]) + rect(x + 10, 350, 90, 80, d.v(f"wn{x}", P["sky_l"], P["glass"])) + line(f"M{x+55},350 V430 M{x+10},390 H{x+100}", P["white"], 6) for x in (120, 410))
                + circle(320, 190, 36, P["white"]) + circle(320, 190, 28, d.v("rw", P["sky_l"], P["glass"]))
                + rect(30, h - 30, 580, 10, P["green"], rx=4)))
    return obj("Shtëpi", (w, h), body, {"ground": [0.5, 1.0], "door": [0.5, 1.0]},
               ["house", "home", "real-estate", "mortgage", "family", "property", "dream", "security", "suburb"],
               {"house": "statike"},
               "A simple family house with a red roof, chimney, two windows and a wooden door.",
               "Home and property: buying a house, mortgages, the family dream, security, the housing market.",
               themes=["money", "decisions", "growth"])


def apartment_building(d: Defs):
    w, h = 640, 1060
    windows = "".join(rect(90 + c * 120, 120 + r * 110, 80, 76, d.v(f"aw{(r * 3 + c) % 4}", P["warm_light"] if (r * 3 + c) % 4 == 0 else P["sky_l"], P["glass"]))
                      + rect(80 + c * 120, 196 + r * 110, 100, 12, P["sand3"]) for r in range(8) for c in range(4))
    body = (contact_shadow(d, 320, h, 300, 18)
            + g("building", rect(50, 80, 540, h - 110, d.v("wall", P["sand"], P["sand3"])) + rect(40, 60, 560, 30, P["slate_d"])
                + windows + rect(260, h - 140, 120, 110, d.v("ent", P["slate_l"], P["slate_d"])) + rect(240, h - 156, 160, 20, P["slate"], rx=4)))
    return obj("Pallat banimi", (w, h), body, {"ground": [0.5, 1.0]},
               ["apartment", "building", "city", "housing", "rent", "neighbours", "urban-life", "loneliness", "real-estate"],
               {"building": "statike"},
               "A beige apartment block with many windows, a few of them lit, and an entrance at the bottom.",
               "City living: renting, neighbours you never meet, urban loneliness, housing prices.",
               themes=["money", "psychology", "decisions"])


def portfolio(d: Defs):
    w, h = 560, 440
    body = (contact_shadow(d, 280, h, 240, 14, 0.2)
            + g("folder", rect(40, 90, 480, 320, d.v("back", P["blue_d"], P["blue_dd"]), rx=14) + rect(40, 70, 180, 40, P["blue_d"], rx=10))
            + g("sheets", paper(d, 90, 40, 220, 280, "s1", 4, -8) + paper(d, 240, 50, 220, 280, "s2", 4, 6)
                + circle(170, 150, 50, P["teal"]) + path("M170,150 L170,100 A50,50 0 0 1 216,168 Z", P["gold"])
                + path("M270,240 L310,200 L350,220 L400,150 L430,170", "none", f'stroke="{P["green"]}" stroke-width="7" stroke-linecap="round"'))
            + g("front", rect(30, 220, 500, 200, d.v("front", P["blue"], P["blue_d"]), rx=14) + rect(240, 300, 80, 20, P["gold"], rx=6)))
    return obj("Portofol investimesh", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.5]},
               ["portfolio", "investing", "diversification", "assets", "stocks", "risk", "wealth", "finance", "planning"],
               {"sheets": "slide lart = dalin nga dosja", "folder": "statike", "front": "statike"},
               "A blue folder with two documents sticking out: a pie chart and a rising line chart.",
               "Investing: diversification, spreading risk, a long-term plan for wealth.",
               themes=MONEY)


def desk_calendar(d: Defs):
    w, h = 320, 280
    body = (contact_shadow(d, 160, h, 140, 10)
            + g("calendar", poly([(40, 260), (90, 40), (230, 40), (280, 260)], d.v("st", P["slate_l"], P["slate_d"]))
                + rect(70, 50, 180, 200, d.v("pg", P["white"], P["cream2"]), rx=6) + rect(70, 50, 180, 50, d.v("hd", P["red"], P["red_d"]), rx=6)
                + "".join(circle(100 + i * 40, 50, 9, P["steel_d"]) for i in range(4))
                + rect(120, 120, 80, 80, P["red_l"], rx=10, extra='opacity="0.25"') + circle(160, 160, 30, "none", f'stroke="{P["red"]}" stroke-width="6"')
                + rect(100, 220, 120, 10, P["cream3"], rx=5)))
    return obj("Kalendar tavoline", (w, h), body, {"ground": [0.5, 1.0]},
               ["calendar", "deadline", "date", "schedule", "planning", "office", "time", "appointment"],
               {"calendar": "pop_in, shake (afati)"},
               "A flip desk calendar on a stand with a red header and one day circled in red. No numbers.",
               "Dates and deadlines: the meeting next week, planning fallacy, time running out on a goal.",
               themes=["money", "decisions", "growth"])


PROPS = [
    ("prop_dollar_bills_01", dollar_bills), ("prop_euro_bills_01", euro_bills), ("prop_coin_stacks_01", coin_stacks),
    ("prop_gold_bars_01", gold_bars), ("prop_safe_01", safe), ("prop_bank_building_01", bank_building),
    ("prop_stock_chart_01", stock_chart), ("prop_growth_chart_01", growth_chart), ("prop_calculator_01", calculator),
    ("prop_laptop_01", laptop_front), ("prop_desktop_computer_01", desktop_computer), ("prop_smartphone_01", smartphone),
    ("prop_office_desk_01", office_desk_front), ("prop_contract_01", contract), ("prop_invoice_01", invoice),
    ("prop_financial_report_01", financial_report), ("prop_notebook_01", notebook), ("prop_pen_01", pen),
    ("prop_factory_01", factory), ("prop_production_machine_01", production_machine), ("prop_warehouse_01", warehouse),
    ("prop_shipping_container_01", shipping_container), ("prop_delivery_truck_01", delivery_truck), ("prop_shop_front_01", shop_front),
    ("prop_shopping_cart_01", shopping_cart), ("prop_office_tower_01", office_tower), ("prop_house_01", house),
    ("prop_apartment_building_01", apartment_building), ("prop_portfolio_01", portfolio), ("prop_desk_calendar_01", desk_calendar),
]


def main() -> None:
    print(f"{len(run(PROPS, 'business'))} objekte (biznes)")


if __name__ == "__main__":
    main()
