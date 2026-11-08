# ADR 0008: Skenari, planifikimi vizual dhe zëri

- Statusi: pranuar
- Data: 2026-11-08

## Konteksti

AI-ja shkruan skenarin dhe planin vizual. Nuk vizaton asgjë: pikturat i bën motori nga asetet. Rreziqet janë
dy: (1) AI-ja shpik asete, veprime ose fjalë që nuk ekzistojnë; (2) koha e animacioneve nuk përputhet me zërin.

## Vendimi

- **Rendi i hapave:** skenari → zëri → plani → kompilimi → render. Zëri bëhet para planit, që plani të
  kontrollohet me kohën e vërtetë të fjalëve (ElevenLabs `with-timestamps`, nga shkronjat në fjalë).
- **Claude me structured outputs** (`output_config.format`, JSON Schema). Përgjigja është gjithmonë JSON i
  vlefshëm. Modeli nuk përgjigjet me Video Plan-in e plotë, por me një **draft** të sheshtë: të gjitha fushat
  të detyrueshme, vlera "bosh" për ato që nuk përdoren, pa unione, kohët si tekst i shkurtër
  (`word:habits`, `after:drini.walk`). Kështu skema qëndron brenda kufijve të API-së, dhe konvertimi në
  Video Plan bëhet me kod deterministik.
- **Narracioni nuk ndryshohet nga planifikuesi:** konvertimi e merr gjithmonë nga skenari.
- **Katalogu vjen nga biblioteka:** prompt-i i planifikuesit ndërtohet nga `assets/` (personazhet me veprimet
  e tyre sipas pamjes, sfondet, metaforat me animacionet, dhe objektet/ikonat më të afërta me skenarin).
- **Cikli i riparimit:** çdo përgjigje kompilohet. Gabimet e kompilatorit (me rrugën dhe hint-in) i kthehen
  modelit, i cili kthen planin e plotë të korrigjuar. Maksimumi 3 prova; të gjitha ruhen te `plan-attempts.json`.
- **Modelet:** `claude-sonnet-5-5` si parazgjedhje (`ERKASA_LLM_MODEL`), `eleven_multilingual_v2` për zërin
  (`ELEVENLABS_MODEL_ID`). Të dyja ndryshohen pa prekur kodin.
- **Zëri në video:** çdo skenë ka klipin e vet, i vendosur te fillimi i skenës. Muzika placeholder ulet nën
  zë (sidechain), dhe miksi normalizohet në −14 LUFS / −1 dBTP.

## Pasojat

- Një video ka kosto të njohur: thirrjet dhe token-at e Claude dhe karakteret e ElevenLabs shkruhen te `run.json`.
- Çdo hap ruan artefaktin e vet, ndaj një run mund të rifillojë nga `--from-script` ose `--from-plan`.
- Orkestrimi me RabbitMQ dhe Spring (projektet, hapat, rifillimi automatik) vjen në Fazën F. Deri atëherë
  pipeline-i niset nga CLI-ja.
