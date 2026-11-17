# E1.4 · Gate PASS ⟹ Renderer-i ekzekuton: scope minimal (v2)

|            |                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi    | **Miratuar me kushte nga PO-ja (2026-11-17); i përditësuar sipas kushteve A–F. Implementimi nuk është autorizuar ende. Mbeten dy vendime të hapura (§F: V1, V2).**                                                                                                                                        |
| Zëvendëson | propozimin e parë në këtë skedar (`7a5d8d9`)                                                                                                                                                                                                                                                              |
| Branch     | `e1-4-engine-reads-package` (pa merge në `main`)                                                                                                                                                                                                                                                          |
| Burimet    | `film/test/package/gate-audit.ts` (16 rastet); kodi i renderer-it (`film/src/package/`, `v2frame.ts`, `w0/compositor.ts`); skemat JSON `contracts/json-schema/render-package.schema.json` (180 fusha fundore) dhe `asset-manifest.schema.json` (63); matjet e tetë paketave ekzistuese (§C.3), 2026-11-17 |

**Parimi.** Nëse Gate-i e pranon paketën, renderer-i e ekzekuton atë sipas semantikës së saj në çdo kuadër. Nuk pranohet që Gate-i të miratojë një paketë dhe renderer-i më pas të dështojë, ose të injorojë një fushë.

**Kufijtë.**

- Brenda E1.4 nuk zgjerohet renderer-i dhe nuk preken skemat e paketës dhe të manifestit.
- Nuk preken golden-at dhe baseline-t, pipeline-i default dhe `main`.
- Boshllëku mbyllet vetëm nga Gate-i, mbi deklaratën e aftësive të Engine-it, e cila përshkruan kodin ekzistues.
- "Renderer-i duhet ta mbështesë" del vetëm si kandidat për E1.5.

**Korrigjim i numërimit.** 16 rastet e skriptit të auditimit ndahen kështu:

- **11 pranohen nga Gate-i:** 10 dështojnë gjatë renderimit dhe 1 renderohet gabim (R15, captions `align: "left"` në qendër).
- **5 refuzohen saktë.**

Raporti i E1.4 shkruante "10 pranohen, 6 refuzohen". I gjashti i refuzuar ishte një variant i parë i R7, që nuk është në skript; raporti korrigjohet në të njëjtin commit dokumentimi.

---

## 0. Vendimi i PO-së dhe kushtet (2026-11-17)

**Të miratuara:**

1. Engine capabilities v2.
2. Kodet `VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`.
3. Klasifikimi i të gjitha fushave të skemave.
4. Nëntë gjetjet e reja.
5. Dalja: 1080×1920, 30 FPS, pa audio.
6. Kanalet e rig-ut pa track marrin pozën e pushimit të publikuar.
7. Testet pozitive të tetë paketave.
8. Korrigjimi 11/16 dhe 5/16.

| Kushti                                                                                                                                                                     | Si zbatohet në këtë dokument                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A.** Fushat e paimplementuara që nënkuptojnë sjellje të dukshme ose funksionale nuk pranohen si "pa efekt"; audio, mix, events dhe contacts refuzohen kur nuk mbështeten | Klasa `unused` hiqet. `audio` (paketa) dhe asetet `kind: "audio"` (manifesti) refuzohen. `contacts` refuzohen. Event-et pranohen vetëm në nënbashkësinë që renderer-i zbaton: dukshmëri, `fx: none`, `duration: 0`. Çdo `state` refuzohet. `mix` nuk mund të refuzohet pa refuzuar çdo paketë, sepse skema e kërkon: **vendim i hapur V1**. |
| **B.** `bounds` metadata/pa efekt vetëm nëse provohet që nuk ndikon dhe nuk bie ndesh me paketën                                                                           | U mat. Renderer-i nuk e lexon `bounds` (provohet në §B.4). Por 7 nga 8 paketat kanë kuadro ku pamja e kamerës del jashtë `bounds`, në kundërshtim me tekstin e kontratës ("the camera is kept inside it"). Kushti B nuk plotësohet, ndaj `bounds` **nuk** klasifikohet si metadata: **vendim i hapur V2**.                                  |
| **C.** Testi i plotësisë zbulon automatikisht çdo fushë të re                                                                                                              | T7 i lexon fushat në kohën e testit nga `contracts/json-schema/*.schema.json` (pa listë të koduar). Dështon për çdo fushë pa klasë, dhe për çdo klasifikim që nuk përputhet me asnjë fushë.                                                                                                                                                 |
| **D.** Çdo fushë e pranuar ka semantikë të përcaktuar                                                                                                                      | Pesë klasa: `applied`, `restricted`, `refused`, `validated`, `metadata`. Çdo fushë ka në tabelë semantikën ose rregullin e vet (Shtojca 1). Nuk ka klasë "injorohet". U shtua gjetja X10 (lartësia e rig-ut, e injoruar sot).                                                                                                               |
| **E.** Tetë paketat kalojnë dhe ruajnë identitetin e kuadrove                                                                                                              | P1 + P4 (§D.2), kriter pranimi i detyrueshëm.                                                                                                                                                                                                                                                                                               |
| **F.** Çdo paketë e refuzuar: 0 kuadro, encoder i pandezur                                                                                                                 | Çdo rast i D.1 kërkon `frames = 0` dhe asnjë thirrje `begin`, `frame` ose `end` të sink-ut.                                                                                                                                                                                                                                                 |

---

## A. Analiza e 16 rasteve

Kategoritë e klasifikimit:

- **GR** (Gate refuzon): renderer-i nuk e vizaton.
- **KK** (kufizim i shprehur në kontratë): `capabilities` deklaron atë që Engine-i vizaton, dhe Gate-i refuzon gjithçka jashtë tij.
- **RM** (renderer mbështet): kandidat për E1.5, jo në E1.4.

Në E1.4 çdo rast i pambështetur është **GR mbi KK**: kufizimi deklarohet në `capabilities` dhe Gate-i e zbaton. Kodet dhe shtigjet janë JSON Pointer brenda skedarit (`package` ose `manifest`). `{x}` është indeksi i gjetur nga testi.

| #   | Rasti (gate-audit.ts)                                                                 | Sot: Gate · Renderer                                                                             | Klasifikimi E1.4 | Rregulli                                                                                                                                                                                   | Kodi · shtegu                                                                                                                                                                                                                                                                                                       | Testi negativ                                                                                                                                                                                   | E1.5                                                 |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| R1  | Gjendje aseti si element i skedarit kryesor (`element: "seat"`, që as nuk ekziston)   | pranon · dështon (`state 'default' is an element…`)                                              | GR + KK          | çdo gjendje ka `source`, sepse `assets.stateSources` = `["source"]`                                                                                                                        | `CAPABILITY_MISSING` · `manifest:/assets/{chair}/states/0/element`                                                                                                                                                                                                                                                  | N1: rasti R1 si është                                                                                                                                                                           | RM: gjendjet-element, me kontroll të id-së në SVG    |
| R2  | Nyje jo-W0 në skenë `parallax` (B3, `s02_sh02`)                                       | pranon · dështon (`'set.room.back' is not drawn in a parallax scene`)                            | GR + KK          | builtin-i ose skedari i çdo nyjeje ∈ `projections[p].layers` / `.screen`; rolet e `requires` janë të pranishme; vetitë e kamerës, shtresave dhe aktorëve sipas projeksionit                | kryesorja: `CAPABILITY_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}/asset` dhe `…/screen/{j}/nodes/{k}/asset`; plus `ROLE_MISSING` · `package:/scenes/1/layers` (një për rol) dhe `VALUE_UNSUPPORTED` për `camera/referenceDistance`, `camera/dolly`, `actors/{j}/rim`, `actors/{j}/shadow`, `layers/{j}/lit` | N2a: rasti R2, lista e plotë e gjetjeve e ngrirë në test. N2b (një defekt): W0 me një nyje `set.*.back` në shtresën `mid` → vetëm `CAPABILITY_MISSING` te ajo nyje                              | RM: nyje të përgjithshme në parallax                 |
| R3  | Tranzicion flat → parallax me `dissolve` (B3, `edit/1`)                               | pranon · dështon (`a parallax scene enters only by cut or dissolve from another parallax scene`) | GR + KK          | (`enter.kind`, projeksioni i prerjes para, projeksioni i kësaj) ∈ `transitions`                                                                                                            | `CAPABILITY_MISSING` · `package:/edit/1/enter/kind`, plus gjetjet e R2 për `s02_sh02`                                                                                                                                                                                                                               | N3a: rasti R3. N3b (një defekt): paketë me një skenë flat të vlefshme (office-clock) dhe një skenë W0 të vlefshme, me `dissolve` midis tyre → vetëm `CAPABILITY_MISSING` · `/edit/1/enter/kind` | RM: tranzicione të përziera                          |
| R4  | `whip` në parallax (W0, `s12_sh12`)                                                   | pranon · dështon (i njëjti gabim si R3)                                                          | GR + KK          | si R3: `whip` vetëm flat → flat                                                                                                                                                            | `CAPABILITY_MISSING` · `package:/edit/{s12}/enter/kind`                                                                                                                                                                                                                                                             | N4: rasti R4 (një defekt)                                                                                                                                                                       | RM: `whip` në parallax                               |
| R5  | "parallax → flat": skena 2 e W0 me `projection: "flat"`                               | pranon · dështon (`'w0.sky' is not drawn in a flat scene`)                                       | GR + KK          | **Shënim:** skena 2 hyn me `cut`, i lejuar në çdo kombinim, kështu që rasti nuk teston tranzicionin. Teston builtin-et `w0.*` në flat, njësoj si R6. Rregullat e R2 për projeksionin flat. | `CAPABILITY_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}/asset` (çdo `w0.*`), `…/screen/0/nodes/{k}/asset` (`type.w0`); `VALUE_UNSUPPORTED` · `…/layers/{j}/blur`, `…/layers/{j}/lit`, `…/actors/{j}/rim`, `…/actors/{j}/shadow`                                                                              | N5a: rasti R5. N5b (tranzicioni i vërtetë parallax → flat): skenë W0 e vlefshme + skenë flat e vlefshme me `dissolve` → vetëm `CAPABILITY_MISSING` · `/edit/1/enter/kind`                       | RM: si R3                                            |
| R6  | Builtin i W0 në skenë flat (W0, skena 1 me `projection: "flat"`)                      | pranon · dështon (`'w0.sky' is not drawn in a flat scene`)                                       | GR + KK          | si R5                                                                                                                                                                                      | si R5, për `scenes/0`                                                                                                                                                                                                                                                                                               | N6: rasti R6                                                                                                                                                                                    | RM: jo e nevojshme (W0 është parallax me përkufizim) |
| R7  | Skenë parallax pa shtresën `mid` të W0 (nyjet, track-et dhe event-et e saj të hequra) | pranon · dështon (`a parallax scene needs W0's mid layer`)                                       | GR + KK          | çdo rol i `projections.parallax.requires` ndodhet saktësisht një herë në skenë                                                                                                             | `ROLE_MISSING` · `package:/scenes/0/layers` (mesazhi: `w0.mid`); rol i dyfishtë: `ID_DUPLICATE` · nyja e dytë                                                                                                                                                                                                       | N7: rasti R7 (një defekt); N7b: dy nyje `w0.sky` → `ID_DUPLICATE`                                                                                                                               | —                                                    |
| R8  | Parametër-kanal pa track (`set_back` `param.t`)                                       | pranon · dështon (`0 tracks for node:set_back:param.t`)                                          | GR               | çdo parametër `channel` i builtin-it ka track për nyjen; kjo del nga deklaratat ekzistuese, pa ndryshim në `capabilities`                                                                  | `TRACK_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}` (mesazhi: `param.t`)                                                                                                                                                                                                                                     | N8: rasti R8 (një defekt)                                                                                                                                                                       | —                                                    |
| R9  | Kamera pa track `height`                                                              | pranon · dështon (`0 tracks for camera::height`)                                                 | GR + KK          | `x`, `y`, `height` të kamerës kanë track                                                                                                                                                   | `TRACK_MISSING` · `package:/scenes/1/camera` (mesazhi: `height`)                                                                                                                                                                                                                                                    | N9: rasti R9 (një defekt)                                                                                                                                                                       | —                                                    |
| R10 | Pivot që aseti nuk e ka                                                               | **refuzon** (`PIVOT_UNDECLARED` · `package:/scenes/1/layers/0/nodes/3/pivot`)                    | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N10: rasti R10 si regresion                                                                                                                                                                     | —                                                    |
| R11 | Gjendje që aseti nuk e ka                                                             | **refuzon** (`STATE_UNDECLARED` · `…/nodes/3/state`)                                             | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N11                                                                                                                                                                                             | —                                                    |
| R12 | Edit me skenë që nuk ekziston                                                         | **refuzon** (`EDIT_SCENE` · `package:/edit/0/scene`)                                             | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N12                                                                                                                                                                                             | —                                                    |
| R13 | Font i captions që nuk është font                                                     | **refuzon** (`ASSET_KIND` · `package:/overlays/0/style/font`)                                    | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N13                                                                                                                                                                                             | —                                                    |
| R14 | Rig me burim skedar                                                                   | pranon · dështon (`rig_cutout_man@1 is not a builtin rig`)                                       | GR + KK          | burimi i rig-ut ∈ `assets.rigSources` (`["builtin"]`)                                                                                                                                      | `RIG_UNSUPPORTED` · `manifest:/assets/{rig}/source/kind`                                                                                                                                                                                                                                                            | N14: rasti R14 (një defekt)                                                                                                                                                                     | RM: rig-e nga skedari                                |
| R15 | Captions me `align: "left"` (W0)                                                      | pranon · **renderon gabim** (në qendër, pa gabim)                                                | GR + KK          | `style.align` ∈ `captions.align` (`["center"]`)                                                                                                                                            | `VALUE_UNSUPPORTED` · `package:/overlays/0/style/align`                                                                                                                                                                                                                                                             | N15: rasti R15 (një defekt)                                                                                                                                                                     | RM: `align`, `maxWidth`                              |
| R16 | Nyje `type.kinetic` pa parametrin `lines`                                             | **refuzon** (`PARAM_MISSING` · `package:/scenes/1/screen/0/nodes/1/params`)                      | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N16                                                                                                                                                                                             | —                                                    |

**Përmbledhje:**

- 11 raste mbyllen nga Gate-i: 10 me `capabilities` v2 dhe 1 (R8) nga deklaratat ekzistuese.
- 5 raste mbeten të refuzuara si sot dhe hyjnë në K5 si regresion.
- Asnjë rast nuk zgjidhet duke zgjeruar renderer-in në E1.4.

### A.2 Gjetje shtesë: matrica e fushave

Pika 5 kërkon garanci që Gate-i nuk pranon semantikë që renderer-i e injoron. 16 rastet janë një mostër, jo garanci. Ndaj i kalova të 243 fushat fundore të dy skemave kundrejt kodit të renderer-it (§B.4). Matrica gjeti **9 boshllëqe të tjera të të njëjtit lloj**, plus X10, të gjetur gjatë klasifikimit të plotë sipas kushtit D. Asnjë nuk përdoret nga tetë paketat ekzistuese: X10 përputhet, sepse Stager-i shkruan lartësinë që mat vetë `drawPerson`.

| #   | Fusha                                                                          | Çfarë bën renderer-i sot                                                                                                             | Rregulli (GR + KK)                                                                            | Kodi · shtegu                                                                                                               |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| X1  | `audio[]`; asetet `kind: "audio"`                                              | i injoron; video del pa zë                                                                                                           | `audio` bosh, sepse `output.audio` = false; asnjë aset audio në manifest                      | `CAPABILITY_MISSING` · `package:/audio/{i}`; `CAPABILITY_MISSING` · `manifest:/assets/{a}/kind`                             |
| X2  | `scenes[].events[].state` (ndërrim gjendjeje)                                  | e injoron; vizaton gjendjen statike të nyjes                                                                                         | event-et nuk ndërrojnë gjendje: `events.state` = false                                        | `CAPABILITY_MISSING` · `package:/scenes/{i}/events/{k}/state`                                                               |
| X3  | `scenes[].contacts[]` (aktori mban nyjen në një socket)                        | i injoron                                                                                                                            | `contacts` bosh: `contacts` = false (objektet në dorë vizatohen nga builtin-i `prop.*.held`)  | `CAPABILITY_MISSING` · `package:/scenes/{i}/contacts/{k}`                                                                   |
| X4  | `events[].duration` kur `fx` = `none`                                          | pa efekt (fx `none` është i menjëhershëm)                                                                                            | `duration` = 0 kur `fx` = `none`                                                              | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/events/{k}/duration`                                                             |
| X5  | `actors[].rim`, `shadow`                                                       | flat: i injoron (kurrë pa rim/hije); parallax: i vizaton gjithmonë                                                                   | flat: `false`; parallax: `true`                                                               | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/actors/{j}/rim` (`…/shadow`)                                                     |
| X6  | `overlays[].at` si `{ node                                                     | actor, offset }` (captions që ndjekin diçka)                                                                                         | lexon vetëm `at.x`/`at.y`, pra pozicion `NaN`                                                 | captions vetëm me `{ x, y }`: `captions.anchor` = `["screen"]`                                                              | `CAPABILITY_MISSING` · `package:/overlays/{i}/at` |
| X7  | `overlays[].style.maxWidth`                                                    | e injoron                                                                                                                            | mungon, sepse `captions.maxWidth` = false                                                     | `VALUE_UNSUPPORTED` · `package:/overlays/{i}/style/maxWidth`                                                                |
| X8  | `output.width`, `output.height`                                                | vizaton gjithmonë 1080 × 1920 (konstantet `W`, `H`), por i jep sink-ut madhësinë e paketës: video e korruptuar në çdo madhësi tjetër | `width` × `height` ∈ `output.sizes` (`[[1080, 1920]]`)                                        | `VALUE_UNSUPPORTED` · `package:/output/width` (`…/height`)                                                                  |
| X9  | Fonti i captions: burim skedar, ose `family`/`weight` që nuk janë të Engine-it | vizaton gjithmonë me Montserrat-in e Engine-it                                                                                       | burimi ∈ `assets.fontSources` (`["builtin"]`); `family`/`weight` e asetit = ato të builtin-it | `CAPABILITY_MISSING` · `manifest:/assets/{f}/source/kind`; `VALUE_UNSUPPORTED` · `manifest:/assets/{f}/family` (`…/weight`) |
| X10 | `assets[].height` i rig-ut (lartësia në këmbë)                                 | e injoron; rig-u builtin vizatohet me lartësinë e vet (780,768…)                                                                     | = `builtins[].rig.height`                                                                     | `VALUE_UNSUPPORTED` · `manifest:/assets/{r}/height`                                                                         |

Boshllëqet nga propozimi i parë që nuk dolën si raste të skriptit mbeten në scope:

| #   | Fusha                                                                                                                                              | Rregulli                                                                                                                          | Kodi · shtegu                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Y1  | `layers[].blur` në flat                                                                                                                            | 0                                                                                                                                 | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/layers/{j}/blur`                |
| Y2  | Blur-i i shtresave në parallax (kompozitori lexon blur-in e `sky` për `city`/`city_near`, dhe të aktorit të parë për të gjithë aktorët dhe `held`) | blur-i sipas tabelës së roleve (`same-as`)                                                                                        | `VALUE_UNSUPPORTED` · `…/layers/{j}/blur`                                  |
| Y3  | `layers[].lit`                                                                                                                                     | flat: `false` (pa drita); parallax: sipas rolit (`sky`, `city`, `city_near`: false; `wall`, `mid`, aktorët, `held`, `near`: true) | `VALUE_UNSUPPORTED` · `…/layers/{j}/lit`                                   |
| Y4  | `camera.aperture`                                                                                                                                  | ∈ `[0]`                                                                                                                           | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/camera/aperture`                |
| Y5  | `camera.referenceDistance`, `dolly` në parallax                                                                                                    | ∈ `[2140]`, `[0.55]` (konstantet e `w0/camera.ts`); në flat: pa efekt me përkufizim                                               | `VALUE_UNSUPPORTED` · `…/camera/referenceDistance` (`…/dolly`)             |
| Y6  | Renditja e aktorëve sipas `y` midis nyjeve                                                                                                         | shtresa e një aktori ka vetëm atë aktor dhe asnjë nyje                                                                            | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/actors/{j}/layer`               |
| Y7  | Vendosja e nyjeve builtin (`x`, `y`, `scale`, `rotation`, `opacity`, `flip`, `pivot`)                                                              | fushat jashtë `builtins[].placement` (props: `["x","y"]`; të tjerët: `[]`) janë identitet (`pivot` null) dhe pa track             | `VALUE_UNSUPPORTED` · `…/nodes/{k}/<fusha>`; track: `…/tracks/{t}/channel` |

---

## B. Ndryshimet e propozuara

### B.1 Engine capabilities v2 (`erkasa.capabilities/2`)

Forma më poshtë është vetëm për qartësi; nuk është kod. Fushat ekzistuese mbeten: `lightKinds`, `fx`, `nodeKinds`, `overlayKinds`, `rigFormats`, `builtins`.

```ts
interface RenderCapabilities {
  contract: "erkasa.render/1";
  lightKinds;
  fx;
  nodeKinds;
  overlayKinds;
  rigFormats; // pa ndryshim
  builtins: BuiltinCapability[]; // + placement, rig.rest, font

  output: { sizes: Array<[number, number]>; fps: number[]; audio: boolean }; // [[1080,1920]], [30], false

  /** projeksion × shtresë × builtin: çfarë vizatohet ku, dhe çfarë kërkohet */
  projections: Record<
    "flat" | "parallax",
    {
      layers: { builtins: string[]; files: boolean }; // flat: set.*, prop.*, template.* + skedarë; parallax: w0.*, prop.*
      screen: { builtins: string[]; files: boolean }; // flat: type.kinetic, overlay.scrim, overlay.ots; parallax: type.w0
      requires: Array<{ role: string; builtin: string; params?: object }>; // parallax: sky, city, city_near, wall, mid
      camera: {
        channels: string[]; // ["x","y","height"]
        aperture: number[]; // [0]
        referenceDistance: number[] | "unused"; // parallax [2140]; flat "unused"
        dolly: number[] | "unused"; // parallax [0.55]; flat "unused"
      };
      layer: {
        blur: "zero" | "by-role";
        lit: boolean | "by-role";
        roles?: Record<string, { blur: "own" | `same-as:${string}`; lit: boolean }>;
      };
      actors: { layer: "own"; rim: boolean; shadow: boolean }; // flat: false/false; parallax: true/true
    }
  >;

  /** tranzicion × projeksioni para × projeksioni pas */
  transitions: Array<{ kind: "cut" | "dissolve" | "whip"; from: string; to: string }>;
  // cut: të gjitha çiftet; dissolve: flat→flat, parallax→parallax; whip: flat→flat

  events: { state: boolean; durationWithoutFx: 0 }; // state: false
  contacts: boolean; // false

  assets: {
    kinds: ["vector", "rig", "font"];
    stateSources: ["source"];
    rigSources: ["builtin"];
    fontSources: ["builtin"];
  };

  captions: {
    anchor: ["screen"];
    align: ["center"];
    maxWidth: false;
    semantics: { fadeIn: 0.12; unspokenOpacity: 0.6; strokeOpacity: 0.9; overVignette: true }; // deklaratë
  };

  /** si e trajton Engine-i çdo fushë të skemave (§B.4); i plotë për skemat aktuale */
  fields: Record<
    string /* JSON Pointer me * */,
    "applied" | "restricted" | "refused" | "validated" | "metadata" | "unused"
  >;
}

interface BuiltinCapability {
  // ekzistuese + :
  placement: Array<"x" | "y" | "scale" | "rotation" | "opacity" | "flip" | "pivot">;
  rig?: { /* ekzistuese */ rest: Record<string, number> }; // STANDING, glow 0; root.x 0, root.y 0, root.scale 1, facing 1, turn 1
  font?: { family: string; weight: number }; // font.montserrat-800: Montserrat 800
}
```

### B.2 Kanalet dhe track-et e detyrueshme (nga kodi i renderer-it)

| Tipi                                    | Kanale me track të detyrueshëm                            | Statikë (ekziston `PARAM_MISSING`) |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| Kamera                                  | `x`, `y`, `height`                                        | —                                  |
| `set.*.back` / `set.*.front`            | `param.t`, `param.light`, `param.door`                    | —                                  |
| `prop.*.held`                           | `param.facing`, `param.rot`                               | —                                  |
| `prop.*.resting`                        | —                                                         | —                                  |
| `template.*`                            | `param.t`                                                 | `dur`, `params`, `anchors`         |
| `type.kinetic`                          | `param.t`                                                 | `lines`, `y`, `at`, `out`, `dark`  |
| `type.w0`                               | `param.t`                                                 | `lines`, `place`, `at`, `out`      |
| `overlay.scrim`                         | —                                                         | `place`                            |
| `overlay.ots`                           | `param.t`                                                 | `dur`, `facing`                    |
| `w0.sky` (gjendja e vendit)             | `param.t`, `light`, `door`, `lamp`, `clockMin`, `binders` | —                                  |
| `w0.city`                               | —                                                         | `seed`, `near`                     |
| `w0.wall`                               | —                                                         | `world`                            |
| Skedar SVG; vendosja e props (`x`, `y`) | track ose vlera e nyjes                                   | —                                  |
| Aktor                                   | asnjë: pa track, vlen `rig.rest` i publikuar              | —                                  |

Rregulli i përgjithshëm: çdo parametër `channel` i deklaruar nga builtin-i është i detyrueshëm. Sot asnjë builtin nuk ka kanal opsional. Nëse ndonjëherë do ketë, deklarata do t'i duhej një fushë `rest`.

### B.3 Rregullat e reja të Gate-it

| Grupi                                | Rregulli                                                                                                                                                 | Raste                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| G-P (projeksion × shtresë × builtin) | builtin-i ose skedari i nyjes ∈ listat e projeksionit; rolet e kërkuara saktësisht një herë; vetitë e kamerës, shtresave dhe aktorëve sipas projeksionit | R2, R5, R6, R7, X5, Y1–Y6 |
| G-T (tranzicion × projeksione)       | (`kind`, `from`, `to`) ∈ `transitions`                                                                                                                   | R3, R4, R5b               |
| G-K (track-e)                        | kanalet e detyrueshme të B.2                                                                                                                             | R8, R9                    |
| G-A (asete)                          | `stateSources`, `rigSources`, `fontSources`, font `family`/`weight`                                                                                      | R1, R14, X9               |
| G-C (captions)                       | `anchor`, `align`, `maxWidth`                                                                                                                            | R15, X6, X7               |
| G-B (vendosja e builtin-eve)         | `placement`                                                                                                                                              | Y7                        |
| G-E (event-e, contacts, dalja)       | `events.state`, `durationWithoutFx`, `contacts`, `output`                                                                                                | X1–X4, X8                 |

**Kodet.** Tre kode të reja të qëndrueshme:

- `VALUE_UNSUPPORTED`: fusha ekziston në kontratë, por kjo vlerë nuk zbatohet nga Engine-i.
- `TRACK_MISSING`: një kanal i detyrueshëm nuk ka track.
- `ROLE_MISSING`: mungon një rol i kërkuar nga projeksioni.

Përdoren edhe kodet ekzistuese `CAPABILITY_MISSING`, `RIG_UNSUPPORTED` dhe `ID_DUPLICATE`.

**Shtigjet.** Shtegu tregon fushën që shkakton problemin. Kur fusha mungon (track, rol), shtegu tregon objektin që duhej ta kishte, dhe mesazhi e emërton. Renditja totale e gjetjeve mbetet si sot.

### B.4 Garancia sistematike: matrica e fushave (pika 5, kushtet C dhe D)

1. `capabilities.fields` klasifikon **çdo fushë fundore** të `erkasa.render/1` (180) dhe `erkasa.assets/1` (63). Klasat:
   - `applied`: renderer-i e zbaton sipas kontratës.
   - `restricted`: Gate-i pranon vetëm vlerat e deklaruara; ato zbatohen.
   - `refused`: Gate-i e refuzon praninë (ose çdo element) të fushës.
   - `validated`: Gate-i kontrollon integritetin (id, hash, pin, miratim, emra rig-u); semantika e saj është integriteti, pa efekt vizatimi.
   - `metadata`: kontrata nuk i jep semantikë vizatimi (prodhuesi, licenca, prejardhja; `affordances` dhe `defaultState`, që kontrata ua lë prodhuesit, sepse "nodes always name one").

   Nuk ka klasë "pa efekt" për fusha që nënkuptojnë sjellje (kushti A). Kur kontrata vetë thotë që një fushë nuk ka efekt në një kontekst, kjo shkruhet si semantikë te fusha (p.sh. `depth` dhe `referenceDistance`/`dolly` në flat: "every layer moves with the camera (no parallax)").

2. **Plotësia (T7, kushti C).** Testi lexon në kohën e ekzekutimit fushat fundore nga `contracts/json-schema/render-package.schema.json` dhe `asset-manifest.schema.json` (duke ndjekur `$ref`, `anyOf`/`oneOf`, `items`). Dështon nëse:
   - një fushë nuk ka klasë;
   - një hyrje e `fields` nuk përputhet me asnjë fushë;
   - një fushë ka dy klasa.

   Një fushë e re në skemë pa klasifikim e prish testin automatikisht.

3. **Zbatimi (T8).** Çdo fushë `restricted` ose `refused` ka të paktën një rast negativ në D.1, me kodin dhe shtegun e saj.
4. **Renderer-i nuk lexon fusha jashtë `applied`/`restricted` (T9).** Testi i kufirit (K6) zgjerohet: modulet e renderer-it nuk lexojnë asnjë fushë të klasifikuar `refused`, `validated` ose `metadata`, përveç atyre që lexon Gate-i. Kontrolli bëhet me emrat e fushave në burimin e `film/src/package/`. Kjo provon, p.sh., që `bounds` nuk ndikon në vizatim.
5. **Gjendja e klasifikimit (2026-11-17):** 243/243 fusha kanë klasë. 236 janë mbyllur; 7 presin V1 dhe V2:
   - `mix` (3 fusha);
   - `bounds` (4 fusha).

   | Skema                  | applied | restricted | refused | validated | metadata | e hapur |
   | ---------------------- | ------- | ---------- | ------- | --------- | -------- | ------- |
   | `render-package` (180) | 40      | 33         | 86      | 12        | 2        | 7       |
   | `asset-manifest` (63)  | 18      | 6          | 3       | 22        | 14       | 0       |

   Lista e plotë, fushë për fushë, me semantikën ose rregullin: **Shtojca 1**.

## C. Ndikimi në kontrata dhe kompatibilitet

### C.1 Kontratat

| Kontrata                                                                                    | Ndikimi                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erkasa.render/1` (paketa)                                                                  | **Asnjë ndryshim.** `contracts:gen --check` pa diff. Ndryshon vetëm cilat vlera pranon ky Engine.                                                                                                                                                                                                                                            |
| `erkasa.assets/1` (manifesti)                                                               | **Asnjë ndryshim.**                                                                                                                                                                                                                                                                                                                          |
| `RenderCapabilities` (`gate/src/capabilities.ts`, publikuar nga `film/src/capabilities.ts`) | **Ndryshim i madh: `/1 → /2`.** `projections` dhe `transitions` ndryshojnë formë; shtohen `output`, `events`, `contacts`, `assets`, `captions`, `fields`, `builtins[].placement`, `rig.rest`, `font`. Kontrata përdoret vetëm nga Gate-i, renderer-i dhe testet (u kontrollua me grep). Një dokument v1 refuzohet me `CAPABILITIES_INVALID`. |
| Kodet e Gate-it                                                                             | +3 (`VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`); asnjë kod ekzistues nuk ndryshon kuptim.                                                                                                                                                                                                                                          |
| Gjurmët e builtin-eve                                                                       | **Pa ndryshim.** Asnjë skedar vizatimi nuk preket; `capabilities.ts` nuk është skedar implementues i asnjë builtin-i.                                                                                                                                                                                                                        |
| Renderer-i                                                                                  | **Pa ndryshim.** Ndryshon vetëm Gate-i që ai thërret, dhe deklarata që i jep atij.                                                                                                                                                                                                                                                           |
| Golden-at, baseline-t, contact sheet-i                                                      | **Pa ndryshim.** `--write` refuzon tashmë.                                                                                                                                                                                                                                                                                                   |
| Fixtures A të kontratës                                                                     | Listat e pritura të refuzimeve në `gate/test/films.test.ts` mund të fitojnë gjetje të reja (si me `EASE_UNDEFINED`). Çdo shtesë raportohet. Fixtures A nuk renderohen, ndaj nuk ka efekt vizual.                                                                                                                                             |

### C.2 Kompatibiliteti (pikat 6–7)

Çdo rregull i ri **vetëm refuzon**. Renderer-i, gjurmët dhe të dhënat nuk ndryshojnë, kështu që për çdo paketë që mbetet e pranuar kuadrot janë bit për bit të njëjtë. Rreziku i vetëm është një refuzim i rremë i një pakete ekzistuese. Matjet më poshtë tregojnë që nuk ndodh, dhe testi T2 e provon.

### C.3 Matjet e tetë paketave (2026-11-17)

| Paketa        | Projeksioni | Tranzicionet  | Builtin-et (bota / ekrani)                                                                | Audio | Event-et (fx/duration) | `state` / contacts | Aktorët (rim/shadow) | Captions (`at`, `align`, `maxWidth`) | Kamera (aperture; refDist/dolly) | Blur / `lit`              | Vendosje builtin                    | Dalja        |
| ------------- | ----------- | ------------- | ----------------------------------------------------------------------------------------- | ----- | ---------------------- | ------------------ | -------------------- | ------------------------------------ | -------------------------------- | ------------------------- | ----------------------------------- | ------------ |
| B1–B5         | flat        | cut           | `set.*`, `prop.*`, `template.*` / `type.kinetic`, `overlay.scrim` (B2 edhe `overlay.ots`) | 0     | none/0                 | 0 / 0              | false/false          | —                                    | 0; 1920/0                        | 0 / false                 | identitet (`x`, `y` vetëm te props) | 1080×1920@30 |
| W0            | parallax    | cut, dissolve | `w0.*`, `prop.*` / `type.w0`                                                              | 0     | none/0                 | 0 / 0              | true/true            | `{x,y}`, center, —                   | 0; 2140/0,55                     | sipas rolit / sipas rolit | identitet                           | 1080×1920@30 |
| prisoner-cell | flat        | —             | skedarë                                                                                   | 0     | none/0                 | 0 / 0              | false/false          | `{x,y}`, center, —                   | 0; 1920/0                        | 0 / false                 | —                                   | 1080×1920@30 |
| office-clock  | flat        | whip          | `set.*`, `template.*` / `type.kinetic`                                                    | 0     | —                      | 0 / 0              | false/false          | —                                    | 0; 1920/0                        | 0 / false                 | identitet                           | 1080×1920@30 |

Asnjë nga tetë paketat nuk prek asnjë rregull të ri, me një përjashtim: rregulli i `bounds` sipas V2 (a), që kërkon `bounds` të rishkruara te shtatë paketa (vetëm të dhëna, pa ndryshim kuadrosh). Rrezik të ulët, jo zero, kanë vetëm rregullat që mbështeten në vlera që Stager-i i shkruan sot të barabarta (Y2, Y3, Y7). T2 i provon ato në kod.

---

## D. Matrica e testeve

### D.1 Negative (K5): refuzim para renderimit

Çdo rast:

- refuzohet me listën e saktë të gjetjeve (kod dhe shteg), dhe asgjë tjetër;
- `renderPackage` kthen të njëjtat gjetje si `validate()` (gabime dhe paralajmërime), **0 kuadro**, dhe `begin`, `frame`, `end` të sink-ut nuk thirren, pra encoder-i nuk niset.

Rastet shtohen te `gate/test/broken.ts`, kështu që i përdorin edhe testi negativ i Gate-it, edhe K5.

| Grupi                  | Raste                                                                                                                       | Burimi                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Ekzistuesit            | 50 (48 të E1.3, `EASE_UNDEFINED`, `SVG_UNSAFE`)                                                                             | `broken.ts`               |
| Auditimi               | 16: N1, N2a, N3a, N4, N5a, N6, N7, N8, N9, N10–N13, N14, N15, N16 (R1–R16, siç janë në `gate-audit.ts`)                     | skripti bëhet raste testi |
| Një defekt për rregull | N2b, N3b, N5b, N7b; X1 (paketa), X1b (aset audio në manifest), X2–X10; Y1–Y7: secili me një defekt mbi bazën e B3 ose të W0 | të reja                   |
| **Gjithsej**           | **50 + 16 + 4 + 11 + 7 = 88**                                                                                               |                           |

### D.2 Pozitive

| #   | Testi                                                                                                                                                                                                                                                                                                                                                                        | Kalon kur                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Gate-i v2 mbi tetë paketat (B1–B5 të gjeneruara nga Stager-i, W0, prisoner-cell, office-clock)                                                                                                                                                                                                                                                                               | `ok`, 0 gabime, 0 paralajmërime të reja                                                                                           |
| P2  | Paketa kufitare të lejuara: `cut` midis flat dhe parallax; parallax pa `w0.near`; props me track `x`/`y`; aktor pa track-e (vlen `rig.rest`)                                                                                                                                                                                                                                 | `ok`, dhe renderohen pa gabim                                                                                                     |
| P3  | **Ekzekutueshmëria (T4):** çdo paketë që Gate-i pranon në P1, P2 dhe në matricën e testeve renderohet në çdo kuadër pa gabim; për parallax, kuadri i parë i çdo prerjeje dhe çdo kuadër tranzicioni                                                                                                                                                                          | 0 gabime                                                                                                                          |
| P4  | **Identiteti vizual:** K1 (6 043 kuadro), K2/K3 (`golden:package`), K4 (i–ii), K7                                                                                                                                                                                                                                                                                            | rezultatet e sotme: 0 dështime; 931/931 hash identikë me `golden-package.json` dhe `golden-fixtures-b.json`; asgjë nuk rishkruhet |
| P5  | **Kontrata e aftësive (T5):** v2 deterministe dhe e vlefshme; dokumentet v1 dhe ato të prishura refuzohen me `CAPABILITIES_INVALID`; vlerat provohen kundrejt kodit: `rig.rest` = `STANDING`; `referenceDistance`/`dolly` = konstantet e `w0/camera.ts`; `captions.semantics` = konstantet e `package/draw.ts` dhe `w0/compositor.ts`; `output.sizes` = `W`×`H` i `style.ts` | të gjitha                                                                                                                         |
| P6  | **Plotësia e matricës (T7):** çdo fushë fundore e dy skemave ka klasë në `capabilities.fields`                                                                                                                                                                                                                                                                               | 243/243                                                                                                                           |
| P7  | **Zbatimi i matricës (T8):** çdo fushë `restricted`/`refused` ka të paktën një rast negativ në D.1                                                                                                                                                                                                                                                                           | 100%                                                                                                                              |

---

## E. Kriteret e pranimit

| Kriteri           | Kalon kur                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **K5 (i ri)**     | 88/88 paketa të refuzuara (50 ekzistuese + 16 të auditimit + 22 me një defekt). Për secilën: kodi dhe shtegu i saktë (lista e plotë, barazi e saktë); gjetjet e `renderPackage` = `validate()`; **0 kuadro**; sink-u dhe encoder-i nuk nisen. Asnjë nga 11 rastet e auditimit që pranohen sot nuk pranohet më. |
| **K5-inv (i ri)** | Gate PASS ⟹ renderim pa gabim (P3), dhe matrica e fushave është e plotë dhe e zbatuar (P6, P7).                                                                                                                                                                                                                |
| K1–K4, K7         | Të pandryshuara, rishtuara (P4): 6 043/6 043; 451/451; 136/136; 390/390; 931/931.                                                                                                                                                                                                                              |
| K6                | I pandryshuar: grafi i renderer-it dhe testi i mosrihapjes kalojnë.                                                                                                                                                                                                                                            |
| K8                | I pandryshuar; plus P5.                                                                                                                                                                                                                                                                                        |
| K9                | Të gjitha testet, typecheck, lint, format; `contracts:gen --check` pa diff; gjurmët e builtin-eve të pandryshuara; `golden.json`, `golden-evidence.json`, `golden-package.json`, `golden-fixtures-b.json` me 0 bajt ndryshim.                                                                                  |
| Kompatibiliteti   | P1: tetë paketat pranohen.                                                                                                                                                                                                                                                                                     |

---

## F. Vendimet: të mbyllura dhe të hapura

### Të mbyllura nga PO-ja (2026-11-17)

| #   | Vendimi                                                                          |
| --- | -------------------------------------------------------------------------------- |
| F1  | `RenderCapabilities` v2 me kombinime (§B.1)                                      |
| F2  | `VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`                             |
| F3  | Matrica e fushave me testin automatik të plotësisë (§B.4)                        |
| F4  | Gjetjet X1–X9 brenda scope-it (X10 i shtuar sipas kushtit D, i njëjti mekanizëm) |
| F6  | Dalja 1080×1920, 30 FPS, pa audio                                                |
| F7  | Kanalet e rig-ut pa track → pozë pushimi e publikuar (`rig.rest`)                |
| F9  | Korrigjimi 11/16 dhe 5/16 (i bërë te raporti)                                    |

### Të hapura: duhen vendimet e tua para implementimit

**V1. `mix` (kushti A kundrejt kushtit E).**

- Skema e kërkon `mix` në çdo paketë, dhe të tetë paketat e kanë (`duckMusicDb` 0; `integratedLufs` −14 ose −16; `truePeakDb` −1,5).
- Renderer-i nuk bën asnjë miksim.
- Nëse `mix` refuzohet kur nuk mbështetet, refuzohet çdo paketë, edhe të tetat (kundër E).

| Opsioni                                                                                                                                                                                                                                                                                          | Pasoja                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **(a) Rekomanduar:** `mix` pranohet vetëm kur `audio` është bosh, me semantikë të përcaktuar: "rregulli i miksimit mbi klipet e `audio`; mbi zero klipe rezultati është heshtja". Synimi i zhurmës (`loudness`) nuk ka objekt mbi heshtjen. Gate-i e garanton duke refuzuar çdo klip audio (X1). | `restricted`; 0 ndryshime për tetë paketat; fusha nuk injorohet, se nuk ka mbi çfarë të veprojë |
| (b) Kontrata e bën `mix` opsional ose të ndaluar pa audio                                                                                                                                                                                                                                        | ndryshim skeme: nuk lejohet në E1.4; paketat duhen rigjeneruar                                  |
| (c) Refuzim i plotë                                                                                                                                                                                                                                                                              | refuzon tetë paketat; shkel E                                                                   |

**V2. `bounds` (kushti B).** Matjet (2026-11-17):

- Pamja e kamerës në flat: (x ± h·W/H/2, y ± h/2).
- Pamja e kamerës në parallax: në planin e aktorëve (thellësia 0), sipas `w0/camera.ts`.

| Paketa        | Kuadro | Jashtë `bounds` | Më e madhja (njësi bote) |
| ------------- | ------ | --------------- | ------------------------ |
| B1            | 1 686  | 23              | 5,3                      |
| B2            | 1 408  | 17              | 1,7                      |
| B3            | 1 156  | 32              | 1,7                      |
| B4            | 1 136  | 40              | 1,7                      |
| B5            | 1 347  | 34              | 1,7                      |
| W0            | 1 546  | 234             | 250                      |
| prisoner-cell | 240    | 240             | 50                       |
| office-clock  | 165    | 0               | 0                        |

- Renderer-i nuk e lexon `bounds` (T9 do ta provojë), pra fusha nuk ndikon në kuadro.
- Por paketat bien ndesh me tekstin e kontratës ("the camera is kept inside it"). Kushti B nuk plotësohet.

| Opsioni                                                                                                                                                                                                                                                                                                      | Pasoja                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Rekomanduar:** `bounds` → `validated`. Gate-i kontrollon që pamja e kamerës është brenda `bounds` në çdo kuadër, me kodin ekzistues `VALUE_RANGE` te `package:/scenes/i/tracks/t` (track-u i kamerës, kuadri në mesazh). Stager-i dhe gjeneratori i fixtures B shkruajnë `bounds` që përmbajnë pamjen. | Ndryshojnë të dhëna, jo kuadro: `bounds` te B1–B5, W0 dhe prisoner-cell (teksti i paketës). Hash-et e kuadrove (golden, `golden-fixtures-b.json`) mbeten të njëjta, sepse renderer-i nuk e lexon `bounds`; P4 e provon. Kërkon dy leje: ndryshim i kufizuar i Stager-it, dhe rigjenerim i teksteve të fixtures B. Duhet edhe përkufizimi i "pamjes" në parallax: plani i aktorëve (propozim). |
| (b) Ndryshim i tekstit të kontratës: `bounds` = shtrirje këshilluese e prodhuesit                                                                                                                                                                                                                            | ndryshim kontrate: nuk lejohet në E1.4                                                                                                                                                                                                                                                                                                                                                        |
| (c) Gate-i zbaton rregullin pa ndryshuar të dhënat                                                                                                                                                                                                                                                           | refuzon 7 nga 8 paketat; shkel E                                                                                                                                                                                                                                                                                                                                                              |

**V3. Konfirmim:** përfshirja e X10 (lartësia e rig-ut), gjetur gjatë klasifikimit sipas kushtit D. Rrezik zero: Stager-i dhe fixtures B shkruajnë lartësinë që mat `drawPerson`.

### Vendimet e PO-së për V1–V3 (2026-11-17)

- **V1 (a), miratuar.** `mix` pranohet vetëm kur `audio` është bosh; çdo klip audio refuzohet. Skema mbetet e njëjtë.
- **V2 (a), miratuar me kushte.** Gate-i kontrollon `bounds`; Stager-i shkruan `bounds` të sakta; fixtures B rigjenerohen pa ndryshuar kuadrot. Kushtet dokumentohen më poshtë, para implementimit.
- **V3, miratuar.** Lartësia e rig-ut hyn në capabilities v2 (`rig.height`). Gate-i e krahason me vlerën e builtin-it.

### V2: përkufizimi i `bounds` dhe prova (para implementimit)

**1. Formula (njësi bote; W = 1080, H = 1920 nga `output.sizes`).** Në çdo çast t, kamera (x, y, h) të skenës sheh drejtkëndëshin:

```
halfW = h · W / H / 2        halfH = h / 2
view(t) = [x − halfW, x + halfW] × [y − halfH, y + halfH]
```

Kushti: `bounds.x ≤ x − halfW`, `x + halfW ≤ bounds.x + bounds.w`, `bounds.y ≤ y − halfH`, `y + halfH ≤ bounds.y + bounds.h`. Krahasimi bëhet me numra float64 si janë, pa tolerancë dhe pa rrumbullakim.

- **flat, kamera e set-it:** `setView` vizaton `translate(W/2 H/2) scale(H/h) translate(−x −y)`. Pikat e botës që bien në kuadrin [0, W] × [0, H] janë pikërisht view(t). Formula është ekzakte.
- **flat, kamera editoriale** (skenat me `template.*`): `editorialView(z, dy)` me z = H/h dhe dy = (960 − y)·z. Kjo përkthehet në të njëjtin drejtkëndësh në y, por në x qendra është gjithmonë W/2 = 540, sepse renderer-i nuk e lexon `x`. Të pesë filmat kanë x = 540 në çdo skenë editoriale, kështu që formula vlen.
  - **Gjetje e re, X11:** te skenat editoriale renderer-i injoron `camera.x`. Sipas kushtit D, Gate-i kërkon x = W/2 në to: `VALUE_UNSUPPORTED` · `package:/scenes/i/tracks/t/…`. Asnjë nga tetë paketat nuk preket.
- **parallax, plani i aktorëve:** sipas kërkesës së PO-së, pamja matet aty ku vizatohen aktorët dhe mobiljet, `project(cam, depth.mid)` me `depth.mid` = 0. Për dz = 0, `project` jep matematikisht s = H/h, cx = x, cy = y, pra pikërisht formulën e mësipërme.
  - Matur mbi të gjitha 1 373 sample-t e kamerës së W0: 1 312 janë bit për bit të njëjta me formulën.
  - Te 61 të tjerat, aritmetika float e `project` (përmes konstanteve REF dhe GAMMA) ndryshon nga formula me më pak se 1,2·10⁻¹³ njësi bote. Një piksel është rreth 1 njësi bote.
  - Gate-i dhe Stager-i përdorin të dyja formulën e kontratës, një funksion i vetëm i pastër pranë evaluatorit (`cameraViews` te `@erkasa/contracts`), pa tolerancë. Ndryshimi float i Engine-it dokumentohet këtu dhe nuk fshihet nga asnjë rrumbullakim.

**2. Të gjitha çastet, jo vetëm kuadrot.** Gate-i e kontrollon kushtin në çdo çast ku kamera mund të jetë, jo vetëm në kuadrot e renderuara:

- **Pikat e thyerjes:**
  - për çdo track `samples` të `x`, `y`, `height`: çdo kufi sample-i (`start + i/rate`, me të njëjtën zhvendosje 1e-6 si `sampleIndex`);
  - për çdo track `keys`: çdo kohë çelësi.
- **Brenda dy pikave të njëpasnjëshme:**
  - një track `samples` është konstant (një sample);
  - një track `keys` është linear (`linear`) ose konstant (`hold`); ease-t e tjera i refuzon `EASE_UNDEFINED`.

  Kështu çdo skaj i view(t) është funksion afin i t në interval, dhe ekstremet janë te skajet e intervalit.

- **Kontrolli:** kushti kontrollohet në të dy skajet e çdo intervali, me limitet e vetë intervalit (vlera e sample-it, vlerat lineare te skajet), si dhe në zonat e kapura para çelësit të parë dhe pas të fundit.
- **Overshoot-i i easing-ut:** është brenda vlerave të ruajtura (p.sh. lëkundja e derës, ease-t e kamerës të pjekura nga Stager-i në sample). Duke kontrolluar çdo sample, kontrollohet edhe ai.

**3. Kodi dhe shtegu.** `VALUE_RANGE` (ekzistues) · `package:/scenes/i/bounds`; mesazhi jep anën, kohën t dhe tejkalimin. Shtegu tregon `bounds`, sepse është fusha që bie ndesh me kamerën; track-u përmendet në mesazh.

**4. Stager-i dhe fixtures B.** Pasi kamera të jetë përcaktuar, Stager-i e zgjeron `bounds` ekzistuese aq sa duhet për të përmbajtur çdo view(t), duke përdorur të njëjtin funksion. Pas llogaritjes verifikon `x + w`, `y + h` me të njëjtin krahasim si Gate-i, dhe kur aritmetika float e cenon kufirin, rrit `w`/`h` me ulp-in e radhës. Kjo zgjerim i kufirit, jo rrumbullakim që fsheh shkelje.

- Kamera dhe çdo gjë tjetër mbeten të njëjta, kështu që kuadrot nuk ndryshojnë (renderer-i nuk e lexon `bounds`, provohet nga T9). P4 e provon me hash.
- Gjeneratori i fixtures B bën të njëjtën gjë; tekstet e paketave të prisoner-cell dhe office-clock rigjenerohen, `golden-fixtures-b.json` mbetet i pandryshuar.

**5. Testet kufitare (për secilin rast).**

- **flat set:** pamja që prek saktësisht çdo nga katër anët → pranohet; e njëjta e zhvendosur me ulp-in e radhës jashtë → `VALUE_RANGE`.
- **flat editorial:** e njëjta, plus x ≠ 540 → `VALUE_UNSUPPORTED` (X11).
- **parallax:** e njëjta mbi një skenë W0.
- **samples:** një sample i vetëm jashtë, në mes të track-ut, dhe një sample pas kuadrit të fundit të renderuar → refuzohen; overshoot i kamerës në një sample → refuzohet.
- **keys:** dy çelësa `linear` me skajet brenda → pranohet; `hold` që mban jashtë → refuzohet; pika e kapur pas çelësit të fundit jashtë → refuzohet.
- **tracks të përziera:** `x` me samples dhe `height` me keys, ku shkelja ndodh vetëm brenda një intervali → refuzohet.
- **pozitive:** tetë paketat me `bounds` të rishkruara → pranohen; kuadrot janë identikë (P4).

**Rendi i punës pas miratimit (dhe pas V1–V3)** (commit-e të vogla, me ndalesë dhe raport për çdo devijim):

1. Kontrata v2 + P5.
2. Deklarata në `film/src/capabilities.ts` + matrica + P6.
3. G-P, G-T.
4. G-K, G-A.
5. G-C, G-B, G-E.
6. Rastet negative D.1 + K5 + P7.
7. P1–P4.
8. Raporti.

Pres miratimin tënd. Deri atëherë nuk implementoj asgjë.

---

## Shtojca 1. Klasifikimi i plotë i fushave (243)

Gjeneruar nga skemat JSON të commit-it aktual; "OPEN" = pret V1 ose V2.

#### `package` (180 fusha)

| Fusha                                           | Klasa      | Semantika / rregulli                                                                                                                       |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/assetManifest/sha256`                         | validated  | manifesti i fiksuar (`MANIFEST_HASH`)                                                                                                      |
| `/assetManifest/uri`                            | validated  | manifesti i fiksuar (`MANIFEST_HASH`)                                                                                                      |
| `/audio/*/asset`                                | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/duration`                             | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/fadeIn`                               | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/fadeOut`                              | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/gainDb`                               | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/id`                                   | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/pan`                                  | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/role`                                 | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/start`                                | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/audio/*/trim`                                 | refused    | `audio` bosh (`output.audio` = false) → `CAPABILITY_MISSING` `/audio/i`                                                                    |
| `/edit/*/end`                                   | applied    | renditja dhe kohët e skenave; `enter.duration` = gjatësia e tranzicionit                                                                   |
| `/edit/*/enter/duration`                        | applied    | renditja dhe kohët e skenave; `enter.duration` = gjatësia e tranzicionit                                                                   |
| `/edit/*/enter/kind`                            | restricted | (kind, from, to) ∈ `transitions` → `CAPABILITY_MISSING`                                                                                    |
| `/edit/*/scene`                                 | applied    | renditja dhe kohët e skenave; `enter.duration` = gjatësia e tranzicionit                                                                   |
| `/edit/*/start`                                 | applied    | renditja dhe kohët e skenave; `enter.duration` = gjatësia e tranzicionit                                                                   |
| `/id`                                           | validated  | id i paketës                                                                                                                               |
| `/mix/duckMusicDb`                              | OPEN       | i detyrueshëm nga skema; shih §F (V1)                                                                                                      |
| `/mix/loudness/integratedLufs`                  | OPEN       | i detyrueshëm nga skema; shih §F (V1)                                                                                                      |
| `/mix/loudness/truePeakDb`                      | OPEN       | i detyrueshëm nga skema; shih §F (V1)                                                                                                      |
| `/output/duration`                              | applied    | numri i kuadrove = round(duration·fps)                                                                                                     |
| `/output/fps`                                   | restricted | ∈ `output.fps` = [30] → `VALUE_UNSUPPORTED`                                                                                                |
| `/output/height`                                | restricted | ∈ `output.sizes` = [[1080,1920]] → `VALUE_UNSUPPORTED`                                                                                     |
| `/output/width`                                 | restricted | ∈ `output.sizes` = [[1080,1920]] → `VALUE_UNSUPPORTED`                                                                                     |
| `/overlays/*/appear`                            | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/asset`                             | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/at/actor`                          | refused    | `captions.anchor` = [screen] → `CAPABILITY_MISSING` `/overlays/i/at`                                                                       |
| `/overlays/*/at/node`                           | refused    | `captions.anchor` = [screen] → `CAPABILITY_MISSING` `/overlays/i/at`                                                                       |
| `/overlays/*/at/offset`                         | refused    | `captions.anchor` = [screen] → `CAPABILITY_MISSING` `/overlays/i/at`                                                                       |
| `/overlays/*/at/x`                              | applied    | pozicioni në ekran: (x·W, y·H)                                                                                                             |
| `/overlays/*/at/y`                              | applied    | pozicioni në ekran: (x·W, y·H)                                                                                                             |
| `/overlays/*/highlight`                         | applied    | ngjyra e fjalës që flitet (mungon → `style.color`)                                                                                         |
| `/overlays/*/id`                                | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/in`                                | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/kind`                              | restricted | ∈ `overlayKinds` = [captions] (ekziston)                                                                                                   |
| `/overlays/*/lines/*/color`                     | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/lines/*/size`                      | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/lines/*/text`                      | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/out`                               | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/panel/color`                       | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/panel/padding`                     | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/panel/radius`                      | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/phrases/*/in`                      | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/phrases/*/out`                     | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/phrases/*/words/*/end`             | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/phrases/*/words/*/t`               | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/phrases/*/words/*/text`            | applied    | frazat dhe fjalët e captions (evaluatori)                                                                                                  |
| `/overlays/*/size`                              | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/state`                             | refused    | vetëm për overlay jo-captions, të refuzuara nga `overlayKinds`                                                                             |
| `/overlays/*/style/align`                       | restricted | ∈ `captions.align` = [center] → `VALUE_UNSUPPORTED`                                                                                        |
| `/overlays/*/style/color`                       | applied    | stili i captions                                                                                                                           |
| `/overlays/*/style/font`                        | restricted | aset font me burim builtin, family/weight = të builtin-it                                                                                  |
| `/overlays/*/style/maxWidth`                    | refused    | `captions.maxWidth` = false → `VALUE_UNSUPPORTED`                                                                                          |
| `/overlays/*/style/size`                        | applied    | stili i captions                                                                                                                           |
| `/overlays/*/style/stroke/color`                | applied    | stili i captions                                                                                                                           |
| `/overlays/*/style/stroke/width`                | applied    | stili i captions                                                                                                                           |
| `/producer/name`                                | metadata   | kush e prodhoi paketën; pa semantikë vizatimi                                                                                              |
| `/producer/version`                             | metadata   | kush e prodhoi paketën; pa semantikë vizatimi                                                                                              |
| `/scenes/*/actors/*/appearance`                 | applied    | rig-u builtin dhe pamja (`APPEARANCE_SLOTS`); burimi i rig-ut i kufizuar (G-A)                                                             |
| `/scenes/*/actors/*/id`                         | validated  | id i aktorit                                                                                                                               |
| `/scenes/*/actors/*/layer`                      | restricted | shtresë e vetën: vetëm ky aktor, asnjë nyje → `VALUE_UNSUPPORTED`                                                                          |
| `/scenes/*/actors/*/rig`                        | applied    | rig-u builtin dhe pamja (`APPEARANCE_SLOTS`); burimi i rig-ut i kufizuar (G-A)                                                             |
| `/scenes/*/actors/*/rim`                        | restricted | flat: false; parallax: true → `VALUE_UNSUPPORTED`                                                                                          |
| `/scenes/*/actors/*/shadow`                     | restricted | flat: false; parallax: true → `VALUE_UNSUPPORTED`                                                                                          |
| `/scenes/*/background`                          | applied    | ngjyra e sfondit                                                                                                                           |
| `/scenes/*/bounds/h`                            | OPEN       | kontrata: "kamera mbahet brenda"; shih §F (V2)                                                                                             |
| `/scenes/*/bounds/w`                            | OPEN       | kontrata: "kamera mbahet brenda"; shih §F (V2)                                                                                             |
| `/scenes/*/bounds/x`                            | OPEN       | kontrata: "kamera mbahet brenda"; shih §F (V2)                                                                                             |
| `/scenes/*/bounds/y`                            | OPEN       | kontrata: "kamera mbahet brenda"; shih §F (V2)                                                                                             |
| `/scenes/*/camera/aperture`                     | restricted | ∈ `camera.aperture` = [0] → `VALUE_UNSUPPORTED`                                                                                            |
| `/scenes/*/camera/dolly`                        | restricted | parallax ∈ [2140] / [0.55] → `VALUE_UNSUPPORTED`; flat: pa efekt sipas kontratës ("flat: every layer moves with the camera (no parallax)") |
| `/scenes/*/camera/projection`                   | restricted | ∈ `projections` (ekziston) + rregullat e projeksionit                                                                                      |
| `/scenes/*/camera/referenceDistance`            | restricted | parallax ∈ [2140] / [0.55] → `VALUE_UNSUPPORTED`; flat: pa efekt sipas kontratës ("flat: every layer moves with the camera (no parallax)") |
| `/scenes/*/contacts/*/actor`                    | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/contacts/*/from`                     | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/contacts/*/node`                     | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/contacts/*/offset`                   | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/contacts/*/socket`                   | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/contacts/*/to`                       | refused    | `contacts` bosh → `CAPABILITY_MISSING` `/scenes/i/contacts/k`                                                                              |
| `/scenes/*/events/*/duration`                   | restricted | 0 kur `fx` = none → `VALUE_UNSUPPORTED`                                                                                                    |
| `/scenes/*/events/*/fx`                         | restricted | ∈ `fx` = [none] (ekziston `FX_UNSUPPORTED`)                                                                                                |
| `/scenes/*/events/*/node`                       | applied    | dukshmëria e nyjes nga koha t                                                                                                              |
| `/scenes/*/events/*/state`                      | refused    | `events.state` = false → `CAPABILITY_MISSING` `/scenes/i/events/k/state`                                                                   |
| `/scenes/*/events/*/t`                          | applied    | dukshmëria e nyjes nga koha t                                                                                                              |
| `/scenes/*/events/*/visible`                    | applied    | dukshmëria e nyjes nga koha t                                                                                                              |
| `/scenes/*/id`                                  | validated  | id i skenës                                                                                                                                |
| `/scenes/*/layers/*/blur`                       | restricted | flat: 0; parallax: sipas rolit (`same-as`) → `VALUE_UNSUPPORTED`                                                                           |
| `/scenes/*/layers/*/depth`                      | applied    | parallax: thellësia e shtresës; flat: pa efekt sipas kontratës (pa paralaksë)                                                              |
| `/scenes/*/layers/*/id`                         | validated  | id i shtresës                                                                                                                              |
| `/scenes/*/layers/*/lit`                        | restricted | flat: false; parallax: sipas rolit → `VALUE_UNSUPPORTED`                                                                                   |
| `/scenes/*/layers/*/nodes/*/align`              | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/asset`              | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/layers/*/nodes/*/color`              | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/fill/from`          | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/fill/kind`          | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/fill/stops/*/at`    | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/fill/stops/*/color` | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/fill/to`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/flip`               | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/font`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/id`                 | validated  | id; `kind` ∈ `nodeKinds` = [asset] (ekziston)                                                                                              |
| `/scenes/*/layers/*/nodes/*/kind`               | validated  | id; `kind` ∈ `nodeKinds` = [asset] (ekziston)                                                                                              |
| `/scenes/*/layers/*/nodes/*/lineHeight`         | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/maxWidth`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/opacity`            | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/params`             | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/layers/*/nodes/*/pivot`              | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/rotation`           | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/scale`              | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/shape/d`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/h`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/radius`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/rx`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/ry`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/type`         | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/shape/w`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/size`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/state`              | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/layers/*/nodes/*/stroke/color`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/stroke/width`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/text`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/layers/*/nodes/*/x`                  | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/layers/*/nodes/*/y`                  | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/lights/*/castsShadows`               | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/color`                      | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/depth`                      | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/id`                         | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/intensity`                  | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/kind`                       | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/polygon`                    | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/radius`                     | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/softness`                   | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/x`                          | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/lights/*/y`                          | refused    | `lightKinds` = [] (ekziston)                                                                                                               |
| `/scenes/*/screen/*/id`                         | validated  | id i shtresës së ekranit                                                                                                                   |
| `/scenes/*/screen/*/nodes/*/align`              | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/asset`              | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/screen/*/nodes/*/color`              | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/fill/from`          | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/fill/kind`          | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/fill/stops/*/at`    | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/fill/stops/*/color` | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/fill/to`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/flip`               | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/font`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/id`                 | validated  | id; `kind` ∈ `nodeKinds` = [asset] (ekziston)                                                                                              |
| `/scenes/*/screen/*/nodes/*/kind`               | validated  | id; `kind` ∈ `nodeKinds` = [asset] (ekziston)                                                                                              |
| `/scenes/*/screen/*/nodes/*/lineHeight`         | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/maxWidth`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/opacity`            | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/params`             | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/screen/*/nodes/*/pivot`              | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/rotation`           | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/scale`              | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/shape/d`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/h`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/radius`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/rx`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/ry`           | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/type`         | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/shape/w`            | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/size`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/state`              | applied    | vizatimi (builtin ose skedar), gjendja, parametrat (`PARAM_*` ekzistojnë) + G-P, G-K                                                       |
| `/scenes/*/screen/*/nodes/*/stroke/color`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/stroke/width`       | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/text`               | refused    | vetëm për nyjet text/shape, të refuzuara nga `nodeKinds`                                                                                   |
| `/scenes/*/screen/*/nodes/*/x`                  | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/screen/*/nodes/*/y`                  | restricted | skedar: zbatohet; builtin: vetëm fushat në `placement`, të tjerat identitet dhe pa track → `VALUE_UNSUPPORTED`                             |
| `/scenes/*/tracks/*/channel`                    | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/keys/*/ease`                | restricted | ∈ linear, hold (ekziston `EASE_UNDEFINED`)                                                                                                 |
| `/scenes/*/tracks/*/keys/*/t`                   | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/keys/*/v`                   | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/kind`                       | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/rate`                       | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/start`                      | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/target/id`                  | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/target/kind`                | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/scenes/*/tracks/*/values`                     | applied    | vlerat e kanaleve (evaluatori); kanalet e detyrueshme (`TRACK_MISSING`)                                                                    |
| `/schema`                                       | validated  | `erkasa.render/1` (`UNKNOWN_VERSION`)                                                                                                      |

#### `manifest` (63 fusha)

| Fusha                                   | Klasa      | Semantika / rregulli                                                                                |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `/assets/*/affordances/*/closed`        | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/from`          | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/kind`          | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/open`          | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/point`         | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/state`         | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/affordances/*/to`            | metadata   | për Stager-in (ku kapet, ulet, hapet); Engine-i nuk e lexon                                         |
| `/assets/*/approval/at`                 | validated  | `NOT_APPROVED` (ekziston)                                                                           |
| `/assets/*/approval/by`                 | validated  | `NOT_APPROVED` (ekziston)                                                                           |
| `/assets/*/approval/note`               | validated  | `NOT_APPROVED` (ekziston)                                                                           |
| `/assets/*/approval/status`             | validated  | `NOT_APPROVED` (ekziston)                                                                           |
| `/assets/*/bones/*/id`                  | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/bones/*/parent`              | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/bones/*/range`               | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/channels/*/id`               | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/channels/*/range`            | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/defaultState`                | metadata   | kontrata: "Nodes always name one", pra nuk zbatohet kurrë në vizatim                                |
| `/assets/*/durationSec`                 | refused    | vetëm për asete audio, të refuzuara nga `kind`                                                      |
| `/assets/*/family`                      | restricted | = family/weight e builtin-it të fontit → `VALUE_UNSUPPORTED`                                        |
| `/assets/*/format`                      | restricted | ∈ `rigFormats` (ekziston)                                                                           |
| `/assets/*/geometry/origin`             | applied    | vendosja e skedarit: origin, size, viewBox                                                          |
| `/assets/*/geometry/size/h`             | applied    | vendosja e skedarit: origin, size, viewBox                                                          |
| `/assets/*/geometry/size/w`             | applied    | vendosja e skedarit: origin, size, viewBox                                                          |
| `/assets/*/geometry/viewBox`            | applied    | vendosja e skedarit: origin, size, viewBox                                                          |
| `/assets/*/height`                      | restricted | = lartësia e rig-ut builtin (`rig.height`, 780.768…) → `VALUE_UNSUPPORTED`                          |
| `/assets/*/id`                          | validated  | referenca `id@version`                                                                              |
| `/assets/*/kind`                        | restricted | vector, rig, font; audio refuzohet (`output.audio` = false) → `CAPABILITY_MISSING` `/assets/i/kind` |
| `/assets/*/license`                     | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/parameters/*/id`             | validated  | parametrat e builtin-it kundrejt capabilities (`BUILTIN_MISMATCH`)                                  |
| `/assets/*/parameters/*/kind`           | validated  | parametrat e builtin-it kundrejt capabilities (`BUILTIN_MISMATCH`)                                  |
| `/assets/*/parameters/*/range`          | validated  | parametrat e builtin-it kundrejt capabilities (`BUILTIN_MISMATCH`)                                  |
| `/assets/*/pivots/*/at`                 | applied    | pivot-i i skedarit (`PIVOT_UNDECLARED`)                                                             |
| `/assets/*/pivots/*/id`                 | applied    | pivot-i i skedarit (`PIVOT_UNDECLARED`)                                                             |
| `/assets/*/provenance/by`               | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/provenance/costUsd`          | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/provenance/origin`           | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/provenance/promptSha256`     | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/sampleRate`                  | refused    | vetëm për asete audio, të refuzuara nga `kind`                                                      |
| `/assets/*/slots`                       | validated  | slot-et e pamjes (`APPEARANCE_SLOTS`)                                                               |
| `/assets/*/sockets/*/bone`              | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/sockets/*/id`                | validated  | emrat e kockave/kanaleve/socket-ave kundrejt rig-ut builtin (`RIG_UNSUPPORTED`, `CHANNEL_INVALID`)  |
| `/assets/*/source/fingerprint`          | applied    | builtin-i i fiksuar (`BUILTIN_*`)                                                                   |
| `/assets/*/source/kind`                 | restricted | rig dhe font: vetëm builtin (`RIG_UNSUPPORTED`, `CAPABILITY_MISSING`)                               |
| `/assets/*/source/name`                 | applied    | builtin-i i fiksuar (`BUILTIN_*`)                                                                   |
| `/assets/*/source/sha256`               | applied    | bajtet e verifikuara të skedarit (`FILE_HASH`, `SVG_UNSAFE`)                                        |
| `/assets/*/source/uri`                  | applied    | bajtet e verifikuara të skedarit (`FILE_HASH`, `SVG_UNSAFE`)                                        |
| `/assets/*/source/version`              | applied    | builtin-i i fiksuar (`BUILTIN_*`)                                                                   |
| `/assets/*/states/*/element`            | refused    | `assets.stateSources` = [source] → `CAPABILITY_MISSING`                                             |
| `/assets/*/states/*/name`               | applied    | gjendja që emërton nyja                                                                             |
| `/assets/*/states/*/source/fingerprint` | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/states/*/source/kind`        | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/states/*/source/name`        | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/states/*/source/sha256`      | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/states/*/source/uri`         | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/states/*/source/version`     | applied    | burimi i gjendjes (si `source`)                                                                     |
| `/assets/*/style/gate/passed`           | validated  | rezultati i style gate (ekziston)                                                                   |
| `/assets/*/style/gate/reportId`         | validated  | rezultati i style gate (ekziston)                                                                   |
| `/assets/*/style/gate/score`            | validated  | rezultati i style gate (ekziston)                                                                   |
| `/assets/*/style/kit`                   | metadata   | prejardhja dhe licenca; pa semantikë vizatimi                                                       |
| `/assets/*/version`                     | validated  | referenca `id@version`                                                                              |
| `/assets/*/weight`                      | restricted | = family/weight e builtin-it të fontit → `VALUE_UNSUPPORTED`                                        |
| `/id`                                   | validated  | id i manifestit                                                                                     |
| `/schema`                               | validated  | `erkasa.assets/1`                                                                                   |
