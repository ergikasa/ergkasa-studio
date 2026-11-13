"""Style kits: one colour grade applied to every asset of a world.

The generators draw with the studio palette; the kit then moves every colour of every asset the same way
(saturation, lightness, a tint), so the place, the people and the props of one video read as one picture,
and two videos made from the same generators still look different.
"""
from __future__ import annotations

import colorsys
import re

KITS: dict[str, dict] = {
    # no grade: the studio palette as drawn
    "clean_editorial": {"sat": 1.0, "light": (1.0, 0.0), "tint": None, "amount": 0.0},
    # warm, slightly lifted, a cream glaze, like a printed picture book
    "storybook": {"sat": 1.06, "light": (0.94, 0.06), "tint": "#F2D3A2", "amount": 0.12},
    # cold, darker, desaturated, a blue-violet night cast
    "night_noir": {"sat": 0.72, "light": (0.72, 0.0), "tint": "#27305C", "amount": 0.26},
    # orange-pink evening light
    "sunset_warm": {"sat": 1.04, "light": (0.96, 0.02), "tint": "#F2A65A", "amount": 0.16},
}

HEX = re.compile(r"#[0-9A-Fa-f]{6}\b")


def _rgb(h: str) -> tuple[float, float, float]:
    return int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255


def grade_color(h: str, kit: dict) -> str:
    r, g, b = _rgb(h)
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    ss = min(1.0, ss * kit["sat"])
    ll = min(1.0, max(0.0, ll * kit["light"][0] + kit["light"][1]))
    r, g, b = colorsys.hls_to_rgb(hh, ll, ss)
    if kit["tint"]:
        tr, tg, tb = _rgb(kit["tint"])
        a = kit["amount"]
        r, g, b = r + (tr - r) * a, g + (tg - g) * a, b + (tb - b) * a
    return "#{:02X}{:02X}{:02X}".format(*(max(0, min(255, round(c * 255))) for c in (r, g, b)))


def grade(svg: str, kit_name: str) -> str:
    kit = KITS[kit_name]
    if not kit["tint"] and kit["sat"] == 1.0 and kit["light"] == (1.0, 0.0):
        return svg
    cache: dict[str, str] = {}

    def sub(m: re.Match) -> str:
        h = m.group(0).upper()
        if h not in cache:
            cache[h] = grade_color(h, kit)
        return cache[h]

    return HEX.sub(sub, svg)
