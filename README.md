# Sport Sim

A multi-sport match and season simulator that runs entirely in the browser.

Pick a competition, simulate it, and dig into the numbers. Every result comes
out of a seeded probability engine, so a given seed always replays the exact
same season — results are reproducible, shareable and testable.

## Planned sports

| Sport | Status |
| --- | --- |
| Football | Engine complete |
| Basketball | Planned |
| American Football | Planned |
| Formula 1 | Planned |

## Modes

- **Season** — simulate a full league, round by round or all at once, with a
  live table, fixtures and results.
- **Live match** — watch a single fixture play out minute by minute with a
  running play-by-play feed.
- **Sandbox** — tune competitor ratings and run thousands of simulations to see
  how win probabilities shift.

## How it is put together

The project separates a sport's *rules* from everything built on top of them.
Scheduling, season state, standings, the UI and persistence are written once in
`@sportsim/core` and shared; each sport supplies only its own match engine
behind a single interface.

```
packages/core            scheduling, season state, standings, seeded RNG
packages/sports/football  football match engine and league data
apps/web                 React front end
scripts/report.ts        simulate a season and print the table to a terminal
```

Adding a sport means implementing one `SportDefinition` — a `simulate`, a
`createLive`, a `standings` and some column metadata. Nothing else has to
change.

### Determinism

Each fixture derives its generator from the season seed plus the fixture id,
rather than threading a single generator through the whole season. That means a
match plays out identically no matter what order rounds are simulated in, or
how many times a single fixture is replayed in live mode.

The test suite enforces the consequence of this: stepping a match through the
live feed must produce byte-for-byte the same result as the fast season sim.

## Getting started

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm test                  # run the test suite
npm run report            # simulate a season and print the table
npm run report -- --seed=2026
npm run typecheck         # type check every package
```

Requires Node 22 or newer.

## Calibration

Engines are tuned against real-world rates and the test suite guards them, so a
change that makes football score like basketball fails CI. Current football
output over a 380-fixture season:

- 2.66 goals per fixture
- champion on 79 points, bottom side on 25
- home sides win noticeably more often than away sides, but far from always

## Licence

MIT
