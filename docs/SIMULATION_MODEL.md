# Simulation Model

Capital Frontier is designed to teach relationships and tradeoffs, not forecast exact asset prices. All random behavior is generated from a seed stored in the save file, making a campaign deterministic when replayed from the same state.

## Macro state

The monthly model tracks:

- Federal-funds policy rate
- Inflation
- Real economic growth
- Unemployment
- Ten-year Treasury yield
- Risk appetite
- Credit impulse
- Money growth

Variables mean-revert toward long-run anchors while influencing one another. Policy rates respond quarterly to inflation and growth. Event modifiers decay over subsequent months rather than changing prices permanently in one step.

## Market returns

Each asset has an annual drift, volatility, income yield, and sensitivities to growth, inflation, rates, and risk appetite. Monthly returns combine these factors with seeded shocks. The model includes fractional units and execution costs.

This is a stylized factor model. It does not reproduce an exchange order book, intraday trading, issuer-specific fundamentals, or live prices.

## Taxes

The model begins with the 2026 single-filer federal brackets and standard deduction. It includes:

- Progressive ordinary-income tax
- Preferential long-term capital-gain rates
- Payroll tax
- Simplified self-employment tax
- Net investment income tax
- Simplified 4.5% state income tax
- Property depreciation
- Withholding and quarterly estimated payments
- April settlement of the prior tax year

Bracket thresholds and the standard deduction grow by a modeled 2% annually. The game omits many deductions, credits, filing statuses, entity elections, basis adjustments, loss limitations, and state-specific rules.

## Businesses

Business revenue is influenced by scale, health, real growth, technology exposure, labor pressure, energy pressure, and operating noise. Profit can be distributed or reinvested. Valuation is based on annualized operating profit and a business-specific multiple, subject to a minimum recovery value.

## Property

Property combines rent, vacancy, expenses, amortizing debt, depreciation, repairs, appreciation, rate sensitivity, and transaction costs. Residential and commercial properties use different modeled mortgage terms and spreads.

## Margin and derivatives

Eligible public-market collateral supports initial borrowing up to 50% of value. A 30% modeled house-maintenance ratio is used for forced liquidation. Real brokers can impose different and changing requirements.

Options use a simplified premium, strike, intrinsic value, time value, and six-month expiry. Futures use eight times notional exposure with monthly mark-to-market and maintenance checks.

## Projects and events

Events are gated by compatible conditions such as inflation, growth, rates, risk appetite, credit, technology maturity, and calendar year. Event choices and quarterly deals create projects with:

- Capital committed up front
- A fixed resolution horizon
- A disclosed success probability
- A success payout multiple
- A failure recovery rate

Knowledge and reputation can improve success odds within capped limits. Project profits enter the tax ledger as realized gains.

## Limitations

The future technology events are plausible scenarios, not predictions. Bankruptcy, taxes, securities, derivatives, mortgages, and business operations are simplified substantially. The game should not be used to make real financial decisions.
