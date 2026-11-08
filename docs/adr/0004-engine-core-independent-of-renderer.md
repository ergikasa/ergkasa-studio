# ADR 0004: Motori 2D i pavarur nga renderer-i

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Specifikimi kërkon që DSL të jetë e ndarë nga renderer-i dhe të lejojë 3D më vonë.

## Vendimi

`engine-core` është TS i pastër: `evaluate(timeline, frame) → RenderTree`. Remotion vetëm vizaton pemën dhe eksporton MP4. Nuk përdoren Motion Canvas (i pamirëmbajtur), GSAP apo PixiJS në V1.

## Pasojat

Testet e motorit nuk kërkojnë browser. Një renderer tjetër ose një motor 3D lidhet pa ndryshuar DSL-në.
