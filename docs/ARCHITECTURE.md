# Architecture

Capital Frontier is a static application with no production dependencies or build step.

## Files

- `index.html`: application structure, dialogs, navigation, and accessible labels
- `styles.css`: responsive desktop and mobile presentation
- `data.js`: asset, business, property, event, scenario, principle, and deal catalogs
- `engine.js`: deterministic simulation state and financial operations
- `app.js`: rendering, interaction dispatch, audio, charts, autosave, and browser integration
- `public/`: optimized game artwork
- `tests/engine.test.js`: Node-based model and invariant tests
- `tests/browser-smoke.cjs`: Playwright desktop/mobile workflow test

## Module format

`data.js` and `engine.js` use a small UMD wrapper. They attach to `window` in the browser and export through CommonJS under Node, allowing the same engine to run without bundling in production and without a DOM in tests.

## State

`EconEngine.createGame()` creates the authoritative state object. UI rendering reads from that state; actions mutate it through exported engine methods. The browser serializes state to `localStorage` after successful actions.

Seeded randomness is stored in `state.seed`. Every random draw advances the seed through a linear congruential generator.

## Rendering

The UI uses DOM templates and delegated event handling. Charts and sparklines use the Canvas 2D API. Sound effects and ambient music use the Web Audio API and begin after a user interaction to satisfy autoplay policies.

## Deployment

All asset references are relative, so the repository root can be served directly by GitHub Pages. `.nojekyll` prevents Jekyll processing. No secrets or server-side components are required.

## Testing

Run the simulation tests with:

```bash
npm test
```

The browser smoke test expects a server at `http://127.0.0.1:4173` and uses the locally installed Playwright package:

```bash
npm run serve
node tests/browser-smoke.cjs
```
