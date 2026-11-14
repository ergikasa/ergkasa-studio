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


# ------------------------------------------------------------------ objects that explain (states)

def _text(x, y, content, size, fill, weight=800):
    return (f'<text x="{x}" y="{y}" font-family="Montserrat" font-weight="{weight}" font-size="{size}" '
            f'text-anchor="middle" fill="{fill}">{content}</text>')


def screen(d: Defs, spec: dict) -> dict:
    """A phone or a sign whose big text changes: values[0] shows first; to_value_1..5 swap to the next."""
    values = (spec.get("values") or ["OK"])[:6]
    device = spec.get("material") or "phone"
    if device == "sign":
        w, h = 520, 300
        body = rect(6, 6, w - 12, h - 12, "#E3B66B", rx=30) + rect(16, 16, w - 32, h - 32, P["slate_dd"], rx=22) + rect(34, 34, w - 68, h - 68, "#1D2B4A", rx=14)
        cx, cy, fs = w / 2, h / 2 + 34, 118
        top = ""
    else:
        w, h = 300, 560
        body = contact_shadow(d, 150, 548, 110) + rect(4, 4, 292, 552, "#B8C1CC", rx=48) + rect(10, 10, 280, 540, P["slate_dd"], rx=44) + rect(26, 28, 248, 504, "#1D2B4A", rx=30)
        body += rect(112, 40, 76, 12, P["slate_dd"], rx=6)
        cx, cy, fs = 150, 320, 96
        top = rect(206, 66, 44, 20, "none", rx=5, extra=f'stroke="#F6F3EE" stroke-width="3"') + rect(209, 69, 12, 14, "#F6F3EE", rx=2)
    longest = max(len(v) for v in values)
    fs = int(min(fs, (w - 90) / max(1, longest) * 1.55))
    vals = ""
    for i, v in enumerate(values):
        color = "#FFE7A8" if device == "sign" else "#F6F3EE"
        vals += g(f"v{i}", _text(cx, cy, v, fs, color), (cx, cy - fs / 3))
    return {"size": (w, h), "body": body + top + vals,
            "parts": {f"v{i}": f"shows '{v}'" for i, v in enumerate(values)},
            "anchors": {"center": [0.5, 0.5], **({"ground": [0.5, 1.0]} if device == "phone" else {})}, "recipes": "screen",
            "animations": [f"to_value_{i}" for i in range(1, len(values))] + ["pop_in", "fade"],
            "name": f"Screen ({device}): {' -> '.join(values)}", "values": values,
            "tags": ["screen", device, "phone" if device == "phone" else "sign", "number", "counter", "battery", "message"]}


def door(d: Defs, spec: dict) -> dict:
    """A door with a padlock: lock / unlock swap the padlock, open turns the leaf."""
    body = contact_shadow(d, 200, 700, 190) + rect(40, 20, 320, 690, P["slate_d"], rx=10) + rect(62, 40, 276, 670, P["slate_dd"])
    leaf = rect(62, 40, 276, 670, d.v("leaf", "#A9825F", "#8A6849")) + rect(92, 76, 216, 250, "#8A6849", rx=8) + rect(92, 372, 216, 290, "#8A6849", rx=8)
    leaf += circle(290, 410, 16, "#E3B66B") + circle(290, 410, 7, "#B98A45")
    closed = rect(160, 470, 80, 68, "#C2554D", rx=10) + path("M176,470 V446 A24,24 0 0 1 224,446 V470", "none", 'stroke="#F6F3EE" stroke-width="12"') + circle(200, 504, 9, "#2A1E18")
    opened = rect(160, 470, 80, 68, "#62A06C", rx=10) + path("M176,470 V446 A24,24 0 0 1 224,446 V430", "none", 'stroke="#F6F3EE" stroke-width="12"') + circle(200, 504, 9, "#2A1E18")
    return {"size": (400, 720), "body": body + g("leaf", leaf, (62, 375)) + g("lock_closed", closed, (200, 500)) + g("lock_open", opened, (200, 500)),
            "parts": {"leaf": "the door leaf; open squeezes it (hinge on the left)", "lock_closed": "red padlock", "lock_open": "green open padlock"},
            "anchors": {"ground": [0.5, 1.0], "center": [0.5, 0.5]}, "recipes": "door",
            "animations": ["lock", "unlock", "open", "close", "shake", "pop_in", "fade"],
            "name": "Locked door", "tags": ["door", "lock", "locked", "access", "barrier", "open"]}


GROUP_COLORS = ["#3E5F86", "#62A06C", "#E3B66B", "#C2554D", "#8E6BB0"]


def grid(d: Defs, spec: dict) -> dict:
    """Up to 100 little people in a grid; groups of them light up in turn: group_1..group_5, focus_1..5, reset."""
    groups = (spec.get("groups") or [100])[:5]
    total = min(100, sum(groups))
    cols = 10
    rows = (total + cols - 1) // cols
    cell = 62
    pad = 26
    w, h = cols * cell + 2 * pad, rows * cell + 2 * pad

    def person(cx, cy, c):
        return circle(cx, cy - 12, 10, c) + path(f"M{cx-13},{cy+22} Q{cx-13},{cy+2} {cx},{cy+2} Q{cx+13},{cy+2} {cx+13},{cy+22} Z", c)

    base = ""
    layers: list[str] = [""] * len(groups)
    idx = 0
    for gi, count in enumerate(groups):
        for _ in range(count):
            if idx >= total:
                break
            cx = pad + (idx % cols) * cell + cell / 2
            cy = pad + (idx // cols) * cell + cell / 2
            base += person(cx, cy, "#B8C1CC")
            layers[gi] += person(cx, cy, GROUP_COLORS[gi % len(GROUP_COLORS)])
            idx += 1
    panel = rect(4, 4, w - 8, h - 8, "#F6F3EE", rx=28) + rect(4, 4, w - 8, h - 8, "none", rx=28, extra='stroke="#B8C1CC" stroke-width="6"')
    body = panel + g("base", base) + "".join(g(f"c{i}", layers[i], (w / 2, h / 2)) for i in range(len(groups)))
    return {"size": (w, h), "body": body,
            "parts": {"base": "everyone, grey", **{f"c{i}": f"group {i + 1}: {groups[i]} people" for i in range(len(groups))}},
            "anchors": {"center": [0.5, 0.5]}, "recipes": "grid",
            "animations": [f"group_{i + 1}" for i in range(len(groups))] + [f"focus_{i + 1}" for i in range(len(groups))] + ["reset", "pop_in", "fade"],
            "name": f"People grid ({'/'.join(str(x) for x in groups)})", "groups": groups,
            "tags": ["grid", "people", "crowd", "percentage", "population", "count", "statistics"]}


GLYPHS = {
    "question": lambda c: path("M-34,-40 Q-34,-84 0,-84 Q38,-84 38,-48 Q38,-26 12,-14 Q2,-8 2,6", "none", f'stroke="{c}" stroke-width="16" stroke-linecap="round"') + circle(2, 38, 10, c),
    "heart": lambda c: path("M0,46 L-48,-6 Q-66,-40 -34,-56 Q-8,-66 0,-34 Q8,-66 34,-56 Q66,-40 48,-6 Z", c),
    "coin": lambda c: circle(0, 0, 50, c) + circle(0, 0, 32, "none", 'stroke="#FFFFFF" stroke-width="6" stroke-opacity="0.8"'),
    "clock": lambda c: circle(0, 0, 52, "none", f'stroke="{c}" stroke-width="12"') + path("M0,-30 V0 L24,14", "none", f'stroke="{c}" stroke-width="10" stroke-linecap="round"'),
    "lock": lambda c: rect(-40, -6, 80, 62, c, rx=10) + path("M-24,-6 V-26 A24,24 0 0 1 24,-26 V-6", "none", f'stroke="{c}" stroke-width="12"'),
    "warning": lambda c: poly([(0, -60), (58, 46), (-58, 46)], c) + rect(-5, -22, 10, 40, "#FFFFFF", rx=4) + circle(0, 32, 6, "#FFFFFF"),
    "star": lambda c: poly([(0, -58), (17, -18), (60, -16), (26, 12), (38, 54), (0, 30), (-38, 54), (-26, 12), (-60, -16), (-17, -18)], c),
    "dollar": lambda c: _text(0, 30, "$", 110, c, 900),
}


def thought(d: Defs, spec: dict) -> dict:
    """A thought bubble with a picture inside (glyph = material): what a character is thinking about."""
    glyph = spec.get("material") if spec.get("material") in GLYPHS else "question"
    bubble = (ellipse(230, 140, 200, 130, "#FFFFFF") + ellipse(230, 140, 200, 130, "none", 'stroke="#C9CED8" stroke-width="6"')
              + circle(86, 300, 26, "#FFFFFF") + circle(50, 348, 15, "#FFFFFF") + circle(86, 300, 26, "none", 'stroke="#C9CED8" stroke-width="5"'))
    color = {"heart": "#C2554D", "coin": "#E3B66B", "warning": "#E8833A", "star": "#E3B66B", "lock": "#3E4A5C"}.get(glyph, "#3E5F86")
    inner = f'<g transform="translate(230 140) scale(1.5)">{GLYPHS[glyph](color)}</g>'
    return {"size": (460, 380), "body": bubble + g("glyph", inner, (230, 140)),
            "parts": {"glyph": "the picture inside the bubble"}, "anchors": {"center": [0.5, 0.4]}, "recipes": None,
            "animations": ["pop_in", "fade", "bounce", "scale_pulse"], "name": f"Thought bubble ({glyph})",
            "tags": ["thought", "bubble", "thinking", "idea", glyph]}


BUILDERS = {"coin": coin, "balance_scale": balance_scale, "board": board, "pedestal": pedestal,
            "screen": screen, "door": door, "grid": grid, "thought": thought}


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
