# Gate fixtures

Two kinds of example packages live in this repository, for two different purposes.

|                                               | Contract fixtures (A)                                                                                               | Gate acceptance fixtures (B)                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Where                                         | `contracts/fixtures/valid/`                                                                                         | `gate/fixtures/acceptance/`                                                              |
| Proves                                        | the structure and expressiveness of `erkasa.render/1` and `erkasa.assets/1`                                         | that a package built only from what the current engine publishes passes every gate check |
| May use features the engine does not draw yet | yes (lights, shapes, text and icon overlays, `glow`, `dip_to_black`, …)                                             | no                                                                                       |
| Executable by the current engine              | not claimed                                                                                                         | yes                                                                                      |
| Checked by                                    | the schemas (Zod and Ajv, `contracts` tests); the gate refuses them, and `gate/test/films.test.ts` pins exactly why | the full gate, with no error and no warning                                              |

The acceptance fixtures are generated from the engine's `capabilities().render` and real files of the asset library:

```
pnpm --filter @erkasa/gate fixtures:acceptance
```

Their builtins are pinned by fingerprint, so a change in the engine code they use makes them fail on purpose;
regenerate them only after reviewing that change. `films.test.ts` checks that the files on disk are exactly what
the generator produces.
