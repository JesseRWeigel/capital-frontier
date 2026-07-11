# Player Guide

## Objective

Manage a household and investment balance sheet from July 2026 through July 2046. The final allocator score combines net worth, resilience, knowledge, reputation, bankruptcies, and forced margin liquidations.

The game does not have one required strategy. A successful player generally preserves enough liquidity to survive bad timing, allocates across different return drivers, and increases risk only after understanding the downside.

## First ninety days

1. Keep at least six months of living expenses in available cash.
2. Place a measured first investment in broad stocks or Treasury bills.
3. Advance one month and compare salary, tax withholding, living expenses, distributions, and price changes.
4. Follow the persistent current objective and the expanded checklist on Overview.

## Monthly cycle

Each advance processes:

1. Gross salary and automatic withholding
2. Inflation-adjusted living expenses
3. Business revenue, operating costs, reinvestment, and setbacks
4. Rent, vacancy, property expenses, mortgage amortization, and repairs
5. Loan and margin interest
6. Dividends and bond interest
7. Macro conditions and market prices
8. Derivatives, active projects, margin maintenance, and taxes
9. Events, milestones, and the next objective

The **Next quarter** button advances up to three months but stops when an event decision or project outcome needs attention.

## Public markets

The Markets screen provides fractional dollar orders. Selling records realized gains or losses and classifies the holding period for taxes.

- **Stocks:** productive ownership with growth and sentiment exposure
- **Bonds:** income and duration exposure; longer bonds react more strongly to rate changes
- **Real assets:** gold, energy, and copper respond differently to inflation and growth
- **Digital assets:** high-volatility scarcity and settlement-network exposure
- **Frontier themes:** AI and space have higher expected growth and larger drawdowns

## Options and futures

Options have a six-month expiry, an out-of-the-money strike, time value, and a premium that can expire worthless. The maximum option loss is the premium.

Futures use eight times notional exposure and settle gains or losses monthly. Positions below maintenance margin are liquidated.

## Businesses

Businesses generate monthly revenue and profit according to scale, health, labor intensity, energy exposure, technology sensitivity, and the economic cycle. Reinvesting profits grows scale but keeps cash inside the business. Expansion increases capacity and fixed exposure.

## Property

Property requires a down payment and closing costs. Cash flow includes vacancy, operating expenses, mortgage payments, and occasional capital repairs. The tax model includes simplified depreciation.

## Events and decisions

Event dialogs explain why the event is plausible, which model variables changed, and how much of the current portfolio or balance sheet is exposed.

Responses may include:

- Funding a time-limited pilot with a defined stake and success probability
- Buying temporary public-market downside protection
- Reconfiguring owned businesses for a temporary operating boost
- Reducing household expenses
- Preserving liquidity without making a special commitment

The event's macro effects occur regardless of the response. The response determines how the player adapts.

## Deal Board

Three opportunities rotate each quarter. Every deal discloses its stake, duration, modeled success odds, maximum payout, and recovery rate on failure. Knowledge and reputation improve underwriting odds but never eliminate uncertainty. A player can manage at most five active projects.

## Credit and failure

Margin capacity is based on eligible collateral. Falling below the modeled 30% maintenance-equity requirement triggers forced sales. Term loans amortize over five years, and mortgages amortize over their stated terms.

The simplified Chapter 7 action liquidates nonexempt assets, retires secured claims, discharges modeled unsecured debt, damages reputation, and allows the campaign to continue with a small fresh start.

## Saves

The game autosaves to browser `localStorage`. The Ledger can export the current state as JSON. Saves are local to the browser and domain that created them.
