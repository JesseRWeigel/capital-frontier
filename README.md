# Capital Frontier

![Capital Frontier economic city](public/economy-city.webp)

**Capital Frontier** is a dependency-free browser tycoon game about building and protecting wealth in the United States from 2026 to 2046. Allocate capital across public markets, private businesses, property, derivatives, and emerging AI, energy, digital-asset, and space opportunities while navigating taxes, credit cycles, margin calls, and bankruptcy.

**[Play Capital Frontier](https://jesserweigel.github.io/capital-frontier/)**

## Features

- Stocks, Treasury and corporate bonds, gold, Bitcoin, digital assets, energy, copper, AI, and space markets
- Options, futures, margin loans, term debt, mortgages, forced liquidation, and bankruptcy
- Nine operating-business categories and five real-estate categories
- Progressive federal taxes, payroll and self-employment taxes, capital gains, depreciation, and quarterly estimates
- Condition-aware economic events with player choices and personal financial-impact explanations
- Quarterly Deal Board projects with explicit stakes, success odds, countdowns, salvage values, and delayed outcomes
- Austrian-economics concepts including time preference, economic calculation, capital structure, Cantillon effects, and interest-rate signals
- Three starting scenarios, dynamic objectives, milestones, autosaves, exportable saves, sound effects, and ambient music
- Responsive desktop and mobile layouts

## Play locally

The game can be opened directly through `index.html`, or served locally:

```bash
npm run serve
```

Then visit `http://localhost:4173`.

No build step or runtime dependencies are required.

## Test

```bash
npm test
node tests/browser-smoke.cjs
```

The engine suite covers taxes, amortization, transactions, margin calls, business and property cash flow, derivatives, deterministic campaigns, bankruptcy, event conditions, response choices, and Deal Board outcomes. The Playwright smoke test covers the complete browser flow at desktop and mobile widths.

## Documentation

- [Player guide](docs/GAMEPLAY.md)
- [Simulation model](docs/SIMULATION_MODEL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)

## Model baseline

- Opening policy rate: 3.625%, matching the June 2026 federal-funds target midpoint
- Federal income tax: 2026 single-filer brackets with a $16,100 standard deduction, indexed 2% annually in the model
- Margin: 50% initial capacity and a 30% modeled house-maintenance requirement
- Long-run macro anchor: approximately 2% inflation, with rates responding to inflation and real growth

Taxes, bankruptcy, entities, financial products, and state rules are intentionally simplified. Capital Frontier is an educational simulation, not investment, tax, or legal advice.

## Calibration sources

- [IRS 2026 tax inflation adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill)
- [Federal Reserve June 17, 2026 FOMC statement](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm)
- [SEC margin account guide](https://www.sec.gov/about/reports-publications/investorpubsmarginhtm)
- [CBO long-term budget and economic outlook](https://www.cbo.gov/publication/61270)

## License

Capital Frontier is available under the [MIT License](LICENSE).
