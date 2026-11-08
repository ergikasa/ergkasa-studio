# ADR 0006: Biblioteka e aseteve dhe licencat

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Cilësia e videos varet nga asetet. Asetet nga interneti nuk janë automatikisht të lira.

## Vendimi

Personazhet, sfondet dhe metaforat janë origjinale, të gjeneruara me kod (`tools/asset-gen`). Objektet nga Fluent Emoji Flat (MIT), ikonat nga Phosphor (MIT). unDraw përjashtohet (licenca ndalon përdorimin brenda aplikacioneve). Çdo aset ka licencën te `asset.json`, dhe kontrata kërkon `commercial: true`.

## Pasojat

Stil i njëtrajtshëm (`erkasa_flat_v1`). Asnjë aset pa licencë komerciale nuk kalon validatorin.
