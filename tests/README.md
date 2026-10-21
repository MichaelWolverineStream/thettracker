# Test principles

These rules decide whether a test belongs in the suite, where it lives and how big it
should be. Apply them when adding a test and when reviewing an existing one.

## Layers

| Layer | Runner | Files | Use for |
|---|---|---|---|
| Unit | Vitest | `*.test.ts` | Pure logic: formatting, parsing, URL/storage contracts, validation |
| Component (jsdom) | Vitest + Testing Library | `*.test.tsx` | React state, hooks, launcher interactions, SNI protocol with `FakeSniSocket` |
| Browser | Playwright (Chrome) | `*.spec.ts` | Only what jsdom cannot do: real font loading, layout/overflow, popups, IndexedDB, real WebSocket routing, legacy screenshot baseline |

Node 25+ has its own `localStorage`/`sessionStorage` globals. `test-environment.test.ts`
fails if they shadow jsdom's Web Storage, which would make `Storage.prototype` spies in the
storage tests miss writes.

## Principles

1. **Protect a behavior or contract that matters.** Every test guards something a user or an
   existing integration would notice breaking: what the tracker shows, bookmark/URL formats,
   the saved-defaults format, legacy parity, SNI protocol and recovery, or storage failure
   handling. The test name states that behavior.
2. **Test at the lowest layer that can observe it.** Pure logic goes in unit tests, React
   state and interaction in jsdom tests, and only browser-only concerns in Playwright.
3. **One owner per behavior.** Assert a rule thoroughly in one place. Higher layers smoke-test
   the wiring with one representative case and do not re-enumerate it.
4. **Representative inputs, not registries.** Cover equivalence classes and boundaries. A table
   is justified only when each row exercises a distinct rule or branch (for example French
   71/80/81), not to loop over every font, timer style or language.
5. **One test per failure path.** Invalid inputs that reach the same fallback branch belong in
   one test with two or three examples, not ten table rows.
6. **Don't restate data or internals.** Avoid re-listing constants (language lists, phrases),
   matching source or CSS text, exact inline style strings, binary asset internals or
   incidental timer counts, unless that detail *is* the contract.
7. **Deterministic and bounded.** Use fake clocks and the controlled SNI fake in
   `helpers/sni.ts`. Loops run the minimum iterations needed to show the property.
8. **Readable, single-scenario tests.** Split multi-concern flows into separate tests and put
   shared fixtures in `helpers/`.
9. **Viewports.** Browser tests run on desktop. Only layout/overflow-sensitive tests also run
   on the 600×600 popup project: tag them `{ tag: '@responsive' }`, which the popup
   project selects with `grep`. Mobile is not a supported target.
10. **Screenshots are review artifacts.** Save them with `page.screenshot({ path })` into
    `test-results/` for each distinct visual surface. Only the legacy baseline is an asserted
    snapshot, and it must never be updated to hide a compatibility regression.
