"""Pushteti dhe ndikimi: objektet dhe metaforat (lista e prodhimit, kategoria 03).

Përdorimi: python3 tools/asset-gen/props_power.py
"""
from __future__ import annotations

import math

from editorial import (INK, P, SEAT_Y_ABOVE_FLOOR, TABLE_TOP_ABOVE_FLOOR, Defs, circle, contact_shadow, ellipse, g, lathe,
                       line, obj, path, poly, rect, run, sheen, smooth_lathe, star)

CHESS_TAGS = ["chess", "strategy", "power", "game", "hierarchy", "manipulation", "planning"]


def chess_colors(mode):
    return (P["slate_l"], INK, P["slate"]) if mode == "black" else (P["marble_l"], P["marble_dd"], P["marble"])


def chess_base(d, cx, y, half, light, dark):
    return (ellipse(cx, y + 26, half + 8, 14, dark)
            + rect(cx - half - 8, y, (half + 8) * 2, 26, d.h("base", light, dark), rx=8)
            + ellipse(cx, y, half + 8, 12, light))


def chess_pawn(d: Defs, mode="white"):
    w, h = 240, 400
    l, dk, m = chess_colors(mode)
    cx = 120
    body = (contact_shadow(d, cx, h, 110, 10)
            + g("piece", chess_base(d, cx, 340, 92, l, dk)
                + smooth_lathe(d, "body", cx, [(124, 26), (150, 30), (210, 40), (270, 62), (310, 82), (342, 92)], l, dk, m)
                + ellipse(cx, 136, 60, 14, d.h("col", l, dk, m)) + circle(cx, 76, 54, d.d("head", l, dk))
                + sheen(f"M{cx-30},{50} Q{cx-10},{30} {cx+14},{30} Q{cx-16},{44} {cx-26},{78} Z", 0.55), (cx, 370)))
    return obj("Ushtar shahu (pion)", (w, h), body, {"ground": [0.5, 1.0]},
               CHESS_TAGS + ["pawn", "ordinary-person", "sacrifice", "worker"], {"piece": "pop_in, slide (lëvizje në fushë), fall"},
               f"A {'black' if mode == 'black' else 'white marble'} chess pawn. Variant `{'white' if mode == 'black' else 'black'}`.",
               "The ordinary person in a bigger game: being used or sacrificed, small moves, starting at the bottom.",
               variants={} if mode != "white" else {"black": "black.svg"})


def chess_rook(d: Defs, mode="white"):
    w, h = 260, 460
    l, dk, m = chess_colors(mode)
    cx = 130
    top = (rect(cx - 82, 40, 164, 84, d.h("top", l, dk, m), rx=6)
           + "".join(rect(cx - 82 + i * 62, 18, 40, 40, d.h("mer", l, dk, m), rx=4) for i in range(3))
           + rect(cx - 82, 112, 164, 14, dk, extra='opacity="0.35"'))
    body = (contact_shadow(d, cx, h, 120, 10)
            + g("piece", chess_base(d, cx, 398, 98, l, dk)
                + smooth_lathe(d, "body", cx, [(124, 70), (170, 60), (300, 62), (350, 80), (380, 96), (400, 100)], l, dk, m)
                + top + sheen(f"M{cx-60},140 L{cx-40},140 L{cx-46},380 L{cx-70},380 Z", 0.35), (cx, 430)))
    return obj("Kala shahu (torrë)", (w, h), body, {"ground": [0.5, 1.0]},
               CHESS_TAGS + ["rook", "castle", "defence", "stability", "fortress"], {"piece": "pop_in, slide"},
               f"A {'black' if mode == 'black' else 'white marble'} chess rook with a crenellated top. Variant `{'white' if mode == 'black' else 'black'}`.",
               "Defence, stability and protection, a solid institution, straightforward power.",
               variants={} if mode != "white" else {"black": "black.svg"})


def chess_king(d: Defs, mode="black"):
    w, h = 280, 600
    l, dk, m = chess_colors(mode)
    cx = 140
    body = (contact_shadow(d, cx, h, 126, 12)
            + g("piece", chess_base(d, cx, 536, 104, l, dk)
                + smooth_lathe(d, "body", cx, [(214, 44), (250, 40), (330, 42), (420, 62), (480, 86), (520, 100), (540, 104)], l, dk, m)
                + ellipse(cx, 214, 74, 16, d.h("col", l, dk, m)) + ellipse(cx, 236, 60, 12, d.h("col2", l, dk, m))
                + smooth_lathe(d, "head", cx, [(110, 46), (130, 70), (170, 64), (204, 50)], l, dk, m)
                + ellipse(cx, 108, 48, 10, l)
                + rect(cx - 12, 22, 24, 86, d.h("cr", l, dk, m), rx=4) + rect(cx - 40, 46, 80, 22, d.h("cr2", l, dk, m), rx=4)
                + sheen(f"M{cx-38},260 L{cx-22},260 L{cx-40},520 L{cx-64},520 Z", 0.32), (cx, 570)))
    return obj("Mbreti i shahut", (w, h), body, {"ground": [0.5, 1.0]},
               CHESS_TAGS + ["king", "leader", "ruler", "authority", "checkmate"], {"piece": "pop_in, shake, fall (shah mat)"},
               f"A tall {'black lacquer' if mode == 'black' else 'white marble'} chess king with a cross on top. Variant `{'white' if mode == 'black' else 'black'}`.",
               "The ruler or leader: authority, the one everyone protects, checkmate and the fall of power.",
               variants={} if mode != "black" else {"white": "white.svg"})


def chess_queen(d: Defs, mode="black"):
    w, h = 270, 560
    l, dk, m = chess_colors(mode)
    cx = 135
    crown = (path(f"M{cx-56},150 L{cx-62},92 L{cx-32},122 L{cx-14},80 L{cx},118 L{cx+14},80 L{cx+32},122 L{cx+62},92 L{cx+56},150 Z", d.h("cn", l, dk, m))
             + "".join(circle(cx + dx, y, 10, l) for dx, y in [(-62, 86), (-14, 74), (14, 74), (62, 86)]) + circle(cx, 52, 16, d.d("ball", l, dk)))
    body = (contact_shadow(d, cx, h, 122, 12)
            + g("piece", chess_base(d, cx, 498, 100, l, dk)
                + smooth_lathe(d, "body", cx, [(186, 36), (230, 34), (310, 40), (400, 64), (450, 86), (484, 98), (500, 100)], l, dk, m)
                + ellipse(cx, 186, 66, 15, d.h("col", l, dk, m)) + ellipse(cx, 206, 54, 11, d.h("col2", l, dk, m))
                + smooth_lathe(d, "head", cx, [(140, 56), (160, 46), (180, 40)], l, dk, m) + crown
                + sheen(f"M{cx-34},230 L{cx-20},230 L{cx-40},480 L{cx-62},480 Z", 0.32), (cx, 530)))
    return obj("Mbretëresha e shahut", (w, h), body, {"ground": [0.5, 1.0]},
               CHESS_TAGS + ["queen", "influence", "most-powerful", "strategy", "versatility"], {"piece": "pop_in, slide"},
               f"A {'black lacquer' if mode == 'black' else 'white marble'} chess queen with a pointed coronet. Variant `{'white' if mode == 'black' else 'black'}`.",
               "The most powerful piece: real influence behind the throne, flexibility, strategic power.",
               variants={} if mode != "black" else {"white": "white.svg"})


def chess_board(d: Defs):
    w, h = 1000, 460
    tl, tr, bl, br = (230, 40), (770, 40), (60, 360), (940, 360)

    def lerp(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    def pt(u, v):
        vv = v ** 1.15
        left, right = lerp(tl, bl, vv), lerp(tr, br, vv)
        return lerp(left, right, u)

    squares = ""
    for r in range(8):
        for c in range(8):
            q = [pt(c / 8, r / 8), pt((c + 1) / 8, r / 8), pt((c + 1) / 8, (r + 1) / 8), pt(c / 8, (r + 1) / 8)]
            squares += poly(q, P["cream"] if (r + c) % 2 == 0 else P["wood_dd"])
    body = (contact_shadow(d, 500, h, 470, 22)
            + g("frame", poly([(tl[0] - 26, tl[1] - 16), (tr[0] + 26, tr[1] - 16), (br[0] + 44, br[1] + 20), (bl[0] - 44, bl[1] + 20)], d.v("fr", P["wood"], P["wood_dd"]))
                + poly([(bl[0] - 44, bl[1] + 20), (br[0] + 44, br[1] + 20), (br[0] + 44, br[1] + 70), (bl[0] - 44, bl[1] + 70)], d.v("sd", P["wood_dd"], P["wood_ddd"])))
            + g("squares", squares)
            + sheen(f"M{tl[0]+40},{tl[1]} L{tl[0]+140},{tl[1]} L{bl[0]+80},{bl[1]} L{bl[0]-10},{bl[1]} Z", 0.1))
    anchors = {"ground": [0.5, 1.0], "center": [0.5, 200 / h]}
    for name, (u, v) in {"near_left": (0.19, 0.81), "near_right": (0.81, 0.81), "far_left": (0.19, 0.19), "far_right": (0.81, 0.19), "middle": (0.5, 0.56)}.items():
        x, y = pt(u, v)
        anchors[name] = [x / w, y / h]
    return obj("Fushë shahu", (w, h), body, anchors, CHESS_TAGS + ["board", "game-theory", "competition", "battlefield"],
               {"squares": "statike", "frame": "statik"},
               "A wooden chessboard in perspective, cream and dark squares, empty. Anchors mark squares for placing pieces.",
               "The game of power: strategy, game theory, competition, a world where people are moved like pieces.")


def crown(d: Defs):
    w, h = 400, 300
    gold = d.v("gd", P["gold_l"], P["gold_d"])
    points = [(40, 230), (60, 80), (120, 170), (200, 50), (280, 170), (340, 80), (360, 230)]
    body = (contact_shadow(d, 200, h, 170, 12, 0.2)
            + g("crown",
                path("M60,220 Q200,150 340,220 L340,250 Q200,190 60,250 Z", d.v("vel", P["red"], P["red_d"]))
                + poly(points, gold)
                + rect(36, 210, 328, 66, d.v("band", P["gold_l"], P["gold_d"]), rx=12)
                + "".join(circle(x, y - 14, 16, d.d("orb", P["warm_light2"], P["gold"])) for x, y in points[1::2])
                + "".join(circle(x, 244, r, c) for x, r, c in [(110, 15, P["red"]), (200, 19, P["blue"]), (290, 15, P["red"])])
                + "".join(circle(x, 244, 6, P["gold_l"]) for x in (70, 155, 245, 330))
                + sheen("M60,214 H340 V222 H60 Z", 0.5) + sheen("M120,170 L200,60 L190,110 Z", 0.35), (200, 160)))
    return obj("Kurorë e artë", (w, h), body, {"center": [0.5, 0.55], "base": [0.5, 0.92]},
               ["crown", "king", "royalty", "power", "status", "authority", "winner", "ego", "throne"],
               {"crown": "pop_in, float, shine; mund të vendoset mbi kokë (attach above_head)"},
               "A golden crown with five points topped by pearls, red velvet inside, and red and blue jewels on the band.",
               "Status and power: who rules, ego, winning, royalty. Can sit on a character's head or float above it.",
               animations=("pop_in", "fade", "slide", "float", "pulse"))


def throne(d: Defs):
    w, h = 620, 980
    seat = h - SEAT_Y_ABOVE_FLOOR - 30
    gold = d.v("gd", P["gold_l"], P["gold_d"])
    body = (contact_shadow(d, 310, h, 300, 18)
            + g("back", path(f"M120,{seat} V160 Q120,60 200,40 L240,10 L310,0 L380,10 L420,40 Q500,60 500,160 V{seat} Z", gold)
                + path(f"M160,{seat} V180 Q160,100 230,84 L310,70 L390,84 Q460,100 460,180 V{seat} Z", d.v("vel", P["red"], P["red_d"]))
                + star(310, 46, 24, 10, 5, P["red_d"])
                + "".join(circle(x, 200, 7, P["gold_l"]) for x in (190, 250, 310, 370, 430)))
            + g("seat", rect(80, seat - 20, 460, 70, d.v("seat", P["red_l"], P["red_d"]), rx=24) + rect(70, seat + 40, 480, 40, gold, rx=10))
            + g("legs", path(f"M100,{seat+80} L90,{h} L140,{h} L150,{seat+80} Z", gold) + path(f"M520,{seat+80} L530,{h} L480,{h} L470,{seat+80} Z", gold)
                + rect(130, seat + 80, 360, 40, P["gold_d"], rx=8))
            + g("arms", rect(40, seat - 160, 90, 230, gold, rx=30) + rect(490, seat - 160, 90, 230, gold, rx=30)
                + circle(85, seat - 160, 36, d.d("knob", P["warm_light2"], P["gold_d"])) + circle(535, seat - 160, 36, d.d("knob", P["warm_light2"], P["gold_d"])))
            + sheen("M136,170 Q140,90 200,58 Q156,110 152,400 Z", 0.35))
    return obj("Fron mbretëror", (w, h), body, {"ground": [0.5, 1.0], "seat": [0.5, (seat - 20) / h], "hip": [0.5, (seat - 34) / h]},
               ["throne", "king", "royalty", "power", "authority", "rule", "status", "seat-of-power", "empire"],
               {"back": "statik", "seat": "statik; personazhi ulet te anchor `hip`", "arms": "statike"},
               "A golden royal throne with a tall arched back and red velvet, armrests with round finials.",
               "The seat of power: who sits on the throne, ruling, empires, the cost of holding power.")


def scepter(d: Defs):
    w, h = 140, 640
    gold = d.h("rod", P["gold_l"], P["gold_d"], P["gold"])
    body = (g("scepter",
              rect(60, 150, 20, 460, gold, rx=8) + "".join(rect(52, y, 36, 16, P["gold_d"], rx=6) for y in (220, 380, 540))
              + rect(48, 604, 44, 30, gold, rx=10)
              + path("M40,150 Q30,110 70,96 Q110,110 100,150 Z", gold)
              + circle(70, 70, 44, d.d("orb", P["blue_l"], P["blue_dd"])) + sheen("M44,56 Q52,36 76,32 Q56,46 52,70 Z", 0.6)
              + rect(64, 0, 12, 34, P["gold"], rx=3) + rect(54, 10, 32, 10, P["gold"], rx=3)
              + "".join(circle(70, y, 8, P["red"]) for y in (300, 460)), (70, 320)))
    return obj("Skeptër mbretëror", (w, h), body, {"center": [0.5, 0.5], "grip": [0.5, 0.65]},
               ["scepter", "royalty", "authority", "power", "rule", "symbol", "king", "queen"],
               {"scepter": "pop_in, float, rotation"},
               "A golden royal scepter with a blue orb and small cross on top and red jewels on the rod.",
               "A symbol of authority: the right to rule, legitimacy, ceremony and power.",
               animations=("pop_in", "fade", "slide", "float"))


def medal(d: Defs):
    w, h = 280, 440
    body = (g("ribbon", poly([(60, 0), (130, 0), (160, 220), (110, 250)], d.v("rb1", P["blue"], P["blue_dd"]))
              + poly([(220, 0), (150, 0), (120, 220), (170, 250)], d.v("rb2", P["red"], P["red_d"]))
              + rect(60, 0, 160, 18, P["blue_dd"], extra='opacity="0.3"'))
            + g("medal", circle(140, 320, 108, d.d("md", P["gold_l"], P["gold_d"])) + circle(140, 320, 84, d.d("md2", P["gold"], P["gold_l"]))
                + star(140, 322, 58, 24, 5, d.d("st", P["warm_light2"], P["gold_d"]))
                + sheen("M70,280 Q90,230 140,222 Q100,250 92,300 Z", 0.5), (140, 220)))
    return obj("Medalje e artë", (w, h), body, {"center": [0.5, 320 / h], "top": [0.5, 0.0]},
               ["medal", "gold", "winner", "achievement", "first-place", "recognition", "reward", "status", "competition"],
               {"medal": "sway/pop_in (lëkundet në shirit)", "ribbon": "statik"},
               "A gold medal with a star relief hanging from a blue and red ribbon.",
               "Winning and recognition: first place, rewards, external validation, competition and status.",
               animations=("pop_in", "fade", "slide", "sway"), themes=["growth", "psychology", "money"])


def trophy(d: Defs):
    w, h = 320, 480
    cx = 160
    body = (contact_shadow(d, cx, h, 120, 10)
            + g("trophy",
                rect(70, 400, 180, 70, d.v("bs", P["wood_d"], P["wood_ddd"]), rx=8) + rect(100, 412, 120, 34, P["gold_l"], rx=4, extra='opacity="0.75"')
                + smooth_lathe(d, "stem", cx, [(300, 20), (330, 16), (360, 30), (392, 60), (402, 62)], P["gold_l"], P["gold_d"], P["gold"])
                + f'<path d="M64,80 Q10,90 18,150 Q28,220 96,232" fill="none" stroke="{P["gold"]}" stroke-width="18"/>'
                + f'<path d="M256,80 Q310,90 302,150 Q292,220 224,232" fill="none" stroke="{P["gold_d"]}" stroke-width="18"/>'
                + smooth_lathe(d, "cup", cx, [(40, 112), (120, 108), (200, 88), (260, 48), (300, 24)], P["gold_l"], P["gold_d"], P["gold"])
                + ellipse(cx, 40, 112, 18, P["gold_d"]) + ellipse(cx, 36, 100, 12, d.v("in", P["gold_d"], P["gold"]))
                + star(cx, 150, 40, 17, 5, P["gold_l"]) + sheen("M78,60 Q80,170 140,260 Q96,200 92,60 Z", 0.45), (cx, 240)))
    return obj("Kupë (trofe)", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.4]},
               ["trophy", "cup", "winner", "success", "achievement", "victory", "competition", "goal", "status"],
               {"trophy": "pop_in, float, shine"},
               "A golden trophy cup with two handles and a star, on a dark wooden base.",
               "Success and victory: the goal, winning, external rewards, survivorship bias ('only the winners are shown').",
               animations=("pop_in", "fade", "slide", "float", "pulse"), themes=["growth", "psychology", "money"])


def handshake(d: Defs):
    w, h = 600, 340
    sk_l, sk_d = d.v("skl", P["skin_l"], P["skin"]), d.v("skd", P["skin"], P["skin_d"])
    fingers = "".join(
        f'<g transform="rotate({8 + k * 4} {318 + k * 26} 120)">' + rect(300 + k * 26, 112, 30, 104 - k * 6, sk_l, rx=15)
        + line(f"M{304 + k * 26},{150 + k * 4} H{326 + k * 26}", P["skin"], 3, 'opacity="0.6"') + "</g>" for k in range(4))
    body = (
        g("left_arm", poly([(0, 150), (180, 140), (196, 262), (0, 282)], d.v("sl", P["blue"], P["blue_dd"]))
          + rect(172, 132, 44, 140, P["white"], rx=10) + rect(172, 132, 44, 12, P["cream3"], rx=6))
        + g("right_arm", poly([(600, 120), (430, 118), (414, 236), (600, 252)], d.v("sr", P["slate_l"], P["slate_d"]))
            + rect(398, 110, 44, 136, P["cream"], rx=10) + rect(398, 110, 44, 12, P["cream3"], rx=6))
        + g("hands",
            path("M412,124 Q370,112 300,122 Q258,130 250,160 Q246,200 286,222 Q340,240 412,226 Z", sk_d)          # dora e djathtë (poshtë)
            + path("M214,150 Q250,130 300,134 Q326,140 330,170 Q328,226 290,244 Q246,256 214,244 Z", sk_l)         # pëllëmba e majtë
            + fingers                                                                                              # gishtat e majtë mbështjellin
            + path("M404,128 Q352,104 300,112 Q268,118 262,134 Q290,142 330,138 Q370,140 404,150 Z", sk_d)         # gishti i madh i djathtë sipër
            + line("M268,134 Q300,128 330,132", P["skin_d"], 3, 'opacity="0.7"')
            + path("M232,240 Q262,262 300,254 Q286,236 252,232 Z", P["skin"], 'opacity="0.8"'))                     # gishti i madh i majtë poshtë
    )
    return obj("Shtrëngim duarsh", (w, h), body, {"center": [0.5, 0.52]},
               ["handshake", "deal", "agreement", "trust", "partnership", "business", "negotiation", "alliance", "cooperation"],
               {"hands": "shake i lehtë = shtrëngim", "left_arm": "statik", "right_arm": "statik"},
               "A close-up handshake between two people in suit sleeves (blue and grey), white shirt cuffs.",
               "A deal is made: agreement, trust, partnership, negotiation, alliances (and broken promises).",
               animations=("pop_in", "fade", "slide", "shake"), themes=["money", "decisions", "psychology"])


def contract_signing(d: Defs):
    w, h = 600, 380
    body = (
        g("paper", poly([(70, 120), (470, 90), (560, 330), (110, 370)], d.v("pp", P["white"], P["cream2"]))
          + "".join(line(f"M{120 + i * 4},{150 + i * 30} L{440 + i * 8},{126 + i * 30}", P["cream3"], 5) for i in range(5))
          + line("M200,320 L460,300", P["slate_d"], 3)
          + path("M220,300 Q240,270 256,300 T292,296 Q310,276 322,298 Q336,312 360,290", "none", f'stroke="{P["blue_dd"]}" stroke-width="5" stroke-linecap="round"')
          + circle(500, 300, 26, P["red"]) + star(500, 300, 16, 8, 8, P["red_d"]))
        + g("hand",
            path("M600,120 L470,210 Q440,236 420,222 Q400,206 418,186 L520,100 L600,70 Z", d.v("sl", P["blue"], P["blue_dd"]))
            + path("M430,190 Q392,204 372,240 Q366,262 386,268 Q414,270 440,246 L468,216 Z", d.v("hd", P["skin"], P["skin_d"]))
            + rect(470, 160, 30, 70, P["white"], rx=6, extra='transform="rotate(-36 485 195)"')
            + f'<g transform="rotate(32 370 260)">' + rect(350, 160, 16, 130, d.h("pen", P["slate"], INK), rx=6) + poly([(350, 290), (366, 290), (358, 314)], P["gold"]) + "</g>", (470, 200))
    )
    return obj("Firmosja e kontratës", (w, h), body, {"center": [0.5, 0.6], "signature": [290 / w, 296 / h]},
               ["contract", "signing", "agreement", "deal", "commitment", "law", "business", "promise", "decision"],
               {"hand": "slide/shake = shkruan firmën", "paper": "statike"},
               "A close-up of a hand in a suit sleeve signing a contract with a fountain pen; a red seal on the paper.",
               "The moment of commitment: signing a deal, a legal promise, sunk cost, reading the fine print.",
               themes=["money", "decisions", "psychology"])


def meeting_table(d: Defs):
    w, h = 1000, 372
    top = h - TABLE_TOP_ABOVE_FLOOR
    body = (
        contact_shadow(d, 500, h, 500, 18)
        + g("legs", "".join(poly([(x, top + 30), (x + 34, top + 30), (x + 28, h), (x + 8, h)], d.h(f"lg{i}", P["wood_d"], P["wood_ddd"])) for i, x in enumerate((60, 480, 906))))
        + g("apron", rect(40, top + 26, 920, 50, d.v("ap", P["wood_dd"], P["wood_ddd"]), rx=6))
        + g("top", rect(0, top, w, 34, d.v("tp", P["wood"], P["wood_dd"]), rx=8) + rect(0, top + 26, w, 8, P["wood_ddd"], rx=4)
            + rect(14, top + 4, w - 28, 5, P["wood_l"], rx=2, extra='opacity="0.6"'))
        + g("items", rect(150, top - 6, 120, 8, P["white"], rx=2) + rect(730, top - 6, 120, 8, P["white"], rx=2)
            + rect(460, top - 70, 40, 70, d.h("wt", P["glass"], P["steel"]), rx=8) + rect(510, top - 50, 34, 50, d.h("gl", P["sky_l"], P["glass"]), rx=6))
    )
    return obj("Tavolinë mbledhjesh / negociatash (anash)", (w, h), body,
               {"ground": [0.5, 1.0], "top": [0.5, top / h], "seat_left": [0.06, 1.0], "seat_right": [0.94, 1.0]},
               ["table", "meeting", "negotiation", "boardroom", "deal", "conflict", "conversation", "business", "furniture"],
               {"top": "shtresë përpara: mbulon këmbët e të ulurve", "items": "dokumente dhe ujë mbi tavolinë"},
               "A long dark wooden meeting table seen from the side, with papers and a water carafe. Same height as the desks.",
               "Negotiations and meetings: two sides across a table, deals, conflict, a board deciding someone's fate.",
               themes=["money", "decisions", "psychology"])


def gavel(d: Defs):
    w, h = 400, 260
    body = (contact_shadow(d, 200, h, 170, 10)
            + g("block", ellipse(120, 214, 100, 22, P["wood_ddd"]) + rect(20, 186, 200, 30, d.v("bk", P["wood"], P["wood_dd"]), rx=12) + ellipse(120, 186, 100, 20, P["wood_l"]))
            + g("gavel", f'<g transform="rotate(-24 200 120)">'
                + rect(150, 112, 240, 22, d.v("hd", P["wood_l"], P["wood_dd"]), rx=10)
                + rect(60, 40, 110, 130, d.h("head", P["wood"], P["wood_ddd"], P["wood_d"]), rx=20)
                + rect(54, 60, 122, 16, P["gold"], rx=4) + rect(54, 134, 122, 16, P["gold"], rx=4) + "</g>", (360, 140)))
    return obj("Çekiç gjyqtari", (w, h), body, {"ground": [0.5, 1.0]},
               ["gavel", "judge", "law", "court", "verdict", "justice", "judgement", "authority", "decision"],
               {"gavel": "rotation: goditja (receta e përgjithshme shake + rotation e pjesës)", "block": "statik"},
               "A wooden judge's gavel with gold bands resting over its sound block.",
               "Judgement and the law: a verdict, justice, authority deciding, how we judge others.",
               themes=["decisions", "philosophy", "psychology"])


def control_panel(d: Defs):
    w, h = 900, 560
    screens = ""
    for i, x in enumerate((70, 330, 590)):
        screens += rect(x, 40, 240, 160, d.d(f"sc{i}", P["night2"], P["night"]), rx=12) + rect(x, 40, 240, 160, "none", rx=12, extra=f'stroke="{P["slate"]}" stroke-width="10"')
        if i == 0:
            screens += line(f"M{x+20},{170} L{x+70},{120} L{x+120},{140} L{x+170},{80} L{x+220},{100}", P["teal"], 6)
        elif i == 1:
            screens += "".join(rect(x + 30 + j * 40, 170 - hh, 26, hh, P["gold"]) for j, hh in enumerate((40, 70, 56, 100, 84)))
        else:
            screens += circle(x + 120, 120, 56, P["night3"]) + path(f"M{x+120},120 L{x+120},64 A56,56 0 0 1 {x+170},146 Z", P["red_l"])
    buttons = "".join(circle(130 + i * 70, 330, 18, c) for i, c in enumerate((P["red"], P["gold"], P["green"], P["teal"], P["blue_l"], P["gold"])))
    sliders = "".join(rect(x, 290, 12, 120, P["night"], rx=6) + rect(x - 16, 300 + (j * 31 % 80), 44, 22, P["steel_l"], rx=6) for j, x in enumerate((600, 660, 720, 780)))
    body = (contact_shadow(d, 450, h, 440, 18)
            + g("screens", screens)
            + g("console", poly([(30, 240), (870, 240), (900, 460), (0, 460)], d.v("cn", P["slate_l"], P["slate_d"]))
                + buttons + sliders + rect(120, 380, 360, 40, P["night"], rx=10)
                + "".join(rect(140 + i * 46, 388, 30, 24, P["steel"], rx=4) for i in range(7)))
            + g("big_button", ellipse(530, 344, 46, 22, P["red_d"]) + ellipse(530, 334, 40, 18, d.v("bb", P["red_l"], P["red"])), (530, 340))
            + rect(0, 460, 900, 100, d.v("dk", P["slate_d"], P["slate_dd"])))
    return obj("Panel kontrolli", (w, h), body, {"ground": [0.5, 1.0], "button": [530 / w, 340 / h]},
               ["control-panel", "control", "system", "power", "manipulation", "algorithm", "monitoring", "command-center", "levers"],
               {"screens": "pulse = të dhënat ndryshojnë", "big_button": "scale_pulse = shtyhet", "console": "statik"},
               "A dark control console with three screens (line chart, bars, gauge), buttons, sliders and a big red button.",
               "Who controls the system: levers of power, algorithms steering behaviour, monitoring, the person behind the curtain.",
               themes=["psychology", "decisions", "science"])


def security_camera(d: Defs):
    w, h = 420, 300
    body = (g("mount", rect(360, 40, 50, 120, d.h("mt", P["steel_l"], P["steel_dd"]), rx=8) + rect(290, 90, 90, 22, P["steel_d"], rx=8))
            + g("camera", f'<g transform="rotate(14 300 100)">'
                + rect(60, 50, 250, 110, d.v("bd", P["white"], P["steel"]), rx=24) + rect(40, 40, 60, 130, d.v("hd", P["steel_l"], P["steel_d"]), rx=14)
                + circle(56, 104, 44, P["slate_dd"]) + circle(56, 104, 30, d.d("ln", P["blue_d"], INK)) + circle(46, 94, 9, P["white"], 'opacity="0.7"')
                + circle(280, 74, 8, P["red"]) + circle(280, 74, 18, d.glow("led", P["red"], 0.7, 0.0)) + "</g>", (300, 100)))
    return obj("Kamerë sigurie", (w, h), body, {"center": [0.5, 0.4], "wall": [0.92, 0.3]},
               ["camera", "surveillance", "watching", "privacy", "control", "security", "big-brother", "hawthorne-effect", "monitoring"],
               {"camera": "rotation ±20 = skanon dhomën", "mount": "statik"},
               "A white wall-mounted security camera with a dark lens and a glowing red light.",
               "Being monitored: surveillance and privacy, the Hawthorne effect (people behave differently when watched), control.",
               animations=("pop_in", "fade", "slide", "sway"), themes=["psychology", "decisions", "science"])


def microphone(d: Defs):
    w, h = 300, 960
    body = (contact_shadow(d, 150, h, 120, 10)
            + g("stand", lathe(d, "pole", 150, [(300, 8), (h - 70, 8)], P["steel_l"], P["steel_dd"])
                + line(f"M150,{h-70} L40,{h-6} M150,{h-70} L260,{h-6} M150,{h-70} L150,{h-6}", P["slate_d"], 14)
                + rect(130, 600, 40, 30, P["slate"], rx=8))
            + g("mic", f'<g transform="rotate(-12 150 300)">'
                + rect(126, 190, 48, 120, d.h("bd", P["slate_l"], INK), rx=14) + rect(118, 180, 64, 24, P["steel_d"], rx=8)
                + ellipse(150, 120, 62, 80, d.d("gr", P["steel_l"], P["steel_dd"]))
                + "".join(line(f"M{100+i*14},{60+abs(i-3.5)*8} V{180-abs(i-3.5)*8}", P["steel_dd"], 3, 'opacity="0.5"') for i in range(8))
                + sheen("M110,80 Q120,54 146,46 Q126,70 122,110 Z", 0.6) + "</g>", (150, 300)))
    return obj("Mikrofon me këmbë", (w, h), body, {"ground": [0.5, 1.0], "mic": [0.5, 120 / h]},
               ["microphone", "speech", "voice", "public-speaking", "media", "podcast", "announcement", "influence", "stage"],
               {"mic": "statik; pop_in", "stand": "statik"},
               "A classic round microphone on a tall stand with a tripod base. Mouth height of a standing character.",
               "Having a voice: speeches, media influence, interviews, public speaking anxiety, propaganda.",
               themes=["psychology", "decisions", "growth"])


def podium(d: Defs):
    w, h = 480, 740
    body = (contact_shadow(d, 240, h, 220, 14)
            + g("mic", line("M300,110 Q300,40 250,30", P["slate_dd"], 8) + ellipse(246, 26, 18, 12, P["slate_d"]))
            + g("lectern",
                poly([(30, 110), (450, 110), (420, 160), (60, 160)], d.v("tp", P["wood_l"], P["wood_d"]))
                + poly([(70, 160), (410, 160), (380, h - 40), (100, h - 40)], d.h("bd", P["wood"], P["wood_ddd"], P["wood_d"]))
                + poly([(110, 200), (370, 200), (354, h - 90), (126, h - 90)], P["wood_dd"], 'opacity="0.55"')
                + circle(240, 330, 64, d.d("emb", P["gold_l"], P["gold_d"])) + star(240, 330, 40, 17, 5, P["gold_d"])
                + rect(70, h - 44, 340, 44, d.v("bs", P["wood_dd"], P["wood_ddd"]), rx=8)))
    return obj("Foltore", (w, h), body, {"ground": [0.5, 1.0], "speaker": [0.5, 0.15]},
               ["podium", "lectern", "speech", "politics", "authority", "public-speaking", "announcement", "leader", "press-conference"],
               {"lectern": "statik", "mic": "statik"},
               "A wooden lectern with a gold star emblem and a gooseneck microphone. No text.",
               "Speeches and authority: politicians and leaders addressing people, press conferences, fear of public speaking.",
               themes=["psychology", "decisions", "growth"])


def presidential_desk(d: Defs):
    w, h = 1200, 560
    top = h - TABLE_TOP_ABOVE_FLOOR - 20

    def flag(x, c1, c2):
        return (line(f"M{x},{top} V{top-300}", P["gold_d"], 8) + circle(x, top - 306, 10, P["gold"])
                + path(f"M{x},{top-292} Q{x+80},{top-280} {x+150},{top-296} V{top-170} Q{x+80},{top-154} {x},{top-170} Z", d.v(f"fl{x}", c1, c2))
                + rect(x - 30, top - 12, 60, 14, P["gold_d"], rx=6))
    body = (contact_shadow(d, 600, h, 600, 22)
            + g("flags", flag(140, P["blue"], P["blue_dd"]) + flag(920, P["red"], P["red_d"]))
            + g("desk", rect(60, top, 1080, 40, d.v("tp", P["wood"], P["wood_ddd"]), rx=10)
                + rect(80, top + 40, 1040, h - top - 40, d.v("bd", P["wood_d"], P["wood_ddd"]))
                + "".join(rect(x, top + 70, 300, h - top - 100, P["wood_dd"], rx=10) + rect(x + 20, top + 90, 260, h - top - 140, d.v(f"pn{x}", P["wood_d"], P["wood_dd"]), rx=8) for x in (110, 450, 790))
                + circle(600, top + 170, 50, d.d("seal", P["gold_l"], P["gold_d"])) + star(600, top + 170, 30, 13, 5, P["gold_d"])
                + rect(60, top + 30, 1080, 8, P["gold"], extra='opacity="0.8"'))
            + g("items", rect(380, top - 40, 120, 40, d.v("pn", P["wood_dd"], P["wood_ddd"]), rx=6) + line(f"M410,{top-40} L396,{top-110} M450,{top-40} L470,{top-110}", P["gold"], 6)
                + line(f"M820,{top} V{top-150} Q820,{top-190} 860,{top-190}", P["gold_d"], 8) + path(f"M820,{top-210} H920 L900,{top-160} H840 Z", d.v("lp", P["green"], P["green_dd"]))))
    return obj("Tavolinë presidenciale", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, top / h], "chair": [0.5, 0.2]},
               ["desk", "president", "power", "office", "politics", "authority", "leader", "decision", "government"],
               {"desk": "statik", "flags": "sway i lehtë", "items": "statike"},
               "A large dark wooden executive desk with gold trim and a gold seal, a green banker's lamp and two plain flags (blue and red, no symbols).",
               "The highest office: political power, the person who decides, leadership under pressure.",
               themes=["decisions", "money", "psychology"])


def briefcase(d: Defs):
    w, h = 400, 320
    body = (contact_shadow(d, 200, h, 180, 12)
            + g("case", path("M140,90 V58 Q140,30 170,30 H230 Q260,30 260,58 V90 H240 V60 Q240,50 230,50 H170 Q160,50 160,60 V90 Z", P["wood_ddd"])
                + rect(20, 86, 360, 220, d.v("bd", P["wood"], P["wood_dd"]), rx=22)
                + rect(20, 86, 360, 80, d.v("lid", P["wood_l"], P["wood"]), rx=22) + rect(20, 150, 360, 16, P["wood_dd"])
                + rect(110, 140, 40, 40, d.d("cl", P["gold_l"], P["gold_d"]), rx=6) + rect(250, 140, 40, 40, d.d("cl", P["gold_l"], P["gold_d"]), rx=6)
                + f'<rect x="34" y="100" width="332" height="192" rx="16" fill="none" stroke="{P["wood_l"]}" stroke-width="3" stroke-dasharray="10 7" opacity="0.6"/>'
                + sheen("M40,96 H180 L160,110 H40 Z", 0.35)))
    return obj("Çantë biznesi (e mbyllur)", (w, h), body, {"ground": [0.5, 1.0], "handle": [0.5, 30 / h]},
               ["briefcase", "business", "career", "work", "secrets", "deal", "professional", "corporate", "money"],
               {"case": "pop_in, slide"},
               "A closed brown leather briefcase with a handle and two gold clasps.",
               "Business and career, a professional identity, secret deals, going to work every day.",
               themes=["money", "decisions", "growth"])


def luxury_watch(d: Defs):
    w, h = 200, 320
    cx, cy = 100, 160
    links = "".join(rect(64, y, 72, 22, d.v(f"lk{i}", P["gold_l"], P["gold_d"]), rx=5) for i, y in enumerate(list(range(0, 82, 26)) + list(range(240, 320, 26))))
    body = (g("bracelet", links)
            + g("case", rect(178, 150, 14, 22, P["gold_d"], rx=4) + circle(cx, cy, 82, d.d("cs", P["gold_l"], P["gold_d"]))
                + circle(cx, cy, 70, P["white"]) + circle(cx, cy, 66, d.d("dl", P["night2"], INK))
                + "".join(circle(cx + 54 * math.cos(math.radians(a)), cy + 54 * math.sin(math.radians(a)), 5 if a % 90 else 7, P["white"]) for a in range(0, 360, 30)))
            + g("hour", rect(cx - 4, cy - 34, 8, 38, P["gold_l"], rx=4, extra=f'transform="rotate(300 {cx} {cy})"'), (cx, cy))
            + g("minute", rect(cx - 3, cy - 50, 6, 54, P["gold_l"], rx=3, extra=f'transform="rotate(50 {cx} {cy})"'), (cx, cy))
            + circle(cx, cy, 6, P["gold"]) + sheen(f"M{cx-50},{cy-30} Q{cx-20},{cy-62} {cx+14},{cy-64} Q{cx-24},{cy-46} {cx-42},{cy-6} Z", 0.4))
    return obj("Orë luksi", (w, h), body, {"center": [0.5, 0.5]},
               ["watch", "luxury", "gold", "status", "wealth", "rich", "status-symbol", "conspicuous-consumption", "time"],
               {"hour": "rotation", "minute": "rotation", "case": "statik"},
               "A gold luxury wristwatch with a black dial, white diamond markers and a gold link bracelet.",
               "Status symbols and conspicuous consumption: wealth on display, buying identity, the rich lifestyle.",
               animations=("pop_in", "fade", "slide", "pulse"), themes=["money", "psychology", "decisions"])


def column(d, x, top, base, wd, name):
    shaft = rect(x - wd / 2, top + 40, wd, base - top - 80, d.h(name, P["marble_l"], P["marble_dd"], P["marble"]))
    flutes = "".join(rect(x - wd / 2 + 10 + i * (wd - 20) / 5, top + 50, 5, base - top - 100, P["marble_d"], extra='opacity="0.6"') for i in range(6))
    cap = rect(x - wd / 2 - 18, top, wd + 36, 22, P["marble"]) + rect(x - wd / 2 - 8, top + 22, wd + 16, 20, P["marble_d"])
    foot = rect(x - wd / 2 - 12, base - 40, wd + 24, 18, P["marble"]) + rect(x - wd / 2 - 20, base - 22, wd + 40, 22, P["marble_d"])
    return shaft + flutes + cap + foot


def colonnade(d: Defs):
    w, h = 1500, 1150
    body = (contact_shadow(d, 750, h, 740, 22, 0.25)
            + g("steps", rect(0, h - 60, w, 60, d.v("st", P["marble"], P["marble_d"])) + rect(30, h - 100, w - 60, 44, P["marble_l"]))
            + g("entablature", rect(20, 40, w - 40, 60, d.v("ent", P["marble_l"], P["marble_d"])) + rect(40, 100, w - 80, 40, P["marble_d"])
                + "".join(rect(60 + i * 60, 52, 30, 36, P["marble_d"], extra='opacity="0.7"') for i in range(23)))
            + g("columns", "".join(column(d, 120 + i * 252, 140, h - 100, 108, f"c{i}") for i in range(6))))
    return obj("Kolona të larta (kolonadë)", (w, h), body, {"ground": [0.5, 1.0]},
               ["columns", "colonnade", "institution", "power", "government", "authority", "monumental", "empire", "law"],
               {"columns": "statike", "entablature": "statik", "steps": "statike"},
               "A monumental row of six tall white marble columns with an entablature on top and steps below.",
               "The power of institutions: government, courts, banks, empires; small people in front of huge architecture.",
               themes=["philosophy", "decisions", "money"])


def hierarchy_pyramid(d: Defs):
    w, h = 1100, 860
    tiers = [(P["gold_l"], P["gold_d"]), (P["red_l"], P["red_d"]), (P["blue_l"], P["blue_d"]), (P["teal"], P["teal_d"]), (P["slate_l"], P["slate_d"])]
    body = contact_shadow(d, 550, h, 540, 20)
    th = 160
    for i, (c1, c2) in enumerate(tiers):
        y0 = 40 + i * th
        half0, half1 = 60 + i * 100, 60 + (i + 1) * 100
        tier = poly([(550 - half0, y0), (550 + half0, y0), (550 + half1, y0 + th - 10), (550 - half1, y0 + th - 10)], d.v(f"t{i}", c1, c2))
        n = 1 + i * 3
        people = "".join(circle(550 - (n - 1) * 34 / 2 + k * 34, y0 + th - 70, 11, P["white"], 'opacity="0.85"')
                         + rect(550 - (n - 1) * 34 / 2 + k * 34 - 12, y0 + th - 56, 24, 34, P["white"], rx=10, extra='opacity="0.85"') for k in range(n))
        body += g(f"tier_{i+1}", tier + people, (550, y0 + th))
    return obj("Piramida e hierarkisë", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, 40 / h]},
               ["pyramid", "hierarchy", "power", "inequality", "status", "social-class", "organization", "elite", "maslow"],
               {f"tier_{i+1}": "receta `build`: katet shfaqen nga poshtë lart" for i in range(5)},
               "A five-tier pyramid from slate at the bottom to gold at the top, with more small figures on each lower tier and one at the top.",
               "Power and inequality: social hierarchy, the elite at the top, corporate ladders, Maslow-style levels.",
               animations=("pop_in", "fade", "build"), themes=["psychology", "money", "decisions"])


def red_carpet(d: Defs):
    w, h = 1500, 700

    def post(x, y, s):
        return (rect(x - 8 * s, y - 150 * s, 16 * s, 150 * s, d.h(f"ps{x}", P["gold_l"], P["gold_d"]), rx=4)
                + circle(x, y - 156 * s, 14 * s, P["gold_l"]) + ellipse(x, y, 34 * s, 10 * s, P["gold_d"]))

    left = [(330, 160, 0.45), (210, 380, 0.7), (60, 650, 1.0)]
    right = [(1170, 160, 0.45), (1290, 380, 0.7), (1440, 650, 1.0)]
    ropes = "".join(path(f"M{a[0]},{a[1]-140*a[2]} Q{(a[0]+b[0])/2},{(a[1]+b[1])/2 - 40} {b[0]},{b[1]-140*b[2]}", "none", f'stroke="{P["red_d"]}" stroke-width="{10*b[2]:.0f}"')
                    for side in (left, right) for a, b in zip(side, side[1:]))
    body = (g("carpet", poly([(560, 120), (940, 120), (1260, h), (240, h)], d.v("cp", P["red_d"], P["red"]))
              + poly([(560, 120), (580, 120), (290, h), (240, h)], P["gold"], 'opacity="0.7"') + poly([(940, 120), (920, 120), (1210, h), (1260, h)], P["gold"], 'opacity="0.7"'))
            + g("posts", "".join(post(x, y, s) for x, y, s in left + right) + ropes))
    return obj("Tapet i kuq", (w, h), body, {"ground": [0.5, 1.0], "walk": [0.5, 0.9]},
               ["red-carpet", "fame", "celebrity", "status", "vip", "exclusive", "glamour", "success", "attention"],
               {"carpet": "statik", "posts": "shtyllat e arta me kordon"},
               "A red carpet runner in perspective with gold edges, lined by gold posts and velvet ropes.",
               "Fame and exclusivity: celebrities, VIP status, the illusion of success, who gets let in.",
               themes=["psychology", "money", "decisions"])


def power_shadow(d: Defs):
    w, h = 1000, 1600
    fill = d.v("sh", P["slate_dd"], INK)
    figure = (path("M500,80 Q440,80 430,150 L360,150 Q340,150 340,170 L660,170 Q660,150 640,150 L570,150 Q560,80 500,80 Z", fill)
              + ellipse(500, 230, 78, 90, fill)
              + path("M420,300 Q500,290 580,300 L800,380 Q880,420 900,560 L920,820 L840,830 L800,600 L780,1560 L560,1560 L520,1040 L480,1040 L440,1560 L220,1560 L200,600 L160,830 L80,820 L100,560 Q120,420 200,380 Z", fill))
    body = (g("halo", ellipse(500, 900, 520, 760, d.glow("hl", INK, 0.22, 0.0)))
            + g("shadow", f'<g opacity="0.82">{figure}</g>', (500, 1560)))
    return obj("Hija e një figure të fuqishme", (w, h), body, {"ground": [0.5, 0.975]},
               ["shadow", "power", "authority", "fear", "threat", "dominance", "manipulator", "hidden-power", "intimidation"],
               {"shadow": "receta `loom`: hija rritet dhe errësohet", "halo": "errësira rreth saj"},
               "A huge looming shadow of a broad-shouldered figure in a long coat and hat, cast on a wall.",
               "Hidden or threatening power: someone who dominates, intimidation, a fear larger than the person, the boss nobody sees.",
               animations=("pop_in", "fade", "loom"), themes=["psychology", "decisions", "philosophy"])


PROPS = [
    ("prop_chess_king_01", chess_king), ("prop_chess_queen_01", chess_queen), ("prop_chess_pawn_01", chess_pawn),
    ("prop_chess_rook_01", chess_rook), ("prop_chess_board_01", chess_board), ("prop_crown_01", crown), ("prop_throne_01", throne),
    ("prop_scepter_01", scepter), ("prop_medal_01", medal), ("prop_trophy_01", trophy), ("prop_handshake_01", handshake),
    ("prop_contract_signing_01", contract_signing), ("prop_meeting_table_01", meeting_table), ("prop_gavel_01", gavel),
    ("prop_control_panel_01", control_panel), ("prop_security_camera_01", security_camera), ("prop_microphone_01", microphone),
    ("prop_podium_01", podium), ("prop_presidential_desk_01", presidential_desk), ("prop_briefcase_01", briefcase),
    ("prop_luxury_watch_01", luxury_watch), ("prop_colonnade_01", colonnade), ("prop_red_carpet_01", red_carpet),
]
METAPHORS = [("met_hierarchy_pyramid_01", hierarchy_pyramid), ("met_power_shadow_01", power_shadow)]


def main() -> None:
    a = run(PROPS, "power")
    b = run(METAPHORS, "power", folder="metaphors", category="metaphor", subcategory="interactive", kind="animated_metaphor")
    print(f"{len(a)} objekte + {len(b)} metafora (pushteti)")


if __name__ == "__main__":
    main()
