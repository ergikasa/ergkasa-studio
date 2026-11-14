"""Phase 4 demo: objects that explain (a screen that changes, a lock, a grid of 100 people, a thought bubble, in-world labels)."""
import json, sys
BG = {"assetId": "wld_place_main"}
def obj(i, a, x, y, scale, t, anims=None, label=None):
    l = {"type": "object", "id": i, "assetId": a, "place": {"x": x, "y": y, "scale": scale},
         "in": {"effect": "pop", "at": {"sec": t}, "durationSec": 0.4}, "animations": anims or []}
    if label: l["label"] = label
    return l
def scene(sid, narr, sec, layers, shot=None, camera=None):
    s = {"schema": "erkasa.scene-plan/1", "sceneId": sid, "engine": "2d", "narration": narr,
         "durationPolicy": {"mode": "fixed", "sec": sec, "padAfterSec": 0}, "background": BG, "layers": layers}
    if shot: s["shot"] = shot
    if camera: s["camera"] = camera
    return s
an = lambda n, t: {"name": n, "at": {"sec": t}}
scenes = [
 scene("s01", "Four percent. Then three. Then one.", 8,
   [obj("phone", "wld_prop_phone", 0.5, 0.45, 1.5, 0.3, [an("to_value_1", 2.5), an("to_value_2", 5.0)], {"text": "BATTERY", "at": {"sec": 0.8}})],
   shot={"size": "insert", "subject": "phone"}),
 scene("s02", "The door stays shut, until someone has the right key.", 8,
   [obj("door", "wld_prop_door", 0.5, 0.5, 1.6, 0.3, [an("shake", 1.4), an("unlock", 3.5), an("open", 5.0)], {"text": "LOCKED", "at": {"sec": 0.8}})],
   shot={"size": "insert", "subject": "door"}),
 scene("s03", "Out of a hundred couples, sixty-four stay together. Sixteen drift. Sixteen quarrel. Four break.", 14,
   [obj("grid", "wld_prop_grid", 0.5, 0.46, 2.6, 0.3, [an("group_1", 2.0), an("group_2", 5.0), an("group_3", 8.0), an("group_4", 11.0)], {"text": "100 COUPLES", "at": {"sec": 0.8}})],
   shot={"size": "insert", "subject": "grid"}),
 scene("s04", "And he keeps thinking about one coin.", 8,
   [{"type": "actor", "id": "a", "assetId": "wld_char_a", "place": {"anchor": "ground", "x": 0.5, "scale": 1.3}, "facing": "front",
     "expression": "neutral", "actions": [{"action": "think", "at": {"sec": 1.0}}], "speaks": True},
    obj("think", "wld_prop_think", 0.66, 0.26, 1.2, 1.0, [an("scale_pulse", 2.5)])],
   shot={"size": "medium", "subject": "a"}),
 scene("s05", "The sign flips. Closed becomes open.", 8,
   [obj("sign", "wld_prop_sign", 0.5, 0.45, 1.8, 0.3, [an("to_value_1", 3.0)], {"text": "NEW RULE", "at": {"sec": 3.0}, "side": "below"})],
   shot={"size": "insert", "subject": "sign"}),
]
if len(sys.argv) > 1: scenes = [s for s in scenes if s["sceneId"] in sys.argv[1].split(",")]
plan = {"schema": "erkasa.video-plan/1", "projectId": "phase4-explain", "language": "en", "format": "9:16", "fps": 30, "voiceId": "none", "scenes": scenes}
json.dump(plan, open(sys.argv[2] if len(sys.argv) > 2 else "engine-worker/demo/phase4/explain.video-plan.json", "w"), indent=1)
print(sum(s["durationPolicy"]["sec"] for s in scenes), "s")
