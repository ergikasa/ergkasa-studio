"""Builds the Phase 3 demo plan: one 90 s walk through three zones of a wide castle (3 camera travels, 5 insert shots)."""
import json
BG = {"assetId": "wld_place_main"}
def actor(i, a, x, zone=None, acts=None, speaks=False, scale=1.2, facing="front"):
    pl = {"anchor": "ground", "x": x, "scale": scale}
    if zone: pl["zone"] = zone
    return {"type": "actor", "id": i, "assetId": a, "place": pl, "facing": facing, "expression": "neutral",
            "actions": acts or [], "speaks": speaks}
def obj(i, a, x, y, scale, t, zone=None, anims=None):
    pl = {"x": x, "y": y, "scale": scale}
    if zone: pl["zone"] = zone
    return {"type": "object", "id": i, "assetId": a, "place": pl, "in": {"effect": "pop", "at": {"sec": t}, "durationSec": 0.4}, "animations": anims or []}
def text(i, c, t, y=0.14, hl=None):
    return {"type": "text", "id": i, "content": c, "style": "hook_impact", "place": {"x": 0.5, "y": y}, "highlight": hl or [], "in": {"effect": "pop", "at": {"sec": t}, "durationSec": 0.35}}
def scene(sid, narr, sec, layers, shot=None, camera=None, trans=None):
    s = {"schema": "erkasa.scene-plan/1", "sceneId": sid, "engine": "2d", "narration": narr,
         "durationPolicy": {"mode": "fixed", "sec": sec, "padAfterSec": 0}, "background": BG, "layers": layers}
    if shot: s["shot"] = shot
    if camera: s["camera"] = camera
    if trans: s["transitionOut"] = trans
    return s
walk = lambda t, x, zone=None, d=None: {"action": "walk", "at": {"sec": t}, "to": ({"x": x, "zone": zone} if zone else {"x": x}), **({"durationSec": d} if d else {})}
R, A, B = "wld_char_ruler", "wld_char_a", "wld_char_b"
scenes = [
 scene("s01", "Two rivals reach the castle gate. Only one coin can decide.", 9,
   [actor("ruler", R, 0.5, "gate", [{"action": "present", "at": {"sec": 1.0}}], True),
    actor("a", A, 0.18, "gate", [{"action": "observe", "at": {"sec": 1.5}}]),
    actor("b", B, 0.82, "gate", [{"action": "observe", "at": {"sec": 2.0}}]),
    text("t", "ONE COIN. TWO RIVALS.", 0.4, 0.13, ["COIN."])],
   shot={"size": "wide", "zone": "gate"}),
 scene("s02", "The king holds it up. Heads or tails.", 7,
   [obj("coin", "wld_prop_coin", 0.5, 0.3, 0.6, 0.4, "gate", [{"name": "flip", "at": {"sec": 1.5}}])],
   shot={"size": "insert", "subject": "coin", "zone": "gate"}),
 scene("s03", "So they follow him through the gate, into the yard.", 13,
   [actor("ruler", R, 0.5, "gate", [walk(1.4, 0.55, "yard")], True),
    actor("a", A, 0.18, "gate", [walk(1.8, 0.3, "yard")]),
    actor("b", B, 0.82, "gate", [walk(1.0, 0.8, "yard")])],
   shot={"size": "wide", "zone": "gate"},
   camera=[{"move": "travel", "target": "ruler", "at": {"sec": 1.4}}]),
 scene("s04", "In the yard waits the scale of justice.", 7,
   [obj("scale", "wld_prop_scale", 0.5, 0.45, 0.75, 0.4, "yard", [{"name": "tilt_left", "at": {"sec": 2.0}}])],
   shot={"size": "insert", "subject": "scale", "zone": "yard"}),
 scene("s05", "Each rival states a case. The yard is silent.", 12,
   [actor("a", A, 0.25, "yard", [{"action": "talk", "at": {"sec": 0.8}}], True),
    actor("b", B, 0.75, "yard", [{"action": "cross_arms", "at": {"sec": 1.5}}]),
    actor("ruler", R, 0.5, "yard", [{"action": "observe", "at": {"sec": 1.0}}]),
    text("t", "TWO CASES.", 0.4, 0.13)],
   shot={"size": "wide", "zone": "yard"}),
 scene("s06", "But the king knows a better test, and it sits in the tower.", 13,
   [actor("ruler", R, 0.5, "yard", [walk(1.4, 0.55, "tower")], True),
    actor("a", A, 0.25, "yard", [walk(1.8, 0.3, "tower")]),
    actor("b", B, 0.75, "yard", [walk(1.0, 0.8, "tower")])],
   shot={"size": "wide", "zone": "yard"},
   camera=[{"move": "travel", "target": "ruler", "at": {"sec": 1.4}}]),
 scene("s07", "Golden light. One last look at the coin.", 7,
   [obj("coin", "wld_prop_coin", 0.5, 0.35, 0.6, 0.4, "tower", [{"name": "flip", "at": {"sec": 1.2}}, {"name": "flip", "at": {"sec": 3.8}}])],
   shot={"size": "insert", "subject": "coin", "zone": "tower"}),
 scene("s08", "The king nods. Let fate speak.", 11,
   [actor("ruler", R, 0.5, "tower", [{"action": "present", "at": {"sec": 0.8}}], True)],
   shot={"size": "medium", "subject": "ruler", "zone": "tower"}),
 scene("s09", "Back at the scale, the tilt shows the winner.", 8,
   [obj("scale", "wld_prop_scale", 0.5, 0.45, 0.75, 0.4, "tower", [{"name": "tilt_right", "at": {"sec": 1.6}}])],
   shot={"size": "insert", "subject": "scale", "zone": "tower"}),
 scene("s10", "And all it took was one coin.", 8,
   [actor("ruler", R, 0.5, "tower", [], True), text("t", "FATE DECIDES.", 0.4, 0.13, ["FATE"])],
   shot={"size": "wide", "zone": "tower"}),
]
import sys
if len(sys.argv) > 1:
    keep = sys.argv[1].split(",")
    scenes = [s for s in scenes if s["sceneId"] in keep]
plan = {"schema": "erkasa.video-plan/1", "projectId": "phase3-wide", "language": "en", "format": "9:16", "fps": 30, "voiceId": "none", "scenes": scenes}
json.dump(plan, open(sys.argv[2] if len(sys.argv) > 2 else "engine-worker/demo/phase3/wide.video-plan.json", "w"), indent=1)
print(sum(s["durationPolicy"]["sec"] for s in scenes), "s")
