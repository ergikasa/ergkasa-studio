"""Props of a world, drawn from parameters. Parts that move have ids and pivots, and `capabilities.recipes`
names the compiler's recipe set that animates them (coin: flip; balance_scale: tilt_left, tilt_right, level).
"""
from __future__ import annotations

from editorial import INK, LICENSE, P, Defs, circle, contact_shadow, ellipse, g, line, path, poly, rect, svg_doc

METALS = {
    "gold": ("#F7D98A", "#E3B66B", "#B98A45"),
    "silver": ("#F2F4F7", "#C9CED8", "#8E99A6"),
    "copper": ("#E8A27A", "#C97A4E", "#8F5434"),
}


def coin(d: Defs, spec: dict) -> dict:
    hi, mid, lo = METALS.get(spec.get("material") or "gold", METALS["gold"])
    motif = spec.get("motif") or "crown"
    face = circle(100, 100, 92, d.d("rim", hi, lo)) + circle(100, 100, 76, d.d("face", mid, lo)) + circle(100, 100, 70, d.d("face2", hi, mid))
    face += circle(100, 100, 70, "none", f'stroke="{lo}" stroke-width="3" stroke-dasharray="4 6"')
    if motif == "crown":
        face += poly([(62, 122), (66, 78), (84, 98), (100, 66), (116, 98), (134, 78), (138, 122)], lo) + rect(60, 118, 80, 14, lo, rx=4)
    elif motif == "star":
        pts = []
        import math
        for i in range(10):
            r = 40 if i % 2 == 0 else 17
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((100 + r * math.cos(a), 100 + r * math.sin(a)))
        face += poly(pts, lo)
    else:
        face += circle(100, 100, 26, "none", f'stroke="{lo}" stroke-width="8"')
    face += path("M40,70 Q60,30 110,24 Q70,40 52,80 Z", "#FFFFFF", 'fill-opacity="0.45"')
    return {"size": (200, 200), "body": g("coin", face, (100, 100)), "parts": {"coin": "the whole coin; flips around its middle"},
            "anchors": {"center": [0.5, 0.5]}, "recipes": "coin", "animations": ["flip", "pop_in", "fade"],
            "name": "Coin", "tags": ["coin", "money", "chance", "flip", "luck"]}


def balance_scale(d: Defs, spec: dict) -> dict:
    gold = (P["gold_l"], P["gold"], P["gold_d"])
    base = contact_shadow(d, 350, 760, 170) + path("M210,760 Q350,700 490,760 Z", d.v("base", gold[1], gold[2]))
    base += rect(336, 150, 28, 590, d.h("post", gold[0], gold[2])) + circle(350, 140, 26, d.d("knob", gold[0], gold[2]))
    beam = rect(80, 156, 540, 18, d.v("beam", gold[0], gold[2]), rx=9) + circle(350, 165, 18, gold[2]) + circle(90, 165, 12, gold[2]) + circle(610, 165, 12, gold[2])

    def pan(cx, key):
        chains = line(f"M{cx},170 L{cx-80},380 M{cx},170 L{cx+80},380 M{cx},170 L{cx},380", gold[2], 4)
        dish = path(f"M{cx-110},380 H{cx+110} Q{cx+100},440 {cx},446 Q{cx-100},440 {cx-110},380 Z", d.v(f"dish{key}", gold[0], gold[2]))
        return chains + dish + ellipse(cx, 380, 110, 12, gold[1])

    body = base + g("pan_l", pan(90, "l"), (90, 165)) + g("pan_r", pan(610, "r"), (610, 165)) + g("beam", beam, (350, 165))
    return {"size": (700, 770), "body": body,
            "parts": {"beam": "the beam; rotates around the post", "pan_l": "left pan, hangs from the beam end", "pan_r": "right pan"},
            "anchors": {"ground": [0.5, 1.0], "pan_l": [0.13, 0.5], "pan_r": [0.87, 0.5]}, "recipes": "balance",
            "animations": ["tilt_left", "tilt_right", "level", "pop_in", "fade"],
            "name": "Balance scale", "tags": ["scale", "balance", "fairness", "justice", "weigh", "rigged"]}


def board(d: Defs, spec: dict) -> dict:
    kind = spec.get("material") or "parchment"
    if kind == "whiteboard":
        body = rect(10, 10, 780, 320, P["slate_d"], rx=18) + rect(26, 26, 748, 288, d.v("wb", "#FFFFFF", "#E8E2D8"), rx=10)
        body += rect(26, 26, 748, 40, "#FFFFFF", rx=10, extra='fill-opacity="0.6"')
    elif kind == "neon":
        body = rect(10, 10, 780, 320, "#141A2A", rx=30) + rect(30, 30, 740, 280, "none", rx=24, extra=f'stroke="{P["violet"]}" stroke-width="10"')
        body += rect(30, 30, 740, 280, "none", rx=24, extra=f'stroke="{P["red_l"]}" stroke-width="3" stroke-opacity="0.8"')
    else:
        body = path("M40,30 Q400,6 760,30 L770,300 Q400,330 30,300 Z", d.v("parch", P["parch_l"], P["parch"]))
        body += path("M40,30 Q400,6 760,30", "none", f'stroke="{P["parch_d"]}" stroke-width="6"')
        body += ellipse(40, 165, 26, 150, d.h("rl", P["parch"], P["parch_d"])) + ellipse(760, 165, 26, 150, d.h("rr", P["parch"], P["parch_d"]))
    return {"size": (800, 340), "body": g("board", body), "parts": {"board": "the board; text is set on it by a text layer"},
            "anchors": {"center": [0.5, 0.5]}, "recipes": None, "animations": ["pop_in", "fade"],
            "name": f"Board ({kind})", "tags": ["sign", "board", "label", kind]}


def pedestal(d: Defs, spec: dict) -> dict:
    body = contact_shadow(d, 200, 400, 160) + rect(60, 60, 280, 340, d.h("ped", P["marble_l"], P["marble_d"]), rx=8)
    body += rect(40, 40, 320, 40, P["marble"], rx=6) + rect(40, 360, 320, 40, P["marble_d"], rx=6)
    return {"size": (400, 400), "body": body, "parts": {}, "anchors": {"top": [0.5, 0.1], "ground": [0.5, 1.0]},
            "recipes": None, "animations": ["pop_in", "fade"], "name": "Pedestal", "tags": ["pedestal", "stand", "display"]}


BUILDERS = {"coin": coin, "balance_scale": balance_scale, "board": board, "pedestal": pedestal}


def build_prop(spec: dict, style: str) -> tuple[str, dict]:
    pid = spec["id"]
    d = Defs(pid)
    p = BUILDERS[spec["kind"]](d, spec)
    w, h = p["size"]
    svg = svg_doc(pid, w, h, d.xml(), p["body"])
    caps: dict = {"animations": p["animations"], "scale": "1 = shkalla e personazhit standard (0.92)"}
    if p["recipes"]:
        caps["recipes"] = p["recipes"]
    meta = {
        "schema": "erkasa.asset/1", "assetId": pid, "version": 1, "name": p["name"], "description": p["name"],
        "category": "object", "subcategory": "world", "kind": "prop", "adapter": "svg", "style": f"world_{style}",
        "files": {"svg": "asset.svg"}, "viewBox": [0, 0, w, h], "capabilities": caps, "anchors": p["anchors"],
        "parts": p["parts"], "themes": ["psychology", "decisions"], "tags": p["tags"], "license": LICENSE,
    }
    return svg, meta


_ = INK  # the studio ink stays available to future props
