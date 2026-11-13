"""Objektet e reja të skenës në stilin `erkasa_editorial_v2` (plani i 300 aseteve).

Çdo funksion vizaton një objekt dhe kthen metadata-t e tij. Rregullat e stilit dhe të shkallës janë te
`editorial.py`. Pamjet anësore janë të kthyera djathtas; motori i kthen majtas me `props.flip`.

Përdorimi: python3 tools/asset-gen/props_v2.py
"""
from __future__ import annotations

from editorial import (HIP_ABOVE_SEAT, INK, LICENSE, P, SEAT_Y_ABOVE_FLOOR, STYLE, TABLE_TOP_ABOVE_FLOOR, Defs,
                       circle, contact_shadow, ellipse, g, line, path, poly, rect, sheen, svg_doc, write_asset)


def prop(name, size, body, anchors, tags, parts, collection, description, story_use,
         themes=("psychology", "growth", "decisions"), animations=("pop_in", "fade", "slide"), variants=None):
    return {"name": name, "size": size, "body": body, "anchors": anchors, "tags": tags, "parts": parts,
            "collection": collection, "description": description, "storyUse": story_use,
            "themes": list(themes), "animations": list(animations), "variants": variants or {}}


# ================================================================ GRUPI 1: shtëpia
def bed_side(d: Defs):
    w, h = 980, 560
    top = h - SEAT_Y_ABOVE_FLOOR - 3          # sipërfaqja e dyshekut: mund të ulesh në fund të krevatit
    body = (
        contact_shadow(d, 490, h, 500, 26)
        + g("frame",
            rect(64, h - 62, 30, 62, d.h("leg", P["wood_d"], P["wood_ddd"])) + rect(872, h - 62, 30, 62, d.h("leg", P["wood_d"], P["wood_ddd"]))
            + rect(30, h - 132, 912, 74, d.v("rail", P["wood"], P["wood_dd"]), rx=10)
            + rect(30, h - 132, 912, 10, P["wood_l"], rx=5)
            + path(f"M14,{h-70} L14,150 Q14,118 46,118 L58,118 Q72,118 72,134 L72,{h-70} Z", d.h("head", P["wood"], P["wood_dd"]))
            + path(f"M24,{h-80} L24,154 Q24,130 46,130 L46,{h-80} Z", P["wood_l"], 'opacity="0.55"'))
        + g("mattress",
            rect(66, top, 880, 96, d.v("mat", P["white"], P["cream3"]), rx=22)
            + rect(66, top + 70, 880, 8, P["sand2"], rx=4))
        + g("pillow",
            path(f"M84,{top+6} Q78,{top-66} 150,{top-70} L258,{top-62} Q300,{top-56} 290,{top-8} Q286,{top+12} 250,{top+10} L110,{top+12} Q88,{top+12} 84,{top+6} Z",
                 d.v("pil", P["white"], P["cream2"]))
            + line(f"M118,{top-22} Q180,{top-40} 250,{top-26}", P["cream3"], 5))
        + g("duvet",
            path(f"M330,{top+4} Q350,{top-40} 430,{top-34} Q600,{top-52} 760,{top-36} Q900,{top-44} 944,{top-8} "
                 f"Q962,{top+40} 950,{top+112} Q760,{top+128} 560,{top+116} Q420,{top+126} 322,{top+108} Q306,{top+50} 330,{top+4} Z",
                 d.v("duv", P["blue_l"], P["blue_d"], P["blue"]))
            + path(f"M330,{top+4} Q350,{top-40} 430,{top-34} Q404,{top+20} 420,{top+112} Q360,{top+112} 322,{top+108} Q306,{top+50} 330,{top+4} Z",
                   P["cream"], 'opacity="0.92"')
            + line(f"M520,{top-30} Q500,{top+40} 530,{top+110}", P["blue_dd"], 5, 'opacity="0.45"')
            + line(f"M720,{top-34} Q742,{top+30} 716,{top+112}", P["blue_dd"], 5, 'opacity="0.45"'))
    )
    anchors = {"ground": [0.5, 1.0], "lie": [0.52, (top - 6) / h], "head": [190 / w, (top - 40) / h],
               "seat": [880 / w, top / h], "hip": [880 / w, (top - HIP_ABOVE_SEAT) / h]}
    return prop("Krevat (anash)", (w, h), body, anchors,
                ["bed", "sleep", "bedroom", "home", "rest", "insomnia", "morning", "procrastination", "furniture"],
                {"duvet": "statik; fshihet për krevat të rregulluar", "pillow": "statik"}, "home",
                "A single bed seen from the side: wooden frame and headboard on the left, mattress, pillow, blue duvet.",
                "Sleep, snoozing, not wanting to get up, insomnia and late-night thoughts. A character can sit on the foot end (anchor hip).")


def sofa(d: Defs):
    w, h = 940, 470
    seat = h - SEAT_Y_ABOVE_FLOOR
    body = (
        contact_shadow(d, 470, h, 480, 24)
        + g("feet", "".join(rect(x, h - 34, 26, 34, d.h("foot", P["wood_d"], P["wood_ddd"]), rx=4) for x in (60, 854)))
        + g("back", rect(86, 44, 768, 290, d.v("back", P["blue"], P["blue_d"]), rx=46)
            + path("M130,66 Q470,40 810,66 L810,84 Q470,58 130,84 Z", P["blue_l"], 'opacity="0.55"'))
        + g("base", rect(70, seat + 62, 800, 118, d.v("base", P["blue_d"], P["blue_dd"]), rx=22))
        + g("cushions",
            rect(128, seat - 4, 338, 92, d.v("cu", P["blue_l"], P["blue"]), rx=34)
            + rect(474, seat - 4, 338, 92, d.v("cu", P["blue_l"], P["blue"]), rx=34)
            + line(f"M160,{seat+74} Q296,{seat+86} 436,{seat+74}", P["blue_d"], 5, 'opacity="0.5"')
            + line(f"M506,{seat+74} Q642,{seat+86} 782,{seat+74}", P["blue_d"], 5, 'opacity="0.5"'))
        + g("arms",
            rect(22, seat - 76, 128, 270, d.h("arm_l", P["blue_l"], P["blue_d"], P["blue"]), rx=50)
            + rect(790, seat - 76, 128, 270, d.h("arm_r", P["blue"], P["blue_dd"], P["blue_d"]), rx=50))
        + g("pillow", path(f"M560,{seat-112} Q640,{seat-132} 716,{seat-106} Q734,{seat-40} 712,{seat+6} Q634,{seat+22} 566,{seat+2} Q546,{seat-56} 560,{seat-112} Z",
                           d.d("pl", P["orange"], P["orange_d"]))
            + line(f"M590,{seat-84} Q640,{seat-96} 690,{seat-82}", P["gold_l"], 5, 'opacity="0.6"'))
    )
    anchors = {"ground": [0.5, 1.0], "seat_left": [297 / w, seat / h], "seat_right": [643 / w, seat / h],
               "hip_left": [297 / w, (seat - HIP_ABOVE_SEAT) / h], "hip_right": [643 / w, (seat - HIP_ABOVE_SEAT) / h]}
    return prop("Divan", (w, h), body, anchors,
                ["sofa", "couch", "living-room", "home", "rest", "passive", "binge", "comfort", "furniture"],
                {"pillow": "statik; mund të fshihet"}, "home",
                "A two-seat sofa seen from the front, blue upholstery with an orange throw pillow.",
                "Passivity, binge-watching, comfort zone, a couple sitting apart. Two seat anchors, left and right.")


def fridge(d: Defs):
    w, h = 320, 780
    x0, x1 = 20, 300
    body = (
        contact_shadow(d, 160, h, 170, 16)
        + g("body",
            rect(x0, 16, x1 - x0, h - 36, d.h("shell", P["steel_l"], P["steel_d"], P["steel"]), rx=20)
            + rect(x0 + 30, h - 22, 40, 22, P["slate_d"], rx=4) + rect(x1 - 70, h - 22, 40, 22, P["slate_d"], rx=4))
        + g("interior",
            rect(x0 + 16, 256, x1 - x0 - 32, 470, d.v("in", P["warm_light2"], P["cream2"]), rx=8)
            + "".join(rect(x0 + 16, y, x1 - x0 - 32, 8, P["steel"]) for y in (392, 520, 640))
            + rect(54, 322, 34, 70, P["green"], rx=8) + rect(96, 340, 46, 52, P["red"], rx=10) + circle(190, 366, 26, P["orange"])
            + rect(60, 464, 80, 56, P["gold"], rx=8) + rect(160, 440, 30, 80, P["blue"], rx=8) + rect(198, 452, 30, 68, P["cream3"], rx=8)
            + circle(84, 612, 26, P["green_d"]) + circle(140, 616, 22, P["red_l"]) + rect(190, 580, 70, 60, P["teal"], rx=10))
        + g("freezer_door",
            rect(x0 + 6, 22, x1 - x0 - 12, 214, d.h("fz", P["white"], P["steel"], P["steel_l"]), rx=14)
            + rect(x1 - 40, 70, 12, 120, d.h("hd", P["steel_d"], P["steel_dd"]), rx=6)
            + sheen(f"M{x0+26},40 L{x0+62},40 L{x0+40},220 L{x0+18},220 Z", 0.5))
        + g("door",
            rect(x0 + 6, 246, x1 - x0 - 12, 496, d.h("dr", P["white"], P["steel"], P["steel_l"]), rx=14)
            + rect(x1 - 40, 290, 12, 190, d.h("hd", P["steel_d"], P["steel_dd"]), rx=6)
            + sheen(f"M{x0+26},264 L{x0+66},264 L{x0+36},724 L{x0+18},724 Z", 0.5)
            + rect(70, 330, 46, 46, P["gold_l"], rx=3, extra='transform="rotate(-6 93 353)"') + circle(93, 334, 6, P["red"]),
            (x0 + 6, 494))
    )
    anchors = {"ground": [0.5, 1.0], "hinge": [(x0 + 6) / w, 494 / h], "handle": [(x1 - 34) / w, 385 / h], "center": [0.5, 0.5]}
    return prop("Frigorifer", (w, h), body, anchors,
                ["fridge", "refrigerator", "kitchen", "food", "home", "temptation", "snack", "emotional-eating", "habit"],
                {"door": "scaleX 1 → 0.12: hapet rreth menteshës majtas dhe zbulon brendësinë", "freezer_door": "statike", "interior": "statike"},
                "home",
                "A tall fridge-freezer seen from the front. The main door opens to show lit shelves with food.",
                "Emotional eating, temptation, the late-night snack habit, opening the fridge with no reason (boredom).")


def kitchen_table(d: Defs):
    w, h = 600, 372
    top = h - TABLE_TOP_ABOVE_FLOOR
    body = (
        contact_shadow(d, 300, h, 300, 18)
        + g("legs",
            poly([(52, top + 30), (86, top + 30), (78, h), (58, h)], d.h("lg", P["wood"], P["wood_dd"]))
            + poly([(514, top + 30), (548, top + 30), (542, h), (522, h)], d.h("lg", P["wood"], P["wood_dd"])))
        + g("apron", rect(40, top + 26, 520, 44, d.v("ap", P["wood_d"], P["wood_dd"]), rx=6))
        + g("top", rect(0, top, w, 30, d.v("tp", P["wood_l"], P["wood"]), rx=8)
            + rect(0, top + 22, w, 8, P["wood_d"], rx=4) + rect(18, top + 4, 564, 5, P["cream2"], rx=2, extra='opacity="0.5"'))
    )
    return prop("Tavolinë kuzhine", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, top / h]},
                ["table", "kitchen", "dining", "home", "family", "meal", "conversation", "furniture"],
                {"top": "shtresë përpara: mbulon këmbët e personazheve të ulur"}, "home",
                "A wooden kitchen table seen from the side, same height as the office desk.",
                "Family conversations, decisions made at home, eating alone, an argument across the table.")


def kitchen_chair(d: Defs):
    w, h = 240, 540
    seat = h - SEAT_Y_ABOVE_FLOOR
    body = (
        contact_shadow(d, 122, h, 122, 12)
        + g("frame",
            poly([(54, seat + 8), (76, seat + 8), (68, h), (52, h)], d.h("lg", P["wood"], P["wood_dd"]))
            + poly([(184, seat + 8), (206, seat + 8), (204, h), (188, h)], d.h("lg", P["wood"], P["wood_dd"]))
            + rect(62, seat + 96, 136, 14, P["wood_d"], rx=5))
        + g("back",
            path(f"M52,{seat+10} L30,60 Q28,36 46,34 Q62,32 64,52 L78,{seat+10} Z", d.h("bk", P["wood"], P["wood_dd"]))
            + rect(34, 70, 20, 96, P["wood_l"], rx=8, extra=f'transform="rotate(-5 44 118)" opacity="0.7"'))
        + g("seat",
            rect(38, seat, 180, 22, d.v("st", P["wood_l"], P["wood_d"]), rx=8)
            + rect(48, seat - 14, 160, 20, d.v("cs", P["red_l"], P["red_d"]), rx=10))
    )
    anchors = {"ground": [0.5, 1.0], "hip": [128 / w, (seat - 14 - HIP_ABOVE_SEAT + 12) / h], "seat": [128 / w, (seat - 14) / h]}
    return prop("Karrige kuzhine (anash)", (w, h), body, anchors,
                ["chair", "kitchen", "dining", "home", "sit", "empty-chair", "furniture"],
                {"frame": "pa animim; personazhi ulet me `sit` dhe ijët në anchor `hip`"}, "home",
                "A wooden dining chair with a red seat pad, seen from the side, facing right.",
                "Sitting at home, a family meal, or an empty chair that shows someone is missing.")


def tv(d: Defs):
    w, h = 760, 640
    body = (
        contact_shadow(d, 380, h, 390, 20)
        + g("console",
            "".join(poly([(x, h - 150), (x + 26, h - 150), (x + 18, h), (x + 8, h)], P["wood_ddd"]) for x in (70, 664))
            + rect(20, h - 190, 720, 130, d.v("cn", P["wood_l"], P["wood_d"]), rx=12)
            + rect(20, h - 190, 720, 12, P["cream2"], rx=6, extra='opacity="0.45"')
            + rect(44, h - 160, 326, 82, P["wood_d"], rx=8) + rect(390, h - 160, 326, 82, P["wood_d"], rx=8)
            + rect(180, h - 126, 54, 10, P["wood_ddd"], rx=5) + rect(526, h - 126, 54, 10, P["wood_ddd"], rx=5))
        + g("stand", rect(350, h - 222, 60, 34, P["slate_d"]) + rect(290, h - 200, 180, 12, P["slate_dd"], rx=6))
        + g("bezel", rect(60, 24, 640, 384, d.d("bz", P["slate"], P["slate_dd"]), rx=18))
        + g("screen",
            rect(78, 42, 604, 348, d.d("sc", P["blue"], P["night"]), rx=8)
            + ellipse(380, 216, 290, 160, d.glow("scglow", P["screen"], 0.55, 0.0))
            + sheen("M110,42 L250,42 L170,390 L78,390 L78,120 Z", 0.1), (380, 216))
        + g("led", circle(380, 399, 4, P["red_l"]))
    )
    anchors = {"ground": [0.5, 1.0], "screen": [0.5, 216 / h], "top": [0.5, (h - 190) / h]}
    return prop("Televizor", (w, h), body, anchors,
                ["tv", "television", "screen", "living-room", "home", "media", "news", "distraction", "binge", "tech"],
                {"screen": "pulse (opacity 0.75 ↔ 1) = drita e ekranit; përmbajtja vendoset mbi anchor `screen`", "led": "statike"},
                "home",
                "A flat-screen TV on a low wooden console, seen from the front, screen glowing blue.",
                "Distraction, passive media influence, news framing, binge-watching. Place content over the screen anchor.")


def trash_bin(d: Defs):
    w, h = 220, 300
    body = (
        contact_shadow(d, 110, h, 112, 12)
        + g("papers",
            path("M62,84 L86,52 L112,70 L138,44 L162,72 L150,100 L76,104 Z", d.v("pp", P["white"], P["cream3"]))
            + path("M86,52 L100,82 L138,44 M112,70 L122,98", "none", f'stroke="{P["sand2"]}" stroke-width="4" stroke-linejoin="round"')
            + path("M150,60 L186,48 L196,84 L164,98 Z", d.v("pp", P["white"], P["cream3"]))
            + path("M150,60 L176,74 L196,84", "none", f'stroke="{P["sand2"]}" stroke-width="4"'))
        + g("bin",
            poly([(36, 92), (184, 92), (166, h - 6), (54, h - 6)], d.h("bn", P["slate_l"], P["slate_dd"], P["slate"]))
            + "".join(poly([(x, 108), (x + 10, 108), (x + 8 - (x - 110) * 0.1, h - 22), (x + 2 - (x - 110) * 0.1, h - 22)], P["slate_dd"], 'opacity="0.55"')
                      for x in (62, 88, 114, 140, 162))
            + rect(28, 84, 164, 20, d.v("rm", P["steel"], P["steel_dd"]), rx=10))
    )
    return prop("Kosh plehrash", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, 92 / h]},
                ["trash", "bin", "waste", "paper", "office", "home", "give-up", "discard", "failure", "perfectionism"],
                {"papers": "pop_in / bounce: letra që hidhen; fshihet për kosh bosh"}, "home",
                "A dark waste bin with crumpled paper balls on top.",
                "Giving up, discarded ideas and drafts, perfectionism, clearing the mind.",
                animations=("pop_in", "fade", "slide", "shake"))


def window(d: Defs, mode="day"):
    w, h = 600, 760
    gx, gy, gw, gh = 44, 44, 512, 600
    if mode == "night":
        view = (rect(gx, gy, gw, gh, d.v("sky", P["night"], P["night3"]))
                + circle(430, 170, 46, P["warm_light2"]) + circle(450, 158, 40, P["night2"])
                + "".join(circle(x, y, r, P["white"], 'opacity="0.8"') for x, y, r in ((120, 120, 3), (220, 210, 2.5), (320, 110, 3), (160, 300, 2.5), (500, 320, 3), (380, 260, 2)))
                + path(f"M{gx},520 L120,520 L120,430 L210,430 L210,480 L300,480 L300,390 L400,390 L400,500 L480,500 L480,450 L{gx+gw},450 V{gy+gh} H{gx} Z", P["night2"])
                + "".join(rect(x, y, 16, 20, P["warm_light"]) for x, y in ((140, 460), (176, 500), (320, 420), (356, 470), (320, 520), (500, 480))))
    elif mode == "rain":
        view = (rect(gx, gy, gw, gh, d.v("sky", P["steel_dd"], P["steel"]))
                + ellipse(220, 112, 170, 62, P["steel_dd"]) + ellipse(400, 150, 150, 56, P["slate_l"])
                + path(f"M{gx},540 Q200,480 340,520 T{gx+gw},500 V{gy+gh} H{gx} Z", P["green_dd"])
                + "".join(line(f"M{x},{y} l-14,44", P["steel_l"], 4, 'opacity="0.75"')
                          for x, y in ((120, 220), (200, 300), (280, 210), (360, 320), (440, 240), (520, 330), (160, 420), (320, 440), (480, 430), (240, 520), (410, 540))))
    else:
        view = (rect(gx, gy, gw, gh, d.v("sky", P["sky"], P["sky_l"]))
                + circle(150, 290, 34, P["white"]) + circle(196, 270, 44, P["white"]) + circle(244, 292, 32, P["white"]) + rect(140, 290, 116, 34, P["white"], rx=17)
                + circle(400, 170, 26, P["white"]) + circle(436, 156, 34, P["white"]) + circle(472, 174, 24, P["white"]) + rect(394, 172, 86, 26, P["white"], rx=13)
                + path(f"M{gx},520 Q180,450 320,500 T{gx+gw},470 V{gy+gh} H{gx} Z", P["green_l"])
                + path(f"M{gx},570 Q220,510 380,560 T{gx+gw},540 V{gy+gh} H{gx} Z", P["green"]))
    frame_fill = d.v("fr", P["white"], P["cream3"])
    body = (
        g("view", view)
        + g("glass", sheen(f"M{gx+40},{gy} L{gx+150},{gy} L{gx+40},{gy+gh} L{gx},{gy+gh} L{gx},{gy+200} Z", 0.16 if mode == "day" else 0.07)
            + sheen(f"M{gx+330},{gy} L{gx+380},{gy} L{gx+200},{gy+gh} L{gx+150},{gy+gh} Z", 0.1 if mode == "day" else 0.05))
        + g("frame",
            path(f"M20,20 H{w-20} V{gy+gh+24} H20 Z M{gx},{gy} V{gy+gh} H{gx+gw} V{gy} Z", frame_fill, 'fill-rule="evenodd"')
            + rect(gx + gw / 2 - 9, gy, 18, gh, frame_fill) + rect(gx, gy + gh * 0.46, gw, 16, frame_fill)
            + rect(gx, gy, gw, 6, P["sand3"], extra='opacity="0.45"') + rect(gx, gy, 6, gh, P["sand3"], extra='opacity="0.3"'))
        + g("sill", rect(0, gy + gh + 22, w, 34, d.v("sl", P["white"], P["cream3"]), rx=8) + rect(10, gy + gh + 54, w - 20, 14, P["sand3"], rx=6))
    )
    return prop("Dritare", (w, h), body, {"center": [0.5, 0.45], "sill": [0.5, (gy + gh + 22) / h]},
                ["window", "home", "view", "outside", "hope", "loneliness", "waiting", "day", "night", "rain"],
                {"view": "statike; variantet `night` dhe `rain` ndërrojnë pamjen", "frame": "statike"}, "home",
                "A wall window with a white frame and sill. Day view by default; night and rain variants.",
                "Hope, looking out at a life passing by, loneliness, waiting. Night and rain variants set the mood.",
                variants={"night": "night.svg", "rain": "rain.svg"})


def wall_mirror(d: Defs):
    w, h = 340, 840
    body = (
        contact_shadow(d, 170, h, 170, 14)
        + g("stand",
            poly([(52, h), (78, h), (120, 640), (96, 640)], d.h("ft", P["wood"], P["wood_ddd"]))
            + poly([(288, h), (262, h), (220, 640), (244, 640)], d.h("ft", P["wood_d"], P["wood_ddd"])))
        + g("frame", rect(48, 24, 244, 740, d.h("fr", P["gold_l"], P["gold_d"], P["gold"]), rx=122))
        + g("glass",
            rect(70, 46, 200, 696, d.d("gl", P["sky_l"], P["glass"]), rx=100)
            + sheen("M112,64 L176,54 L92,560 L74,520 L74,200 Q76,110 112,64 Z", 0.5)
            + sheen("M214,96 L246,150 L168,700 L140,724 Z", 0.28))
    )
    return prop("Pasqyrë në këmbë", (w, h), body, {"ground": [0.5, 1.0], "glass": [0.5, 394 / h]},
                ["mirror", "reflection", "self-image", "self-esteem", "identity", "bedroom", "home", "vanity"],
                {"glass": "statike; një personazh i dytë (i kthyer me flip) mund të vendoset mbi anchor `glass` si reflektim"}, "home",
                "A full-length standing mirror with a rounded gold frame.",
                "Self-image and self-esteem: the character facing themselves, the gap between who they are and who they see.")


def alarm_clock(d: Defs):
    w, h = 220, 250
    cx, cy, r = 110, 152, 74
    body = (
        contact_shadow(d, 110, h, 100, 9)
        + g("feet", poly([(54, 206), (72, 216), (50, h - 2), (38, h - 2)], P["slate_d"]) + poly([(166, 206), (148, 216), (170, h - 2), (182, h - 2)], P["slate_d"]))
        + g("bells",
            path("M10,58 Q10,10 62,6 Q88,6 96,26 L34,82 Q12,80 10,58 Z", d.d("bl", P["gold_l"], P["gold_d"]))
            + path("M210,58 Q210,10 158,6 Q132,6 124,26 L186,82 Q208,80 210,58 Z", d.d("br", P["gold_l"], P["gold_d"]))
            + line("M52,60 L70,84 M168,60 L150,84", P["slate_d"], 8)
            + rect(104, 14, 12, 40, P["slate_d"], rx=5) + circle(110, 14, 11, P["slate_d"]), (110, 60))
        + g("case", circle(cx, cy, r + 14, d.d("cs", P["red_l"], P["red_d"])) + circle(cx, cy, r, d.d("fc", P["white"], P["cream2"]))
            + "".join(rect(cx - 3, cy - r + 8, 6, 16, P["slate_d"], rx=3, extra=f'transform="rotate({a} {cx} {cy})"') for a in range(0, 360, 30)))
        + g("hour", rect(cx - 5, cy - 44, 10, 50, INK, rx=5), (cx, cy))
        + g("minute", rect(cx - 3.5, cy - 62, 7, 68, INK, rx=3.5, extra=f'transform="rotate(60 {cx} {cy})"'), (cx, cy))
        + g("pin", circle(cx, cy, 8, P["red"]))
        + sheen(f"M{cx-52},{cy-40} Q{cx-20},{cy-70} {cx+16},{cy-70} Q{cx-24},{cy-56} {cx-44},{cy-22} Z", 0.6)
    )
    return prop("Orë me zile", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, cy / h]},
                ["alarm", "clock", "morning", "wake-up", "snooze", "time", "discipline", "deadline", "bedroom"],
                {"bells": "shake: zilja bie", "hour": "rotation (orët)", "minute": "rotation (minutat)"}, "home",
                "A classic red twin-bell alarm clock.",
                "Snoozing, discipline, the start of the day, time pressure.",
                animations=("pop_in", "fade", "slide", "shake", "bounce"))


def clothes_pile(d: Defs):
    w, h = 460, 250
    body = (
        contact_shadow(d, 230, h, 232, 16)
        + g("pile",
            path(f"M40,{h-6} Q20,170 96,140 Q170,84 262,112 Q352,96 410,160 Q448,206 424,{h-6} Z", d.v("jn", P["blue"], P["blue_dd"]))
            + path(f"M250,116 Q330,104 392,156 Q360,150 326,170 Q300,128 250,116 Z", P["blue_l"], 'opacity="0.6"')
            + path(f"M70,{h-6} Q64,176 132,150 Q190,96 236,124 Q262,178 240,{h-6} Z", d.v("ts", P["orange"], P["orange_d"]))
            + path("M132,150 Q170,150 196,124 Q188,160 210,186 Q170,170 132,150 Z", P["gold_l"], 'opacity="0.5"')
            + path(f"M196,{h-6} Q214,170 286,168 Q352,168 366,{h-6} Z", d.v("sh", P["white"], P["cream3"]))
            + line(f"M250,182 Q282,196 318,180", P["sand3"], 5) + line(f"M284,190 L284,{h-14}", P["sand3"], 4)
            + path(f"M330,{h-6} Q336,196 380,192 Q412,196 412,214 Q396,222 384,218 L378,{h-6} Z", d.v("sk", P["red_l"], P["red_d"]))
            + rect(346, 196, 60, 12, P["cream"], rx=6, extra='transform="rotate(4 376 202)"'))
    )
    return prop("Grumbull rrobash", (w, h), body, {"ground": [0.5, 1.0]},
                ["clothes", "laundry", "mess", "clutter", "bedroom", "home", "procrastination", "chores", "overwhelm"],
                {"pile": "statik"}, "home",
                "A messy pile of clothes on the floor: jeans, an orange t-shirt, a white shirt and a sock.",
                "Visible procrastination and mental clutter: the chore that keeps getting postponed.")


def hanging_bulb(d: Defs):
    w, h = 300, 600
    cx, by = 150, 430
    body = (
        g("glow", circle(cx, by, 148, d.glow("gl", P["warm_light"], 0.85, 0.0, 0.3)), (cx, by))
        + g("lamp",
            line(f"M{cx},0 V{by-128}", P["slate_dd"], 6)
            + rect(cx - 26, by - 132, 52, 50, d.h("sk", P["slate_l"], P["slate_dd"]), rx=8)
            + rect(cx - 30, by - 92, 60, 12, P["steel_d"], rx=6)
            + path(f"M{cx-24},{by-80} Q{cx-70},{by-30} {cx-64},{by+14} Q{cx-56},{by+72} {cx},{by+74} Q{cx+56},{by+72} {cx+64},{by+14} Q{cx+70},{by-30} {cx+24},{by-80} Z",
                   d.d("bb", P["warm_light2"], P["gold_l"]))
            + line(f"M{cx-14},{by-70} L{cx-10},{by-6} L{cx},{by-24} L{cx+10},{by-6} L{cx+14},{by-70}", P["gold_d"], 4)
            + sheen(f"M{cx-44},{by-20} Q{cx-48},{by+30} {cx-22},{by+52} Q{cx-34},{by+22} {cx-30},{by-24} Z", 0.75),
            (cx, 0))
    )
    return prop("Llambë e varur", (w, h), body, {"top": [0.5, 0.0], "center": [0.5, by / h]},
                ["bulb", "lamp", "light", "idea", "insight", "aha", "realization", "discovery", "home"],
                {"glow": "opacity 0 → 1 = llamba ndizet (momenti \"aha\"); pulse për dritë që dridhet", "lamp": "sway rreth majës së kordonit"},
                "home",
                "A bare light bulb hanging from a cord, lit, with a warm glow.",
                "The idea, the insight, the 'aha' moment. Fade the glow in when the character realises something.",
                animations=("pop_in", "fade", "slide", "sway", "pulse"))


# ================================================================ GRUPI 1: objekte të përditshme
def keys(d: Defs):
    w, h = 200, 230

    def key(fill, rot, length=112):
        return (f'<g transform="rotate({rot} 100 62)">'
                + path(f"M88,62 Q88,44 100,44 Q112,44 112,62 L108,{62+length} L100,{62+length+12} L92,{62+length} Z", fill)
                + path(f"M108,{62+length-44} h14 v10 h-10 v8 h10 v10 h-14 Z", fill)
                + circle(100, 74, 9, P["cream"]) + "</g>")

    body = (
        g("ring", f'<circle cx="100" cy="46" r="34" fill="none" stroke="{d.d("rg", P["steel_l"], P["steel_dd"])}" stroke-width="9"/>')
        + g("key_back", key(d.h("k2", P["steel_l"], P["steel_d"]), 26, 100))
        + g("fob", f'<g transform="rotate(-34 100 62)">' + rect(80, 78, 40, 74, d.d("fb", P["red_l"], P["red_d"]), rx=12) + circle(100, 92, 6, P["cream"]) + "</g>")
        + g("key_front", key(d.h("k1", P["gold_l"], P["gold_d"]), -2))
    )
    return prop("Çelësa", (w, h), body, {"center": [0.5, 0.5], "top": [0.5, 12 / h]},
                ["keys", "key", "access", "home", "car", "responsibility", "forget", "memory", "attention", "security"],
                {"ring": "statik", "key_front": "sway i lehtë"}, "everyday",
                "A key ring with a gold key, a silver key and a red fob.",
                "Responsibility and access; the classic 'where did I put my keys?' for memory and attention lapses.",
                animations=("pop_in", "fade", "slide", "sway", "shake"))


def wallet(d: Defs, mode: str = "closed"):
    w, h = 260, 190
    if mode == "open":
        body = (
            contact_shadow(d, 130, h, 124, 9)
            + g("body", path("M14,70 L120,58 L130,182 L22,182 Z", d.v("lt", P["wood"], P["wood_dd"])) + path("M246,70 L140,58 L130,182 L238,182 Z", d.v("rt", P["wood_d"], P["wood_ddd"]))
                + rect(34, 96, 74, 46, d.d("cd", P["gold_l"], P["gold_d"]), rx=6) + rect(34, 104, 74, 8, P["wood_dd"], extra='opacity="0.5"')
                + rect(152, 84, 78, 82, P["wood_ddd"], rx=6) + rect(160, 92, 62, 6, P["wood_d"], rx=3)
                + line("M126,60 L130,182", P["wood_ddd"], 4)))
        return prop("Portofol (i hapur, bosh)", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.6]},
                    ["wallet", "empty", "broke", "money", "budget", "spending"], {"body": "statik"}, "everyday",
                    "An open, empty leather wallet.", "Being broke, an empty wallet at the end of the month.", themes=("money", "psychology", "decisions"))
    body = (
        contact_shadow(d, 130, h, 124, 9)
        + g("bills", rect(42, 20, 170, 80, d.v("bl", P["green_l"], P["green_d"]), rx=6, extra='transform="rotate(-5 127 60)"')
            + rect(70, 14, 150, 80, d.v("bl2", P["green"], P["green_dd"]), rx=6, extra='transform="rotate(3 145 54)"')
            + circle(146, 46, 16, P["green_l"], 'opacity="0.7"'))
        + g("card", rect(150, 34, 84, 60, d.d("cd", P["gold_l"], P["gold_d"]), rx=7))
        + g("body",
            rect(14, 56, 232, 126, d.v("lt", P["wood"], P["wood_dd"]), rx=18)
            + rect(14, 56, 232, 16, P["wood_l"], rx=8, extra='opacity="0.6"')
            + f'<rect x="26" y="68" width="208" height="102" rx="12" fill="none" stroke="{P["wood_l"]}" stroke-width="3" stroke-dasharray="9 7" opacity="0.8"/>'
            + rect(192, 104, 54, 34, d.v("tb", P["wood_d"], P["wood_ddd"]), rx=10) + circle(214, 121, 7, P["gold"]))
    )
    return prop("Portofol", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.6]},
                ["wallet", "money", "cash", "card", "spending", "identity", "budget", "broke", "consumer"],
                {"bills": "slide lart/poshtë; fshihet për portofol bosh", "card": "slide lart = pagesë me kartë"}, "everyday",
                "A brown leather wallet with banknotes and a card sticking out. Variant `open`: the wallet open and empty.",
                "Money and identity, the pain of paying, an empty wallet for financial insecurity (variant `open`).",
                themes=("money", "psychology", "decisions"), variants={"open": "open.svg"})


def wristwatch(d: Defs):
    w, h = 150, 280
    cx, cy = 75, 140
    body = (
        g("strap",
            path("M46,96 L52,8 Q54,0 62,0 L88,0 Q96,0 98,8 L104,96 Z", d.h("st", P["wood_d"], P["wood_ddd"]))
            + path("M46,184 L52,272 Q54,280 62,280 L88,280 Q96,280 98,272 L104,184 Z", d.h("st", P["wood_d"], P["wood_ddd"]))
            + "".join(circle(cx, y, 4, P["wood_ddd"]) for y in (214, 234, 254))
            + rect(54, 20, 42, 9, P["steel"], rx=4))
        + g("case", rect(128, 128, 16, 24, P["steel_d"], rx=5)
            + circle(cx, cy, 62, d.d("cs", P["steel_l"], P["steel_dd"])) + circle(cx, cy, 50, d.d("fc", P["white"], P["cream2"]))
            + "".join(rect(cx - 2.5, cy - 46, 5, 11, P["slate_d"], rx=2, extra=f'transform="rotate({a} {cx} {cy})"') for a in range(0, 360, 30)))
        + g("hour", rect(cx - 4, cy - 28, 8, 32, INK, rx=4, extra=f'transform="rotate(-60 {cx} {cy})"'), (cx, cy))
        + g("minute", rect(cx - 3, cy - 40, 6, 44, INK, rx=3, extra=f'transform="rotate(20 {cx} {cy})"'), (cx, cy))
        + g("pin", circle(cx, cy, 5, P["red"]))
        + sheen(f"M{cx-36},{cy-22} Q{cx-16},{cy-44} {cx+10},{cy-46} Q{cx-18},{cy-34} {cx-30},{cy-10} Z", 0.6)
    )
    return prop("Orë dore", (w, h), body, {"center": [0.5, 0.5]},
                ["watch", "wristwatch", "time", "deadline", "late", "pressure", "status", "punctual"],
                {"hour": "rotation (orët)", "minute": "rotation (minutat)"}, "everyday",
                "A wristwatch with a steel case and a brown leather strap, seen from the front.",
                "Time pressure and status; as an insert shot it pairs with the character action check_watch.",
                animations=("pop_in", "fade", "slide", "pulse"))


def glasses(d: Defs):
    w, h = 300, 130
    rim = d.d("rm", P["slate_l"], P["slate_dd"])

    def lens(x):
        return (rect(x, 26, 112, 84, rim, rx=30) + rect(x + 10, 36, 92, 64, d.d("ln", P["sky_l"], P["glass"]), rx=22)
                + sheen(f"M{x+22},44 L{x+52},44 L{x+30},92 L{x+16},84 Z", 0.6))

    body = (
        g("temples", line("M24,50 Q8,44 6,26", P["slate_dd"], 9) + line("M276,50 Q292,44 294,26", P["slate_dd"], 9))
        + g("frame", lens(22) + lens(166) + line("M134,58 Q150,40 166,58", P["slate_dd"], 10))
    )
    return prop("Syze", (w, h), body, {"center": [0.5, 0.52]},
                ["glasses", "perspective", "view", "clarity", "focus", "bias", "framing", "see", "smart"],
                {"frame": "statike"}, "everyday",
                "A pair of dark-rimmed glasses seen from the front.",
                "Perspective: 'seeing it differently', framing and bias, sudden clarity when they go on.")


PROPS = [
    ("prop_bed_side_01", bed_side), ("prop_sofa_01", sofa), ("prop_fridge_01", fridge),
    ("prop_kitchen_table_01", kitchen_table), ("prop_kitchen_chair_01", kitchen_chair), ("prop_tv_01", tv),
    ("prop_trash_bin_01", trash_bin), ("prop_window_01", window), ("prop_wall_mirror_01", wall_mirror),
    ("prop_alarm_clock_01", alarm_clock), ("prop_clothes_pile_01", clothes_pile), ("prop_hanging_bulb_01", hanging_bulb),
    ("prop_keys_01", keys), ("prop_wallet_01", wallet), ("prop_wristwatch_01", wristwatch), ("prop_glasses_01", glasses),
]


def main() -> None:
    for asset_id, fn in PROPS:
        d = Defs(asset_id)
        p = fn(d)
        w, h = p["size"]
        files = {"asset.svg": svg_doc(asset_id, w, h, d.xml(), p["body"])}
        for key, fname in p["variants"].items():
            dv = Defs(f"{asset_id}_{key}")
            pv = fn(dv, key)
            files[fname] = svg_doc(asset_id, w, h, dv.xml(), pv["body"])
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": p["name"],
            "description": p["description"], "category": "object", "subcategory": "scene_prop",
            "collection": p["collection"], "storyUse": p["storyUse"],
            "kind": "prop", "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"},
            **({"variants": p["variants"]} if p["variants"] else {}),
            "viewBox": [0, 0, w, h],
            "capabilities": {"animations": p["animations"], "scale": "1 = shkalla e personazhit standard (0.92)"},
            "anchors": p["anchors"], "parts": p["parts"], "themes": p["themes"], "tags": p["tags"], "license": LICENSE,
        }
        write_asset("props", meta, files)
    print(f"{len(PROPS)} props ({STYLE})")


if __name__ == "__main__":
    main()
