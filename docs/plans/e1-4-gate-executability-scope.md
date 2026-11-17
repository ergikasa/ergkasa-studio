# E1.4 · Gate-i i ekzekutueshmërisë: scope i propozuar

|                              |                                                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi                      | **Propozim. Pret miratimin e PO-së para implementimit.**                                                                                                                     |
| Branch                       | `e1-4-engine-reads-package` (pa merge në `main`)                                                                                                                             |
| Burimi                       | Auditimi i Gate-it, raporti E1.4 §5.2 (`film/test/package/gate-audit.ts`), dhe matjet e tetë paketave ekzistuese (§7)                                                        |
| Vendimi i PO-së (2026-11-17) | Gate-i duhet të refuzojë çdo paketë që renderer-i nuk mund ta ekzekutojë besnikërisht. Renderer-i nuk zgjerohet brenda E1.4; mbështetja e rasteve të reja është punë e E1.5. |

## 1. Parimi dhe përkufizimi

**Gate-i pranon ⟹ renderer-i e ekzekuton paketën besnikërisht.**

"Besnikërisht" do të thotë dy gjëra:

- renderer-i nuk dështon në asnjë kuadër;
- çdo fushë e paketës dhe e manifestit ose zbatohet ashtu si e përshkruan kontrata, ose paketa refuzohet.

Asnjë fushë nuk injorohet në heshtje. Kur renderer-i ka sjellje që kontrata nuk e shpreh (p.sh. kohët e captions), ajo publikohet si semantikë në `capabilities`, jo si konstante e fshehur.

Drejtimi i kundërt mbetet K5: paketa e refuzuar → 0 kuadro, encoder-i nuk niset.

## 2. Kufijtë

- **Ndryshon:**
  - kontrata e aftësive të Engine-it (`RenderCapabilities`, `erkasa.capabilities/1 → /2`);
  - deklarata e aftësive (`film/src/capabilities.ts`, vetëm të dhëna që përshkruajnë kodin ekzistues);
  - Gate-i (rregullat e reja);
  - testet.
- **Nuk ndryshon:**
  - skemat `erkasa.render/1` dhe `erkasa.assets/1` (`contracts:gen --check` mbetet pa diff);
  - renderer-i dhe kodi i vizatimit (`film/src/package/`, `v2frame.ts`, `w0/compositor.ts`, set-et, props, rig, templates, `style.ts`), pra edhe gjurmët e builtin-eve;
  - Stager-i;
  - `golden.json`, `golden-evidence.json`, `golden-package.json`, `golden-fixtures-b.json`;
  - pipeline-i default.
- **Jashtë scope-it (E1.5):** mbështetja reale në renderer e gjendjeve-element, nyjeve jo-W0 në `parallax`, tranzicioneve të përziera, `whip` në `parallax`, blur-it dhe aperturës në flat, `align`/`maxWidth` të captions, renditjes së aktorëve sipas `y`, transformeve të builtin-eve, dhe kamerës së parametrizuar të W0.

## 3. Kontrata e aftësive v2 (`erkasa.capabilities/2`)

Sot `RenderCapabilities` ka lista të pavarura (`projections`, `transitions`, `nodeKinds`…). Në v2 ato bëhen rregulla që shprehin kombinimet e mbështetura. Forma e propozuar (TypeScript, vetëm për të qartësuar):

```ts
interface RenderCapabilities {
  contract: "erkasa.render/1";
  // pa ndryshim
  lightKinds: string[];
  fx: string[];
  nodeKinds: string[];
  overlayKinds: string[];
  rigFormats: string[];
  builtins: BuiltinCapability[]; // + fushat e reja më poshtë

  /** I. Projeksionet: çfarë vizatohet në secilin, dhe çfarë kërkohet. */
  projections: Record<
    "flat" | "parallax",
    {
      layers: { builtins: string[]; files: boolean }; // modele emrash: "set.*", "w0.*", "prop.*"
      screen: { builtins: string[]; files: boolean };
      requires: Array<{ role: string; builtin: string; params?: Record<string, unknown>; count: 1 }>;
      camera: {
        channels: string[]; // track i detyrueshëm: ["x","y","height"]
        aperture: number[]; // vlerat e mbështetura: [0]
        referenceDistance: number[] | "unused"; // parallax: [2140]; flat: "unused"
        dolly: number[] | "unused"; // parallax: [0.55]; flat: "unused"
      };
      layer: {
        blur: "unsupported" | "by-role"; // flat: vetëm 0; parallax: sipas rolit
        lit: "unused" | "by-role";
        roles?: Record<string, { blur: "own" | `same-as:${string}`; lit: boolean }>;
      };
      actors: { layer: "own-layer" }; // një aktor për shtresë, pa nyje në të
    }
  >;

  /** II. Tranzicionet si kombinime: lloji × projeksioni para × projeksioni pas. */
  transitions: Array<{
    kind: "cut" | "dissolve" | "whip";
    from: "flat" | "parallax";
    to: "flat" | "parallax";
  }>;

  /** III. Asetet. */
  assets: {
    stateSources: Array<"source" | "element">; // sot: ["source"]
    rigSources: Array<"builtin" | "file">; // sot: ["builtin"]
    fontSources: Array<"builtin" | "file">; // sot: ["builtin"]
  };

  /** IV. Captions: çfarë mbështetet, dhe semantika që sot është konstante në kod. */
  captions: {
    align: Array<"left" | "center" | "right">; // sot: ["center"]
    maxWidth: boolean; // sot: false
    semantics: { fadeIn: 0.12; unspokenOpacity: 0.6; strokeOpacity: 0.9; overVignette: true };
  };
}

interface BuiltinCapability {
  // fushat ekzistuese + :
  /** Fushat e vendosjes që builtin-i i përdor; të tjerat duhet të jenë identitet dhe pa track. */
  placement: Array<"x" | "y" | "scale" | "rotation" | "opacity" | "flip">; // props: ["x","y"]; të tjerët: []
  /** Rig: vlerat e pushimit për kanalet pa track (sot STANDING, glow 0, root 0/0/1, facing 1, turn 1). */
  rig?: { /* ekzistuese */ rest: Record<string, number> };
  /** Font: familja dhe pesha që Engine-i ka me të vërtetë. */
  font?: { family: string; weight: number };
}
```

Vlerat e v2 përshkruajnë vetëm atë që kodi bën sot:

- **flat:**
  - në shtresat e botës: `set.*`, `prop.*`, `template.*` dhe skedarë;
  - në ekran: `type.kinetic`, `overlay.scrim`, `overlay.ots`;
  - asnjë `w0.*`.
- **parallax:**
  - në shtresat e botës: `w0.*` dhe `prop.*`; në ekran: `type.w0`;
  - nuk lejohen skedarë;
  - rolet e detyrueshme: `w0.sky`, `w0.city` (near: false), `w0.city` (near: true), `w0.wall`, `w0.mid`; `w0.near` është opsional.
- **Tranzicionet:**
  - `cut` midis çdo kombinimi;
  - `dissolve` flat→flat dhe parallax→parallax;
  - `whip` vetëm flat→flat.
- **Rolet e blur-it në parallax:**
  - `city` dhe `city_near` = blur-i i `sky`;
  - shtresa `held` = blur-i i shtresës së aktorëve;
  - të gjitha shtresat e aktorëve kanë të njëjtin blur.
- **Kamera e parallax:** `referenceDistance` 2140 dhe `dolly` 0,55 janë konstantet e `w0/camera.ts`.
  - Qendra e kornizës së referencës (1450, 1120) nuk është fushë e paketës: dokumentohet si pjesë e semantikës së `w0.*`.

## 4. Rregullat e Gate-it, kodet dhe shtigjet

Kodet janë të qëndrueshme. Përdoren kodet ekzistuese kur kuptimi përputhet; shtohen vetëm tre të rinj:

- `VALUE_UNSUPPORTED`: fusha ekziston në kontratë, por kjo vlerë nuk zbatohet nga Engine-i.
- `TRACK_MISSING`: një kanal që Engine-i e lexon nuk ka track.
- `ROLE_MISSING`: mungon një pjesë e detyrueshme e projeksionit.

Shtegu është JSON Pointer te fusha që shkakton problemin. Kur ajo mungon, shtegu tregon objektin që duhej ta kishte.

### Grupi A: Gate-i pranon, renderer-i dështon

| #   | Rasti                               | Mbuluar sot?                                                  | Rregulli                                                                                                                                                          | Ndryshim në capabilities?             | Kodi · shtegu                                                                                              | Rrezik K1–K4/K7                                        |
| --- | ----------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A1  | Gjendje-element e asetit            | Jo                                                            | gjendja duhet të ketë burimin e vet, nëse `stateSources` nuk ka `"element"`; kur element-et mbështeten (E1.5), Gate-i kontrollon edhe që id-ja ekziston në skedar | Po: `assets.stateSources`             | `CAPABILITY_MISSING` · `manifest:/assets/i/states/j/element`                                               | Asnjë: 0 gjendje-element në 8 paketat                  |
| A2  | Nyje jo-W0 në `parallax`            | Jo                                                            | builtin-i (ose skedari) i çdo nyjeje duhet të jetë në `projections[p].layers` ose `.screen`                                                                       | Po: `projections[p].layers/screen`    | `CAPABILITY_MISSING` · `package:/scenes/i/layers/j/nodes/k/asset` (ose `/screen/j/nodes/k/asset`)          | Asnjë: builtin-et e përdorura (§7) janë brenda listave |
| A3  | Tranzicion flat → parallax          | Jo                                                            | çifti (`kind`, projeksioni i prerjes para, projeksioni i kësaj) duhet të jetë në `transitions`                                                                    | Po: `transitions` si kombinime        | `CAPABILITY_MISSING` · `package:/edit/i/enter/kind`                                                        | Asnjë                                                  |
| A4  | `whip` në parallax                  | Jo                                                            | si A3                                                                                                                                                             | Po                                    | `CAPABILITY_MISSING` · `package:/edit/i/enter/kind`                                                        | Asnjë: W0 ka vetëm cut/dissolve                        |
| A5  | Tranzicion parallax → flat          | Jo                                                            | si A3                                                                                                                                                             | Po                                    | `CAPABILITY_MISSING` · `package:/edit/i/enter/kind`                                                        | Asnjë                                                  |
| A6  | Builtin i W0 në skenë flat          | Jo                                                            | si A2                                                                                                                                                             | Po                                    | `CAPABILITY_MISSING` · `package:/scenes/i/layers/j/nodes/k/asset`                                          | Asnjë                                                  |
| A7  | Skenë parallax pa rol të W0 (`mid`) | Jo                                                            | çdo rol i `requires` ndodhet saktësisht një herë në skenë                                                                                                         | Po: `projections.parallax.requires`   | `ROLE_MISSING` · `package:/scenes/i/layers` (roli në mesazh); rol i dyfishtë: `ID_DUPLICATE` · nyja e dytë | Asnjë: çdo skenë W0 ka të pesë rolet                   |
| A8  | Parametër-kanal pa track            | Jo                                                            | çdo parametër `channel` i builtin-it të nyjes ka track për atë nyje (parametrat deklarohen tashmë)                                                                | Jo: rregull nga deklaratat ekzistuese | `TRACK_MISSING` · `package:/scenes/i/layers/j/nodes/k` (kanali në mesazh)                                  | Asnjë: provohet te testi pozitiv                       |
| A9  | Kamera pa track `height`            | Jo                                                            | `x`, `y`, `height` kanë track në çdo skenë                                                                                                                        | Po: `projections[p].camera.channels`  | `TRACK_MISSING` · `package:/scenes/i/camera`                                                               | Asnjë                                                  |
| A10 | Rig me burim skedar                 | Pjesërisht: `RIG_UNSUPPORTED` kontrollon formatin, jo burimin | burimi i rig-ut duhet të jetë në `assets.rigSources`; builtin-i duhet të jetë rig i njohur                                                                        | Po: `assets.rigSources`               | `RIG_UNSUPPORTED` · `manifest:/assets/i/source/kind`                                                       | Asnjë: të gjithë rig-et janë builtin                   |

### Grupi B: Gate-i pranon, renderer-i vizaton ndryshe nga paketa

| #   | Fusha                                            | Mbuluar sot?                                                                   | Rregulli                                                                                                                  | Ndryshim në capabilities?                            | Kodi · shtegu                                                                                                          | Rrezik K1–K4/K7                                                                     |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| B1  | `captions.style.align`, `maxWidth`               | Jo                                                                             | `align` ∈ `captions.align`; `maxWidth` mungon nëse `captions.maxWidth` = false                                            | Po: `captions`                                       | `VALUE_UNSUPPORTED` · `package:/overlays/i/style/align`, `…/style/maxWidth`                                            | Asnjë: të dy paketat me captions kanë `center`, pa `maxWidth`                       |
| B2a | `layer.blur` në flat                             | Jo                                                                             | në flat blur = 0                                                                                                          | Po: `projections.flat.layer.blur`                    | `VALUE_UNSUPPORTED` · `package:/scenes/i/layers/j/blur`                                                                | Asnjë: 0 shtresa flat me blur                                                       |
| B2b | Blur-i i shtresave në parallax                   | Pjesërisht: injorohet blur-i i `city`, `city_near` dhe i aktorëve pas të parit | blur-i i çdo roli sipas tabelës së roleve (`same-as`)                                                                     | Po: `projections.parallax.layer.roles`               | `VALUE_UNSUPPORTED` · `package:/scenes/i/layers/j/blur`                                                                | I ulët: testi i Stager-it provon që W0 i ka të barabarta; testi pozitiv e konfirmon |
| B2c | `camera.aperture`                                | Jo                                                                             | `aperture` ∈ `projections[p].camera.aperture` (sot [0])                                                                   | Po                                                   | `VALUE_UNSUPPORTED` · `package:/scenes/i/camera/aperture`                                                              | Asnjë: të gjitha 0                                                                  |
| B2d | `layer.lit`                                      | Jo                                                                             | flat: pa drita (`lightKinds` bosh), `lit` nuk ka efekt; parallax: `lit` sipas rolit                                       | Po: `layer.lit`, `roles.*.lit`                       | `VALUE_UNSUPPORTED` · `package:/scenes/i/layers/j/lit`                                                                 | I ulët: vlerat e roleve merren nga paketa W0 ekzistuese                             |
| B3  | Renditja e aktorëve sipas `y` midis nyjeve       | Jo                                                                             | shtresa e një aktori ka vetëm atë aktor dhe asnjë nyje                                                                    | Po: `projections[p].actors`                          | `VALUE_UNSUPPORTED` · `package:/scenes/i/actors/j/layer`                                                               | Asnjë: 0 shtresa të përziera, një aktor për shtresë                                 |
| B4  | Vendosja e nyjeve builtin                        | Jo                                                                             | për builtin-in: fushat jashtë `placement` = identitet (x 0, y 0, scale 1, rotation 0, opacity 1, flip false) dhe pa track | Po: `builtins[].placement`                           | `VALUE_UNSUPPORTED` · `package:/scenes/i/layers/j/nodes/k/<fusha>`; track: `…/tracks/t/channel`                        | I ulët: 0 vendosje jo-identitet; track-et `x`/`y` vetëm te props, që i përdorin     |
| B5  | `camera.referenceDistance`, `dolly`              | Jo                                                                             | parallax: vlera ∈ capabilities (2140; 0,55); flat: "unused", sepse projeksioni flat nuk i përdor                          | Po                                                   | `VALUE_UNSUPPORTED` · `package:/scenes/i/camera/referenceDistance`, `…/dolly`                                          | Asnjë: W0 = 2140/0,55                                                               |
| B6  | Fonti i captions (gjetje e re gjatë përgatitjes) | Pjesërisht: builtin-i i fontit kontrollohet, bajtet e një fonti-skedar jo      | burimi i fontit ∈ `assets.fontSources`; `family`/`weight` e asetit = ato të builtin-it                                    | Po: `assets.fontSources`; `builtins[].font` ekziston | `CAPABILITY_MISSING` · `manifest:/assets/i/source/kind`; `VALUE_UNSUPPORTED` · `manifest:/assets/i/family`, `…/weight` | Asnjë: `font.montserrat-800`, Montserrat 800                                        |
| B7  | Kohët e captions (0,12 s fade, 0,6/0,9)          | — (nuk ka fushë)                                                               | semantikë e publikuar; nuk refuzohet asgjë                                                                                | Po: `captions.semantics` (vetëm deklaratë)           | —                                                                                                                      | Asnjë                                                                               |

## 5. Pikat 3–4 të kërkesës: track-et, parametrat, rig-et dhe referencat

### Track-et e detyrueshme për çdo tip nyjeje (nga kodi i renderer-it)

| Tipi                        | Kanale me track të detyrueshëm                                               | Parametra statikë (`PARAM_MISSING` ekziston) |
| --------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| Kamera (çdo projeksion)     | `x`, `y`, `height`                                                           | —                                            |
| `set.*.back`, `set.*.front` | `param.t`, `param.light`, `param.door`                                       | —                                            |
| `prop.*.held`               | `param.facing`, `param.rot` (`x`, `y`: track ose vlera e nyjes)              | —                                            |
| `prop.*.resting`            | — (`x`, `y`: track ose vlera e nyjes)                                        | —                                            |
| `template.*`                | `param.t`                                                                    | `dur`, `params`, `anchors`                   |
| `type.kinetic`              | `param.t`                                                                    | `lines`, `y`, `at`, `out`, `dark`            |
| `type.w0`                   | `param.t`                                                                    | `lines`, `place`, `at`, `out`                |
| `overlay.scrim`             | —                                                                            | `place`                                      |
| `overlay.ots`               | `param.t`                                                                    | `dur`, `facing`                              |
| `w0.sky`                    | `param.t`, `light`, `door`, `lamp`, `clockMin`, `binders` (gjendja e vendit) | —                                            |
| `w0.city`                   | —                                                                            | `seed`, `near`                               |
| `w0.wall`                   | —                                                                            | `world`                                      |
| Skedar SVG                  | — (vendosja: track ose vlera e nyjes)                                        | —                                            |
| Aktor                       | asnjë: kanalet pa track marrin `rig.rest` të publikuar                       | —                                            |

Rregulli: çdo parametër `channel` i deklaruar nga builtin-i ka track. Sot të gjithë parametrat-kanal janë të detyrueshëm, sepse renderer-i nuk ka vlerë rezervë. Nëse një builtin do të kishte kanal opsional, deklarata do t'i duhej një fushë `rest`; sot nuk ka asnjë të tillë.

### Rig-et dhe referencat e aseteve

| Rregulli                                                         | Gjendja sot                                                                      | Propozimi                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Burimi i rig-ut është builtin i njohur (`rig.cutout.man\|woman`) | formati kontrollohet, burimi jo                                                  | A10                                                                                               |
| Kanalet dhe kockat e track-eve ekzistojnë në rig                 | ekziston (`CHANNEL_INVALID`, `RIG_UNSUPPORTED`)                                  | pa ndryshim                                                                                       |
| Vlerat e pushimit të rig-ut publikohen (`rig.rest`)              | konstante në renderer                                                            | deklaratë e re, pa refuzim; prisoner-cell mbështetet tek ajo (vetëm `thigh`, `thighF` kanë track) |
| Slot-et e pamjes                                                 | ekziston (`APPEARANCE_SLOTS`)                                                    | pa ndryshim                                                                                       |
| Gjendja e nyjes, pivot-i, aseti, lloji                           | ekziston (`STATE_UNDECLARED`, `PIVOT_UNDECLARED`, `ASSET_MISSING`, `ASSET_KIND`) | pa ndryshim                                                                                       |
| Gjendje-element                                                  | nuk kontrollohet                                                                 | A1                                                                                                |
| Fonti i captions                                                 | pjesërisht                                                                       | B6                                                                                                |

## 6. Ndikimi në kontrata

| Kontrata                                                                                    | Ndryshim                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `erkasa.render/1` (paketa)                                                                  | **Asnjë.** Asnjë fushë e re, asnjë fushë e hequr; `contracts:gen --check` pa diff. Ndryshon vetëm se cilat vlera pranohen nga ky Engine.                                                                                                                                                                                             |
| `erkasa.assets/1` (manifesti)                                                               | **Asnjë.**                                                                                                                                                                                                                                                                                                                           |
| `RenderCapabilities` (`gate/src/capabilities.ts`, publikuar nga `film/src/capabilities.ts`) | **Ndryshim i madh.** `erkasa.capabilities/1 → /2`; `projections` dhe `transitions` ndryshojnë formë; shtohen `assets`, `captions` dhe `builtins[].placement`, `rig.rest`. `capabilityProblems` e mbulon formën e re, dhe një dokument v1 refuzohet me `CAPABILITIES_INVALID`. Konsumatorët janë vetëm Gate-i, renderer-i dhe testet. |
| Kodet e gabimeve të Gate-it                                                                 | Shtohen `VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`. Të tjerët mbeten.                                                                                                                                                                                                                                                      |
| Gjurmët e builtin-eve                                                                       | **Pa ndryshim**, sepse asnjë skedar vizatimi nuk preket. `film/src/capabilities.ts` nuk është skedar implementues i asnjë builtin-i.                                                                                                                                                                                                 |
| Fixtures A (kontrata)                                                                       | Listat e refuzimeve në `gate/test/films.test.ts` mund të fitojnë gjetje të reja, si te `EASE_UNDEFINED`. Çdo ndryshim raportohet.                                                                                                                                                                                                    |

## 7. Matja e tetë paketave ekzistuese (bazë për rrezikun)

| Paketa        | Projeksioni          | Tranzicionet  | Builtin-et (bota / ekrani)                                                                | Captions | Vendosje builtin jo-identitet | Shtresa të përziera | Blur flat | Aperturë |
| ------------- | -------------------- | ------------- | ----------------------------------------------------------------------------------------- | -------- | ----------------------------- | ------------------- | --------- | -------- |
| B1–B5         | flat                 | cut           | `set.*`, `prop.*`, `template.*` / `type.kinetic`, `overlay.scrim` (B2 edhe `overlay.ots`) | —        | 0                             | 0                   | 0         | 0        |
| W0            | parallax (2140/0,55) | cut, dissolve | `w0.*`, `prop.*` / `type.w0`                                                              | center   | 0                             | 0                   | —         | 0        |
| prisoner-cell | flat                 | —             | skedarë                                                                                   | center   | 0                             | 0                   | 0         | 0        |
| office-clock  | flat                 | whip          | `set.*`, `template.*` / `type.kinetic`                                                    | —        | 0                             | 0                   | 0         | 0        |

Rrjedhimi: asnjë rregull i propozuar nuk refuzon paketat ekzistuese. Testi pozitiv (T2) e provon këtë në kod.

## 8. Testet e pranimit

| #      | Testi                                                                                                                                                                                                                      | Kalon kur                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** | **Negative, para renderimit.** 16 rastet e grupeve A dhe B (A1–A10, B1–B6), plus kufijtë: rol i dyfishtë; `align: "right"`; track-u `scale` mbi builtin; parallax→flat me `cut` (lejohet) kundrejt `dissolve` (refuzohet). | Secili refuzohet me kodin dhe shtegun e saktë, dhe asgjë tjetër. `renderPackage` jep gjetjet e `validate()`, **0 kuadro** dhe `begin` i sink-ut nuk thirret, pra encoder-i nuk niset. Shtohen te `gate/test/broken.ts`: K5 bëhet 50 + N.                                                                                                                                                                                                              |
| **T2** | **Pozitive.** B1–B5, W0, prisoner-cell dhe office-clock kalojnë Gate-in v2 pa gabime dhe pa paralajmërime të reja.                                                                                                         | `ok`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **T3** | **Identiteti vizual pas ndryshimit.** K1 (6 043 kuadro), K2/K3 (`golden:package`), K4 (i–ii) dhe K7 rishkohen.                                                                                                             | K1–K4 dhe K7 me rezultatet e sotme: 0 dështime; 931/931 hash identikë me `golden-package.json` dhe `golden-fixtures-b.json`. Asnjë golden nuk rishkruhet (`--write` refuzon).                                                                                                                                                                                                                                                                         |
| **T4** | **Ekzekutueshmëria (drejtimi i kundërt i K5).** `gate-audit.ts` bëhet test.                                                                                                                                                | Çdo paketë e pranuar nga Gate-i renderohet pa gabim; 0 raste të mbetura në grupin A.                                                                                                                                                                                                                                                                                                                                                                  |
| **T5** | **Kontrata e aftësive.**                                                                                                                                                                                                   | `capabilities()` v2 është deterministe dhe kalon `capabilityProblems`; një dokument v1 dhe dokumentet e prishura (rol pa builtin, tranzicion me projeksion të panjohur, `placement` me fushë të panjohur) refuzohen me `CAPABILITIES_INVALID`. Vlerat e v2 provohen kundrejt kodit: `rig.rest` = `STANDING`; `referenceDistance`/`dolly` = konstantet e `w0/camera.ts`; `captions.semantics` = konstantet e `w0/compositor.ts` dhe `package/draw.ts`. |
| **T6** | **Pa regresion (K9).**                                                                                                                                                                                                     | Të gjitha testet, typecheck, lint, format; `contracts:gen --check` pa diff; gjurmët e builtin-eve të pandryshuara; `golden.json` pa ndryshim.                                                                                                                                                                                                                                                                                                         |

## 9. Rendi i punës pas miratimit (commit-e të vogla)

1. Kontrata `erkasa.capabilities/2`, `capabilityProblems` dhe T5. Gate-i ende pa rregulla të reja; T2 dhe T3 duhet të kalojnë.
2. Deklarata në `film/src/capabilities.ts`: vetëm të dhëna, me provat e T5 kundrejt kodit.
3. Rregullat A1–A10: test negativ dhe kod për secilin.
4. Rregullat B1–B6, dhe deklarata B7.
5. T4 (auditimi si test) dhe rishtimi i T3.
6. Përditësimi i raportit E1.4 dhe i K5; ndalesë për review.

Çdo devijim raportohet para se të vazhdoj.

## 10. Pikat për vendimin e PO-së

1. **Format v2 i aftësive** (§3), veçanërisht `projections` si objekt dhe `transitions` si kombinime. Ky është një ndryshim i madh i kontratës së aftësive, por jo i skemave të paketës.
2. **Tre kodet e reja:** `VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`. Alternativa është vetëm `CAPABILITY_MISSING` me mesazhe të ndryshme, që është më pak e qartë për Planner-in dhe Stager-in.
3. **Rig-et:** kanalet pa track marrin `rig.rest` të publikuar (rekomandim; mban prisoner-cell). Alternativa, track i detyrueshëm për çdo kanal, do ta refuzonte prisoner-cell dhe kërkon rigjenerimin e fixtures B.
4. **Kamera e flat:** `referenceDistance` dhe `dolly` shpallen "unused", jo të refuzuara, sepse projeksioni flat nuk i përdor me përkufizim.
