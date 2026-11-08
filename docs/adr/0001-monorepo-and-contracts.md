# ADR 0001: Monorepo me kontrata të përbashkëta

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Pjesët e sistemit (backend Java, motori dhe UI në TypeScript, workers) duhet të flasin të njëjtën gjuhë të dhënash.

## Vendimi

Një monorepo (pnpm + Maven). Kontratat shkruhen një herë në Zod (`contracts/`), eksportohen si JSON Schema 2020-12 dhe Java i validon me të njëjtat skema. Të njëjtat fixtures testohen në TS dhe në Java.

## Pasojat

Një ndryshim te kontratat duket në një PR të vetëm. CI dështon nëse skemat e eksportuara janë të vjetra. Klasat Java të gjeneruara shtyhen për në Fazën E, kur Java i përdor realisht.
