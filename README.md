# Erkasa Animation Studio

Studio për video 2D të animuara, ku animacioni prodhohet nga kodi. Jep një temë dhe sistemi shkruan skenarin,
e ndan në skena, zgjedh asetet nga biblioteka e vet, gjeneron zërin dhe titrat, animon dhe eksporton MP4.

**V1:** video në anglisht, format 9:16 (TikTok / Shorts / Reels). Pa SaaS: një studio lokale për një përdorues.

Arkitektura e plotë: [docs/architecture.md](docs/architecture.md) · Vendimet: [docs/adr/](docs/adr/)

## Struktura

```
contracts/      Burimi i së vërtetës: skemat Zod → JSON Schema (Java i lexon këto)
engine/         Motori 2D: renderFrame(n) → SVG; personazhe, kamerë, parallax, tekst, titra, grimca
compiler/       Scene Plan semantik (çfarë shkruan AI-ja) → Render Timeline frame pas frame, me validim
engine-worker/  Kthen një Render Timeline ose një Video Plan në MP4 (resvg + FFmpeg); demo te engine-worker/demo/
backend/        Spring Boot 4.1, Java 21: projektet, regjistri i aseteve (REST), orkestrimi
ai-worker/      AI: skenari dhe plani vizual (Claude), zëri me kohën e fjalëve (ElevenLabs), `pnpm video`
studio/         UI (Vite + React): Rig Lab, Biblioteka e aseteve, Plan Preview, me motorin e vërtetë në shfletues
assets/         Biblioteka e aseteve: 402 asete me metadata (shih assets/README.md)
tools/          Gjeneratorët, importi dhe validatori i aseteve (Python)
infra/          docker-compose: Postgres, RabbitMQ, SeaweedFS
docs/           Arkitektura dhe ADR-të
```

Te Studio, faqet që nuk janë ndërtuar ende (Projects, Script & Plan, Voice, Render queue) shfaqen si "soon" dhe nuk klikohen.

## Kërkesat

Node ≥ 22.12, pnpm 10, JDK 21 (`java -version`), Docker Desktop, Python 3.10+, FFmpeg (nga Faza B).
Maven nuk duhet instaluar: `backend/mvnw` (Windows: `backend\mvnw.cmd`) e shkarkon vetë herën e parë.

## Nisja

```bash
# 1. varësitë TypeScript
pnpm install

# 2. infrastruktura lokale
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps        # të tre duhet të jenë "healthy" ose "running"

# 3. kontrollet TypeScript + asetet
pnpm check

# 4. backend-i (kërkon Postgres-in nga hapi 2)
cd backend
./mvnw verify                                        # Windows: .\mvnw.cmd verify
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
# Windows: .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
# → http://localhost:8080/actuator/health  duhet të kthejë {"status":"UP",...}
# → http://localhost:8080/api/assets/stats   numri i aseteve sipas kategorisë

# 5. Studio (në terminal tjetër, nga rrënja e repos)
pnpm studio
# → http://127.0.0.1:5173
```

### Studio: video nga UI (Faza F)

Katër terminale, nga rrënja e repos:

```bash
docker compose -f infra/docker-compose.yml up -d           # 1. Postgres + RabbitMQ
cd backend; ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
                                                           # 2. backend (Windows: .\mvnw.cmd ... "-Dspring-boot.run.profiles=local")
pnpm worker                                                # 3. worker-i: merr hapat nga RabbitMQ
pnpm studio                                                # 4. http://127.0.0.1:5173
```

Te **New video** zgjidh temën, kategorinë, narratorin dhe gjatësinë. Te **Runs** ndjek çdo hap live
(skenari, zëri, plani, render-i), shikon koston, videon, skedarët, dhe bën **Resume** pas një gabimi.
Skedarët e çdo run-i: `out/runs/<runId>/`. "Silent test" e kalon gjithë rrjedhën pa ElevenLabs.

### Video nga një temë në terminal (Faza E)

Plotëso te `.env`: `ANTHROPIC_API_KEY` dhe `ELEVENLABS_API_KEY`. Zërat e narratorit janë te
`voices/catalog.json` (`mark_natural` = parazgjedhja, `friendly_woman`, `american_man`):

```bash
pnpm voices                                   # zërat e studios dhe a i përdor dot llogaria jote
pnpm voices --samples                         # nga një shembull për çdo zë → Studio > Voices i luan
pnpm video "why we procrastinate" --theme psychology --voice friendly_woman --seconds 45
```

Pa `--voice` përdoret `ERKASA_VOICE` nga `.env`, ose parazgjedhja e katalogut. Personazhi që flet zgjidhet
i së njëjtës gjini me narratorin. Zë i ri: `pnpm voices --account` tregon zërat e llogarisë; shtoje te
katalogu me një `id`, emër, përshkrim dhe cilësime.

Temat: `psychology`, `money`, `growth`, `philosophy`, `science`, `decisions`. Çdo run krijon një dosje te
`out/<data>-<tema>/` me `script.json`, `voice/`, `plan-attempts.json`, `video-plan.json`, `timeline.json`,
`video.mp4` dhe `run.json` (kohët, token-at, kosto e përafërt). Pa API-të:
`pnpm video --from-plan engine-worker/demo/habits.video-plan.json --no-voice`.

Rifillimi pas një ndryshimi me dorë: `pnpm video --from-plan out/<run>/video-plan.json` (pa Claude) ose
`--from-script out/<run>/script.json` (skenari i njëjtë, plan i ri). Komandat niseni nga rrënja e repos.

### API e aseteve

Në nisje backend-i lexon `assets/manifest.json` dhe çdo `asset.json`, i validon me kontratën `asset`
dhe i ruan te tabela `asset`. Asetet e pavlefshme refuzohen dhe shfaqen në log. Asetet që hiqen nga
manifesti çaktivizohen.

| Kërkesa                                                      | Çfarë kthen                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `GET /api/assets?category=&kind=&theme=&tag=&q=&limit=`      | lista me filtra (`total`, `items`)                            |
| `GET /api/assets/candidates?category=&theme=&tags=a,b&text=` | asetet e renditura për një vend në skenë, me pikët dhe arsyet |
| `GET /api/assets/{id}`                                       | `asset.json` i plotë                                          |
| `GET /api/assets/{id}/files/{file}`                          | një skedar i deklaruar i asetit (svg, rig), asgjë tjetër      |
| `GET /api/assets/stats`                                      | numri sipas kategorisë                                        |
| `POST /api/assets/reindex`                                   | rilexon bibliotekën nga disku                                 |

Panelet lokale: RabbitMQ te http://localhost:15672 (erkasa / erkasa_local), SeaweedFS te http://localhost:9333.

## Komandat

| Komanda                         | Çfarë bën                                                          |
| ------------------------------- | ------------------------------------------------------------------ |
| `pnpm check`                    | lint + typecheck + teste + validimi i aseteve                      |
| `pnpm test`                     | testet e kontratave (fixtures + të 402 asetet)                     |
| `pnpm contracts:gen`            | rigjeneron `contracts/json-schema/` pas çdo ndryshimi te kontratat |
| `pnpm assets:validate`          | validon asetet dhe rigjeneron `assets/manifest.json`               |
| `pnpm studio`                   | hap Studio-n te http://127.0.0.1:5173                              |
| `pnpm video "<temë>" --theme x` | temë → skenar → zë → plan → MP4 (kërkon çelësat te `.env`)         |
| `pnpm worker`                   | worker-i: ekzekuton hapat që nis Studio (kërkon RabbitMQ)          |
| `pnpm voices [--samples]`       | zërat e studios, kontrolli në llogari, shembujt audio              |
| `pnpm demo:plan`                | kompilon dhe eksporton planin demo në `engine-worker/out/`         |
| `./mvnw verify` (te `backend/`) | testet Java: kontratat, Flyway, indeksimi i 402 aseteve dhe API    |

## Rregullat e punës

- Ndryshim te një kontratë → `pnpm contracts:gen` → commit bashkë me skemat e gjeneruara. CI e kontrollon.
- Çelësat API vetëm te `.env` (git-ignored). Kurrë në kod ose në git.
- Asnjë funksionalitet nuk deklarohet i përfunduar me të dhëna fallco. Ajo që nuk është implementuar shënohet qartë.
- Një milestone = një degë (`m1-engine-core`) → PR → merge te `main` kur CI është jeshile.
