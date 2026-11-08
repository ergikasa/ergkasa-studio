# Arkitektura (përmbledhje)

Dokumenti i plotë, me diagramet, DSL-në, databazën dhe planin e fazave:
https://claude.ai/artifact/9SJeXX5dGNu8DJdqxuekLN

## Me pak fjalë

```
Studio UI (React) ──REST/SSE──> Backend (Spring Boot, monolit modular)
                                  │  orkestrimi (DAG në Postgres, outbox)
                                  │  workers LLM: Director, Script, Storyboard, Visual Planner
                                  │  Voice (ElevenLabs), Audio, Asset Registry, Artifact Store
                                  │
                                RabbitMQ (TaskCommand / TaskResult, vetëm referenca)
                                  │
                               engine-worker (Node): kompilatori + render (Remotion + FFmpeg)

Postgres: metadata, DAG, versionet e artefakteve     SeaweedFS (S3): të gjitha skedarët
contracts/: skemat e përbashkëta që lidhin të gjitha pjesët
```

## Rrjedha e një videoje

prompt → Director → Script ⏸ → Storyboard → Visual Planner ⏸ → Asset Resolution
└─────→ Voice (për çdo skenë) → Subtitle
→ Audio Plan → Kompilatori (Scene Plan → Render Timeline) → Render (chunk-e) → Miksimi + concat → QC → MP4

⏸ = checkpoint opsional ku përdoruesi redakton.

## Dy nivelet e DSL-së

- **Scene Plan** (`contracts/src/scene-plan.ts`): qëllimi kreativ. Kohët janë semantike (`at: {word: "behavior"}`).
  E shkruan LLM-ja ose përdoruesi. Mund të referojë vetëm asete dhe veprime që ekzistojnë.
- **Render Timeline** (`contracts/src/timeline.ts`): gjithçka e zgjidhur në frame. E prodhon vetëm kompilatori.
