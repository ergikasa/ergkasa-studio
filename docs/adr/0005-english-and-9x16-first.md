# ADR 0005: V1: anglisht dhe 9:16

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

Ergi vendosi më 8 nëntor 2026: videot do të jenë vetëm në anglisht, formati kryesor TikTok 9:16.

## Vendimi

`Language = ["en"]`, `VideoFormat` me default `9:16`. Zëri vjen nga ElevenLabs (`with-timestamps`). Azure dhe gjuhët e tjera hiqen nga V1. `VoiceProvider` mbetet ndërfaqe, që të shtohen më vonë.

## Pasojat

Më pak integrime. Kompozimi, safe-zone dhe titrat optimizohen fillimisht për 1080×1920.
