# Contributing

## Development

Capital Frontier requires only a modern browser and Node.js for tests.

```bash
npm run serve
npm test
```

The game intentionally has no framework or production dependency. Proposed dependencies should solve a concrete problem that cannot be handled reasonably with the existing platform APIs.

## Changes

- Keep simulation changes in `engine.js` and catalog content in `data.js`.
- Preserve deterministic behavior by drawing randomness only through the engine's seeded generator.
- Add or update engine tests for financial rules and state invariants.
- Check both desktop and 390px mobile layouts for interface changes.
- Do not present simplified model behavior as real financial advice.

## Issues and pull requests

Describe the player problem, expected behavior, and model implications. For economy changes, explain how the proposal affects cash flow, risk, taxes, or incentives. Keep unrelated refactors out of focused fixes.

Pull requests should include the relevant test output and screenshots for visible changes.
