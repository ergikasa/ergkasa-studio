# E1.6 · Nënfaza 2: Attempt Isolation & Artifact Safety (raport)

| Fusha           | Vlera                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Statusi         | **E përfunduar.** CI e gjelbër: backend 132 teste, TypeScript me RabbitMQ real.                                                                                          |
| Run-i i gjelbër | [44386445593](https://github.com/ergikasa/ergkasa-studio/actions/runs/44386445593) në `2ab4364`. Shtesa e fundit e testit s6 verifikohet në run-in pasues; shih §Provat. |
| Rollback        | `ERKASA_ATTEMPT_ISOLATION=false` te backend-i                                                                                                                            |

## Si funksionon

1. **Fencing token (C2).**
   - Çdo dispatch merr një numër nga sekuenca Postgres `step_fence_seq` dhe e ruan te `step.fence`.
   - Numri nuk ripërdoret kurrë, as pas një _retry_ të run-it që e rikthen `attempt`-in në 1.
   - Komanda e çon fence-in te worker-i; rezultati dhe progresi e kthejnë mbrapsht.
2. **Vetëm fence-i aktual publikon.**
   - `applyResult` e merr rreshtin e hapit me `SELECT … FOR UPDATE`.
   - E pranon rezultatin vetëm nëse hapi është ende aktiv (`QUEUED`/`RUNNING`), `attempt` përputhet dhe `fence` përputhet.
   - Pas suksesit hapi bëhet `SUCCEEDED`, kështu fence-i konsumohet. Çdo rezultat tjetër injorohet dhe nuk prek asnjë skedar.
3. **Izolimi.**
   - Worker-i punon në `<run>/attempts/<step>-<fence>/`, me një kopje të skedarëve të publikuar si hyrje. Pa `attempts/`, pa dosjet e punës dhe pa symlink-e.
   - Raporton çdo skedar që krijoi ose ndryshoi, me `sha256`.
   - Nëse dosja e attempt-it ekziston tashmë (dyfishim), attempt-i refuzohet me `ATTEMPT_DIR_EXISTS` dhe është _retryable_.
4. **Publikimi atomik** (`ArtifactPublisher`).
   - Para se të lëvizë ndonjë skedar, verifikon të gjithë rezultatin:
     - ref-et duhet të jenë brenda dosjes së fence-it, pa `..`, pa emra të fshehur, pa `attempts/` si destinacion, pa symlink-e dhe pa dalje nga dosja e run-it;
     - `sha256` duhet të jetë i pranishëm dhe i saktë;
     - asnjë skedar nuk duhet të jetë i listuar dy herë.
   - Pastaj bën një `rename` atomik për çdo skedar në emrin publik.
   - Ri-dërgimi i të njëjtit rezultat është idempotent: skedari tashmë i lëvizur njihet nga hash-i.
   - Ref-et në databazë rishkruhen në emrat publikë.
   - Një refuzim e dështon attempt-in me `PUBLISH_REFUSED`, _retryable_, dhe hapi rifillon me fence të ri.
5. **Anulimi dhe afati.**
   - Kontrata e re `erkasa.task-cancel/1` (E-D1) dërgohet nga outbox-i në exchange-in fanout `{prefix}.control`, si në anulim ashtu edhe në kalimin e afatit.
   - Çdo worker ka radhën e vet ekskluzive dhe ndalon vetëm attempt-in që emërtohet (run, hap, fence).
   - Afati i komandës e ndal attempt-in edhe pa mesazh (`DEADLINE_EXCEEDED`, _retryable_).
   - Render-it i jepen deri në 15 s që të vrasë grupet e proceseve FFmpeg para raportimit.
6. **Kontratat.**
   - `fence` opsional te `erkasa.task/1`, `erkasa.task-result/1` dhe `erkasa.task-progress/1`. Ndryshimi është shtues: mesazhet e vjetra mbeten të vlefshme.
   - `erkasa.task-cancel/1` e re, me fixtures të vlefshme dhe të pavlefshme për Zod dhe për JSON Schema.

## Skenarët e planit dhe testet

| #   | Skenari                                                                                                               | Testi                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Run normal: publikohet attempt-i, me hash                                                                             | `AttemptIsolationTest.s1…`, `attempt.test.ts` (1, 2)                                                                    |
| 2   | Retry pas dështimit: publikohet vetëm attempt-i 2                                                                     | `s2…`                                                                                                                   |
| 3   | Dy workers njëkohësisht pas një timeout                                                                               | `s3…` (dy threads që shkruajnë njëkohësisht), `attempt.test.ts` (4), `worker-mq.test.ts` (dy workers realë në RabbitMQ) |
| 4   | Rezultat në rend të kundërt; attempt i vjetër; fence i falsifikuar; rezultat pa fence                                 | `s4…`                                                                                                                   |
| 5   | Anulim gjatë hapit: asgjë publike, worker-i ndalon                                                                    | `s5…`, `attempt.test.ts` (6, 9: render-i i anuluar, 0 procese, asgjë publike)                                           |
| 6   | Ref jashtë attempt-it (`../`, fence tjetër, run tjetër, `.hidden`, `a//b`)                                            | `ArtifactPublisherTest.refusesRefsOutsideTheAttemptFolder`, `s6…`                                                       |
| 7   | Hash i gabuar: asgjë nuk lëviz, as skedarët e vlefshëm të të njëjtit rezultat                                         | `refusesAHashThatDoesNotMatchAndMovesNothing`, `s7…`                                                                    |
| 8   | Mesazhi i anulimit emërton saktë attempt-in; fence i panjohur injorohet                                               | `s8…`, `worker-mq.test.ts`                                                                                              |
| 9   | Ri-dërgim pas crash-i; publikim i ndërprerë në mes                                                                    | `s9…`, `publishingTheSameResultTwiceIsIdempotent`, `finishesAPublicationThatStoppedHalfway`                             |
| +   | Retry i run-it: `attempt` rifillon në 1, fence-i jo                                                                   | `aRunRetryRestartsAttemptNumbersButNeverReusesAFence`                                                                   |
| +   | Progresi nga fence i vjetër injorohet                                                                                 | `progressFromAnOldFenceIsIgnored`                                                                                       |
| +   | Symlink-e brenda attempt-it dhe dosje publike si symlink                                                              | `refusesSymbolicLinks`                                                                                                  |
| +   | Afati: hapi që nuk e dëgjon sinjalin ndalet prapë                                                                     | `attempt.test.ts` (5)                                                                                                   |
| +   | **Një run i plotë** script → voice → plan → render me fence dhe publikim jep **të njëjtin MP4** (sha256) si pa izolim | `attempt.test.ts` (8)                                                                                                   |
| +   | Pa fence (rollback): sjellja e vjetër                                                                                 | `attempt.test.ts` (7)                                                                                                   |

## Provat

| Prova                                                                                                          | Skedari                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Testet e backend-it në CI (132, 0 dështime)                                                                    | `backend-tests.txt`            |
| Log-u i orkestruesit në CI: fence-t, publikimet, anulimet, rezultatet e vjetra të injoruara, `PUBLISH_REFUSED` | `backend-orchestrator-log.txt` |
| Testet e worker-it në CI (`worker-mq.test.ts` u ekzekutua me RabbitMQ: 1 test, jo i anashkaluar)               | `worker-tests.txt`             |
| Testet e worker-it lokalisht, emër për emër (pa RabbitMQ lokal, `worker-mq` anashkalohet këtu)                 | `worker-tests-local.txt`       |

## Devijimet dhe kufizimet

- **D-2.1:** plani parashikonte dy flamuj rollback-u, te backend-i dhe te worker-i. Mjafton një, te backend-i: worker-i punon në dosje attempt-i vetëm kur komanda ka `fence`. Me `ERKASA_ATTEMPT_ISOLATION=false`, backend-i nuk dërgon fence dhe worker-i shkruan si më parë.
- **D-2.2:** fence-i është numër i veçantë nga sekuenca, jo `attempt`-i. `attempt`-i rifillon pas retry-t të run-it, ndaj nuk mund të shërbejë si fencing token. Testi ekzistues që e pret `attempt = 1` pas retry-t nuk ndryshoi.
- **D-2.3:** `RunFlowTest` nuk ndryshoi në pohime. Ndryshoi vetëm "worker-i i rremë" i tij, që tani ndjek protokollin e ri: kthen fence-in, shkruan në dosjen e attempt-it dhe raporton sha256.
- **D-2.4:** testet e backend-it (Postgres dhe RabbitMQ) ekzekutohen vetëm në CI. Këtu mungojnë Docker Hub dhe Maven Central, ndaj nuk mund të ekzekutohen lokalisht.
- **Kufizim:** nëse procesi ndalon në mes të publikimit dhe mesazhi i rezultatit humbet, disa skedarë të atij attempt-i mund të jenë tashmë publikë, ndërsa hapi nuk është `SUCCEEDED`. Hapi rifillon pas afatit. Asnjë skedar nuk mbetet gjysmë i shkruar, dhe attempt-i i ri i mbishkruan ato skedarë.
