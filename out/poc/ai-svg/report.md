# AI-SVG experiment (2026-11-11)

Model: fake · 1 objects · 2 tokens in total.
Each drawing passed through the same gate as an imported asset: safety, structure, palette.
Compare the images `<id>.compare.png` (ours | AI as drawn | AI with the palette snapped).

| object            | gate | shapes | off-palette colours | problems | output tokens | model's note                     |
| ----------------- | ---- | ------ | ------------------- | -------- | ------------- | -------------------------------- |
| chair_office_side | pass | 11     | 1/5 (max 10)        | -        | 1             | fake answer for a pipeline check |

How to judge: does the normalized AI drawing look like it belongs next to our characters? Would it
need a human pass before entering the library? If most objects pass the gate and look right, AI
drafts can speed up the prop library (with a person approving each one); if not, keep the code generators.
