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
backend/        Spring Boot 4.1, Java 21: projektet, orkestrimi, workers AI
assets/         Biblioteka e aseteve: 402 asete me metadata (shih assets/README.md)
tools/          Gjeneratorët, importi dhe validatori i aseteve (Python)
infra/          docker-compose: Postgres, RabbitMQ, SeaweedFS
docs/           Arkitektura dhe ADR-të
```

Vjen në fazat e ardhshme: `studio/` (UI, Faza G). Nuk krijohen dosje bosh para kohe.

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
```

Panelet lokale: RabbitMQ te http://localhost:15672 (erkasa / erkasa_local), SeaweedFS te http://localhost:9333.

## Komandat

| Komanda                         | Çfarë bën                                                          |
| ------------------------------- | ------------------------------------------------------------------ |
| `pnpm check`                    | lint + typecheck + teste + validimi i aseteve                      |
| `pnpm test`                     | testet e kontratave (fixtures + të 402 asetet)                     |
| `pnpm contracts:gen`            | rigjeneron `contracts/json-schema/` pas çdo ndryshimi te kontratat |
| `pnpm assets:validate`          | validon asetet dhe rigjeneron `assets/manifest.json`               |
| `./mvnw verify` (te `backend/`) | testet Java: fixtures e njëjta + nisja e aplikacionit me Flyway    |

## Rregullat e punës

- Ndryshim te një kontratë → `pnpm contracts:gen` → commit bashkë me skemat e gjeneruara. CI e kontrollon.
- Çelësat API vetëm te `.env` (git-ignored). Kurrë në kod ose në git.
- Asnjë funksionalitet nuk deklarohet i përfunduar me të dhëna fallco. Ajo që nuk është implementuar shënohet qartë.
- Një milestone = një degë (`m1-engine-core`) → PR → merge te `main` kur CI është jeshile.
