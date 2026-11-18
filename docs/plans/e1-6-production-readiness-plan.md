# E1.6 · Plani teknik: nga pipeline-i i provuar te videot për klientë

| Fusha    | Vlera                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Statusi  | **Plan për miratim. Pa kod.** Implementimi fillon vetëm pas miratimit të veçantë të PO-së.                                          |
| Data     | 2026-11-18                                                                                                                          |
| Baza     | E1.5 e pranuar: `e1-5-pipeline-integration` @ `29e5bb7`; `main` = `7f8ffca`                                                         |
| Branch-i | `e1-6-production-readiness` (ky commit përmban vetëm këtë plan)                                                                     |
| Parimi   | Asnjë veçori pa arsye konkrete. Çdo pikë mbyll një problem të matur ose të lexuar nga kodi, i shënuar [F]; vlerësimet shënohen [S]. |

---

## 0. Pyetja që e përcakton scope-in

README-ja e përcakton V1 kështu: _"Pa SaaS: një studio lokale për një përdorues."_ "Gati për klientë" nënkupton dy gjëra shumë të ndryshme:

| Modeli                            | Kush e përdor                                            | Çfarë kërkon                                                                                                     |
| --------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A. Studio e operatorit**        | Ti (ose ekipi yt) prodhon video dhe ua dorëzon klientëve | Video të sakta dhe të besueshme, licenca të qarta, punë që nuk korruptohet, CI e gjelbër                         |
| **B. Shërbim për klientë (SaaS)** | Klientët hyjnë vetë                                      | Gjithçka e A-së, plus llogari dhe autentikim, izolim midis klientëve, kuota dhe kosto, faturim, operim në server |

**[R]** E1.6 synon **modelin A**, i cili është hapi i domosdoshëm edhe për B. Pikat e B-së renditen te §5 si jashtë scope-it, deri në vendimin tënd (**D1**).

## 1. Gjendja aktuale e arkitekturës

```
Studio (React) ──REST──> Backend (Spring Boot): run-et, DAG në Postgres, outbox, retry, cancel
                            │ RabbitMQ (TaskCommand / TaskResult)
                         ai-worker (Node): script → voice (ElevenLabs) → film plan (Claude) → render
                            render: legacy (default)  |  package: Stager → Render Package → Gate → Engine
Run-et: dosje lokale (out/runs/<id>/), të përbashkëta midis backend-it dhe worker-it
```

**Çfarë është e provuar** (E0–E1.5):

- Engine-i është i ndarë nga planifikimi.
- Kontratat, Gate-i dhe "Gate PASS ⟹ renderohet sipas kontratës" (capabilities v2).
- Rruga e paketës prodhon MP4 me zë, me kuadro identikë me legacy dhe audio të karakterizuar.
- Determinizmi, refuzimi pa kuadro, dështimi, retry-i dhe anulimi në nivel engine-i dhe hapi.

**Çfarë lexova në kod dhe në CI për këtë plan** [F]:

| #   | Fakti                                                                                                                                                                                                                                                                                                                                                                                                      | Burimi                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| F1  | CI në GitHub është e kuqe. Mungon FFmpeg në runner (dështojnë `film-worker.test.ts` dhe `encode.test.ts`). `AssetApiTest` pret 6 personazhe, biblioteka ka 15. `main` është e kuqe që më 2026-11-13.                                                                                                                                                                                                       | `gh run list`, `gh run view --log-failed`                                   |
| F2  | Rruga default (legacy) e pret çdo video me zë te fjala e fundit: te fixture-i 6,5 s në vend të 8,03 s.                                                                                                                                                                                                                                                                                                     | Raporti i E1.5, §4                                                          |
| F3  | Anulimi te backend-i ndryshon vetëm databazën (`Orchestrator.cancel`). Worker-i që po punon vazhdon dhe shkruan skedarë. Pas afatit (`TIMEOUT`), hapi ridërgohet si attempt i ri, ndërsa i vjetri mund të jetë ende duke shkruar në **të njëjtën dosje run-i**. Rezultati i vjetër injorohet (`Ignoring stale … result`), **por skedarët e tij jo**: një `video.mp4` e vjetër mund ta mbishkruajë të renë. | `Orchestrator.java:277–315`, `worker.ts` (`prefetch(1)`, pa mesazh anulimi) |
| F4  | Muzika e filmave v2 është një "placeholder": akorde sintetike nga `film/src/sound.ts`, me koment _"Placeholder music bed … until real music exists"_. Biblioteka audio e kuruar (ADR 0010, Pixabay) përdoret vetëm nga motori v1.                                                                                                                                                                          | `make.ts`, `sound.ts`, `audio/catalog.json`                                 |
| F5  | Integrimi real me ElevenLabs nuk është verifikuar; PO-ja do ta testojë manualisht, dhe kjo nuk e bllokon E1.6.                                                                                                                                                                                                                                                                                             | Raporti i E1.5, §11                                                         |
| F6  | `stager/src/legacy.ts` (ura drejt brendisë së `film`) dhe kamera e "pjekur" e B1–B5 janë shtyrë nga E1.5 te E1.6 (D4).                                                                                                                                                                                                                                                                                     | Plani i E1.5                                                                |
| F7  | Run-et ruhen në disk lokal, pa politikë ruajtjeje. Mbeten edhe dosjet e punës (`film/`, `film-package-work/` me prerjet dhe WAV-et). SeaweedFS ekziston në `infra/`, por run-et nuk e përdorin.                                                                                                                                                                                                            | `application.yml` (`erkasa.storage.dir`), `package-steps.ts`                |
| F8  | API-ja nuk ka autentikim. Shërbimi i skedarëve kufizohet te rrënja e ruajtjes, por jo te run-i: `files/../<run-tjetër>/x` normalizohet brenda rrënjës. Për një operator lokal kjo s'ka rëndësi; për klientë është rrjedhje e të dhënave.                                                                                                                                                                   | `RunController.serve`, `RunStorage.file`                                    |
| F9  | Paketa mban `provenance`, `license` dhe `approval` për çdo aset, por asgjë nuk i nxjerr si raport për videon e dorëzuar.                                                                                                                                                                                                                                                                                   | `asset-manifest.ts`, Gate-i (fushat `metadata`)                             |
| F10 | W0 ka CLI-në e vet dhe nuk hyn në pipeline (D6 i E1.5). Filmat v2 nuk kanë titra (captions) mbi video.                                                                                                                                                                                                                                                                                                     | E1.4/E1.5                                                                   |

## 2. Problemet sipas rëndësisë

| #      | Problemi                                             | Rëndësia                                                                                             | Pse                                                                                                |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **K1** | CI e kuqe (F1)                                       | **Kritike**                                                                                          | Asnjë pranim nuk mund të verifikohet nga jashtë; regresionet nuk kapen.                            |
| **K2** | Videot default priten (F2)                           | **Kritike**                                                                                          | Çdo video me zë që del sot është e mangët.                                                         |
| **K3** | Attempt-et e vjetra mbishkruajnë skedarët (F3)       | **Kritike**                                                                                          | Videoja e dorëzuar mund të mos jetë ajo e attempt-it që u pranua.                                  |
| **R1** | Muzika placeholder (F4)                              | **E rëndësishme** (kritike nëse e konsideron muzikën sintetike të papranueshme për klientët: **D2**) | Cilësia e audios në videon e dorëzuar.                                                             |
| **R2** | Heqja e `legacy.ts` dhe e rrugës legacy (F6)         | **E rëndësishme**                                                                                    | Dy rrugë renderimi = dyfish mirëmbajtje; ura e mban Stager-in të lidhur me Engine-in.              |
| **R3** | Raporti i licencave dhe i burimit për çdo video (F9) | **E rëndësishme**                                                                                    | Klienti duhet të dijë çfarë licencash përmban videoja (Pixabay, ElevenLabs, asetet).               |
| **R4** | Ruajtja dhe pastrimi i run-eve (F7)                  | **E rëndësishme**                                                                                    | Disku rritet pa kufi; dorëzimi kërkon që videoja e pranuar të ruhet.                               |
| **O1** | Izolimi i skedarëve sipas run-it (F8)                | Opsionale për modelin A, kritike për B                                                               |                                                                                                    |
| **O2** | W0 në pipeline (F10)                                 | Opsionale                                                                                            | Vetëm nëse produkti kërkon pamjen W0.                                                              |
| **O3** | Titrat mbi video (F10)                               | Opsionale                                                                                            | Vendim produkti (**D3**). Shorts-et zakonisht i kanë, por pa vendimin tënd nuk e propozoj si punë. |

ElevenLabs (F5) mbetet test manual i PO-së dhe nuk është pjesë e E1.6. **[R]** Bëje para dorëzimit të parë te një klient.

## 3. Pikat e E1.6

### K1 · CI e gjelbër dhe e riprodhueshme

- **Objektivi:** çdo commit verifikohet në GitHub me të njëjtat teste si lokalisht.
- **Scope:**
  - FFmpeg në runner, me version të fiksuar ose të regjistruar në log (`ffmpeg -version`), sepse PCM-ja dhe bajtet e MP4-së varen nga versioni.
  - `AssetApiTest`: numri i pritur lidhet me biblioteken, jo me një konstante të vjetër.
  - Punët (jobs) e kërkuara si kontrolle të detyrueshme para merge-it.
- **Testet:** CI e gjelbër në `e1-6-production-readiness`. Një commit që e prish qëllimisht një test e bën CI-në të kuqe (provë një-herëshe, e kthyer).
- **Pranimi:** tre punët (TypeScript, Asset library, Backend) dalin të gjelbra; versioni i FFmpeg shënohet në log; golden-ët dhe determinizmi (K7) kalojnë në CI.
- **Risku:** FFmpeg i runner-it ndryshon nga ai lokal (6.1.1), dhe PCM-ja ose bajtet ndryshojnë. **Masa:** testet që krahasojnë bajtet e MP4-së bëhen vetëm brenda të njëjtit proces/version; krahasimet me legacy nuk varen nga versioni, sepse të dyja rrugët ekzekutohen në të njëjtin runner.

### K2 · Pipeline-i i paketës bëhet default (videot jo më të prera)

- **Objektivi:** videot me zë kanë gjithë kohëzgjatjen e filmit.
- **Scope:**
  - Default-i kalon në `package` (**D3 i E1.5**), me commit më vete dhe vetëm me miratimin tënd.
  - `legacy` mbetet e zgjedhshme me flamur, deri te R2.
  - Raporti i run-it shënon rrugën.
- **[R] Alternativa** (rregullimi i defektit te legacy) nuk rekomandohet: ndryshon një rrugë që do të hiqet.
- **Testet:**
  - worker-i pa flamur renderon me paketë;
  - E2E-ja e E1.5 me default-in e ri;
  - `pnpm golden` (legacy, me flamur) mbetet 0 dështime;
  - një run i plotë nga Studio (backend + worker) jep MP4 me gjithë kohëzgjatjen.
- **Pranimi:** kohëzgjatja e MP4-së = `output.duration` e paketës (±1 kuadër audio); `legacy` arrihet vetëm me flamur.
- **Risku:** ndryshimet e karakterizuara të PCM-së (raporti i E1.5, §6). **Masa:** janë të dokumentuara dhe vijnë nga rregullimi; ti i dëgjon para ndërrimit.

### K3 · Çdo attempt shkruan vetëm në dosjen e vet; publikohet vetëm attempt-i i pranuar

- **Objektivi:** asnjë skedar i një attempt-i të vjetër, të anuluar ose me afat të kaluar nuk prek daljen e run-it.
- **Scope (minimal):**
  - Worker-i shkruan në `<run>/attempts/<step>-<attempt>/`.
  - Backend-i e publikon daljen (p.sh. `video.mp4`) vetëm kur pranon rezultatin e attempt-it aktual. Kjo e mban rregullin ekzistues "rezultati i vjetër injorohet" dhe e shtrin te skedarët.
  - Anulimi dhe afati e ndalojnë attempt-in kur worker-i e sheh (kontroll i afatit dhe i anulimit gjatë punës, me `AbortSignal`-in e E1.5).
  - Mesazhi i anulimit nga backend-i te worker-i kërkon ndryshim kontrate (`erkasa.task/1`). **[R]** Nuk propozohet tani, sepse izolimi e bën të panevojshëm për korrektësinë.
- **Testet:**
  - dy attempt-e të njëjtë njëkohësisht: dalja është e attempt-it të pranuar;
  - attempt me afat të kaluar që mbaron pas të riut nuk e prek daljen;
  - anulimi gjatë render-it nuk lë asnjë dalje;
  - retry pas anulimit;
  - testet e `RunFlowTest` dhe të worker-it.
- **Pranimi:** në çdo skenar, `video.mp4` e run-it ka hash-in e daljes së attempt-it që backend-i shënoi si SUCCEEDED.
- **Risku:** ndryshim në kontratën e skedarëve midis backend-it dhe worker-it, pra edhe te Studio, që lexon `files/`. **Masa:** emrat publikë të skedarëve nuk ndryshojnë; ndryshon vetëm vendi ku shkruan worker-i.

### R1 · Muzika e vërtetë në filmat v2 (nëse D2 = po)

- **Objektivi:** bed-i placeholder zëvendësohet me muzikë nga biblioteka e kuruar (ADR 0010), e licencuar.
- **Scope:**
  - Stager-i e vendos një pjesë muzikore nga katalogu si klipin `music` (WAV), me të njëjtin ducking dhe loudness.
  - SFX-et e `sfxFor` mbeten opsionale.
  - Zgjedhja e pjesës ndjek rregullat ekzistuese të katalogut (mood). Kjo kërkon që skedarët e Pixabay të jenë të disponueshëm në makinën e renderimit (sipas ADR 0010, `assets-src/` nuk shpërndahet).
- **Testet:**
  - paketa me muzikë katalogu kalon Gate-in;
  - licenca dhe burimi shkojnë në manifest (R3);
  - ducking-u dhe loudness mbeten si te E1.5;
  - një run pa skedarët e katalogut refuzohet qartë (jo me heshtje).
- **Pranimi:** asnjë video default nuk mban më bed-in sintetik pa flamur të shprehur; dëgjimi yt.
- **Risku:** licenca e Pixabay dhe shpërndarja e skedarëve. **Masa:** R3; skedarët mbeten jashtë repo-s.

### R2 · Një rrugë e vetme renderimi: heqja e `legacy.ts` dhe e legacy

- **Objektivi:** Stager-i nuk importon më brendinë e `film`; Engine-i ka një rrugë të vetme.
- **Scope:**
  - Kodi i staging-ut (timing, perform, compose, sound) zhvendoset te Stager-i.
  - Kamera e B1–B5 shkruhet si qëllim, pa e "pjekur" (D4).
  - `makeFilm` dhe rruga legacy hiqen **pas K2 dhe pas një periudhe të caktuar nga ti**.
- **Testet:**
  - K1 (6 043 kuadro), K7 dhe golden-ët e paketës mbeten identikë;
  - testi i kufirit: Stager-i pa importe nga `film/src` përveç kontratave dhe capabilities;
  - E2E.
- **Pranimi:** `stager/src/legacy.ts` nuk ekziston; kuadrot dhe PCM-ja e E2E-së janë identike me E1.5.
- **Risku:** i madh në kod (zhvendosje), i vogël në sjellje, sepse golden-ët e kapin çdo ndryshim. **[R]** Bëhet e fundit brenda E1.6, ose ndahet në E1.7 nëse K1–K3 zgjasin.

### R3 · Raporti i licencave për çdo video

- **Objektivi:** çdo `video.mp4` ka pranë një `credits.json`/`credits.txt` të nxjerrë nga manifesti: asetet, licencat, burimi, aprovimi, zëri (ofruesi, modeli) dhe muzika.
- **Scope:** vetëm leximi i asaj që paketa tashmë mban; asnjë fushë e re kontrate.
- **Testet:**
  - raporti përmban çdo aset të përdorur dhe asgjë tjetër;
  - për run-in E2E krahasohet me manifestin;
  - një aset pa licencë refuzohet tashmë nga Gate-i (skema).
- **Pranimi:** Studio shfaq/shkarkon raportin pranë videos.
- **Risku:** i ulët.

### R4 · Ruajtja dhe pastrimi

- **Objektivi:** dalja e pranuar ruhet; dosjet e punës fshihen; disku ka kufi.
- **Scope:**
  - Pas SUCCEEDED, fshihen dosjet e punës (`film/`, `film-package-work/`, `attempts/` të vjetra).
  - Mbahen paketa, zëri, `gate.json` dhe `video.mp4`.
  - Politika e ruajtjes konfigurohet (sa run-e, sa ditë) dhe zbatohet vetëm mbi run-e të përfunduara.
  - **[R]** SeaweedFS mbetet jashtë derisa modeli B ta kërkojë.
- **Testet:**
  - pas pastrimit, `rerender` nga paketa e ruajtur jep të njëjtin MP4 (hash);
  - run-et RUNNING nuk preken;
  - dosjet e një run-i tjetër nuk preken.
- **Pranimi:** madhësia e një run-i të përfunduar matet para dhe pas, dhe raportohet.
- **Risku:** fshirja e diçkaje të nevojshme. **Masa:** vetëm emra të njohur, vetëm run-e të përfunduara, me test.

## 4. Rendi, varësitë dhe vlerësimi [S]

```
K1 (CI) ──► K3 (attempt-et) ──► K2 (default) ──► R3, R4 ──► R2 (legacy jashtë)
                                   └──► R1 (muzika, pas D2)
```

| Pika | Koha [S]               |
| ---- | ---------------------- |
| K1   | 0,5–1 ditë             |
| K3   | 2–3 ditë               |
| K2   | 1 ditë + dëgjimi yt    |
| R3   | 1 ditë                 |
| R4   | 1 ditë                 |
| R1   | 2–3 ditë, nëse D2 = po |
| R2   | 4–6 ditë               |

Pa R1 dhe R2: ~6–7 ditë. Me të gjitha: ~12–16 ditë.

Çdo pikë ka commit-et, testet dhe provat e veta, në `e1-6-production-readiness`. Pa merge në `main` dhe pa ndërrim default-i pa miratimin tënd të veçantë (K2).

## 5. Jashtë E1.6 (për modelin B, pas D1)

Llogaritë dhe autentikimi, izolimi midis klientëve (O1), kuotat dhe kostoja për klient, faturimi, operimi në server (ruajtje S3, backup, monitorim), moderimi i temave para gjenerimit. Asnjë prej tyre nuk propozohet pa vendimin për modelin.

## 6. Vendimet që kërkohen

| #      | Pyetja                                              | [R]                                                 |
| ------ | --------------------------------------------------- | --------------------------------------------------- |
| **D1** | Modeli: A (studio e operatorit) apo B (SaaS)?       | A për E1.6                                          |
| **D2** | A është bed-i sintetik i pranueshëm për klientët?   | Jo: R1 brenda E1.6                                  |
| **D3** | Titrat mbi video (O3): kërkesë produkti apo jo?     | Vendim yti; jashtë E1.6 pa të                       |
| **D4** | R2 brenda E1.6 apo në një fazë më vete (E1.7)?      | Brenda, si pika e fundit; ndahet nëse K1–K3 zgjasin |
| **D5** | Sa kohë mbetet legacy e zgjedhshme pas K2, para R2? | Deri në pranimin e E1.6                             |

Pres miratimin tënd. Nuk shkruaj kod, nuk bëj merge dhe nuk ndërroj default-in.
