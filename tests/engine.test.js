"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");

test("2026 single-filer brackets calculate progressively", () => {
  assert.equal(E.progressiveTax(12400, 2026), 1240);
  assert.equal(E.progressiveTax(50400, 2026), 5800);
  assert.equal(E.progressiveTax(105700, 2026), 17966);
});

test("fixed-rate payment amortizes a loan", () => {
  const payment = E.amortizedPayment(300000, 0.06, 360);
  assert.ok(payment > 1798 && payment < 1799);
});

test("buy and sell preserve balance-sheet value apart from execution costs", () => {
  const state = E.createGame("bootstrap", 9);
  const before = E.netWorth(state);
  assert.equal(E.buyAsset(state, "vti", 10000).ok, true);
  const afterBuy = E.netWorth(state);
  assert.ok(before - afterBuy >= 4.9 && before - afterBuy <= 5.1);
  assert.equal(E.sellAsset(state, "vti", "all").ok, true);
  assert.ok(E.netWorth(state) < afterBuy);
  assert.equal(Object.keys(state.portfolio).length, 0);
});

test("initial margin capacity is limited to half eligible collateral", () => {
  const state = E.createGame("bootstrap", 11);
  E.buyAsset(state, "vti", 50000);
  const status = E.marginStatus(state);
  assert.ok(status.initialCapacity > 24970 && status.initialCapacity < 25010);
  assert.equal(E.borrowMargin(state, 26000).ok, false);
  assert.equal(E.borrowMargin(state, 20000).ok, true);
  assert.equal(state.marginLoan, 20000);
});

test("forced liquidation restores maintenance ratio after a crash", () => {
  const state = E.createGame("bootstrap", 12);
  E.buyAsset(state, "vti", 80000);
  E.borrowMargin(state, 39000);
  state.prices.vti *= 0.6;
  E.advanceMonth(state);
  const status = E.marginStatus(state);
  assert.ok(state.stats.marginCalls >= 1);
  assert.ok(status.ratio >= 0.299 || status.collateral === 0);
});

test("businesses and property generate operating records", () => {
  const state = E.createGame("bootstrap", 21);
  state.cash = 1000000;
  assert.equal(E.buyBusiness(state, "detailing").ok, true);
  assert.equal(E.buyProperty(state, "duplex").ok, true);
  E.advanceMonth(state);
  assert.equal(state.businesses.length, 1);
  assert.equal(state.properties.length, 1);
  assert.notEqual(state.businesses[0].lastProfit, 0);
  assert.notEqual(state.properties[0].lastCashFlow, 0);
  assert.ok(state.taxes[2026].business !== 0);
  assert.ok(state.taxes[2026].depreciation > 0);
});

test("option loss is capped at premium", () => {
  const state = E.createGame("bootstrap", 31);
  const cashBefore = state.cash;
  assert.equal(E.openOption(state, "vti", "call", 1000).ok, true);
  const option = state.derivatives[0];
  state.prices.vti = option.strike * 0.5;
  state.monthsElapsed = option.expiry;
  E.advanceMonth(state);
  assert.ok(state.derivatives.length === 0);
  assert.ok(state.stats.realizedGains >= -1000.01);
  assert.ok(cashBefore - state.cash < 10000);
});

test("twenty-year campaign reaches a scored finish deterministically", () => {
  const first = E.createGame("technologist", 400);
  const second = E.createGame("technologist", 400);
  for (let index = 0; index < E.GAME_MONTHS; index += 1) {
    E.advanceMonth(first);
    E.advanceMonth(second);
  }
  assert.equal(first.finished, true);
  assert.equal(first.year, 2046);
  assert.equal(E.netWorth(first), E.netWorth(second));
  assert.deepEqual(E.score(first), E.score(second));
  assert.ok(Number.isFinite(E.netWorth(first)));
});

test("bankruptcy discharges debt but leaves a playable fresh start", () => {
  const state = E.createGame("leveraged", 50);
  state.cash = -50000;
  state.loans[0].principal = 200000;
  const result = E.fileBankruptcy(state);
  assert.equal(result.ok, true);
  assert.ok(state.cash >= 8000);
  assert.equal(E.loanBalance(state), 0);
  assert.equal(state.bankruptcies, 1);
  assert.equal(state.finished, false);
});

test("random events are gated by compatible economic conditions", () => {
  const state = E.createGame("bootstrap", 61);
  const speculative = require("../data.js").RANDOM_EVENTS.find((event) => event.condition === "risk_euphoria");
  state.metrics.riskAppetite = -0.2;
  state.metrics.creditImpulse = -0.1;
  assert.equal(E.randomEventEligible(state, speculative), false);
  state.metrics.creditImpulse = 0.25;
  assert.equal(E.randomEventEligible(state, speculative), true);
});

test("scheduled events preserve context and quantified effects", () => {
  const state = E.createGame("bootstrap", 71);
  for (let index = 0; index < 9; index += 1) E.advanceMonth(state);
  assert.equal(state.pendingEvent.id, "agents");
  assert.match(state.pendingEvent.context, /Inflation is/);
  assert.ok(state.pendingEvent.effectSummary.some((effect) => effect.includes("AI trend")));
  assert.match(state.log[0].detail, /Modeled effect:/);
});

test("event pilot creates a delayed capital-at-risk project and resolves it", () => {
  const state = E.createGame("technologist", 81);
  state.cash = 200000;
  for (let index = 0; index < 9; index += 1) E.advanceMonth(state);
  const pilot = state.pendingEvent.choices.find((choice) => choice.kind === "pilot");
  const cashBefore = state.cash;
  assert.equal(E.resolveEventChoice(state, pilot.id).ok, true);
  assert.equal(state.opportunities.length, 1);
  assert.equal(state.cash, cashBefore - pilot.cost);
  for (let index = 0; index < pilot.months; index += 1) E.advanceMonth(state);
  assert.equal(state.opportunities.length, 0);
  assert.ok(state.pendingOutcome);
  assert.ok(Number.isFinite(state.pendingOutcome.profit));
  assert.ok(state.pendingOutcome.payout >= 0);
});

test("event protection and operating responses create visible temporary advantages", () => {
  const protectedState = E.createGame("bootstrap", 91);
  E.buyAsset(protectedState, "vti", 10000);
  for (let index = 0; index < 9; index += 1) E.advanceMonth(protectedState);
  const protection = protectedState.pendingEvent.choices.find((choice) => choice.kind === "protect");
  assert.ok(protection);
  assert.equal(E.resolveEventChoice(protectedState, protection.id).ok, true);
  assert.equal(protectedState.shockShield.months, 6);

  const operator = E.createGame("bootstrap", 92);
  operator.cash = 500000;
  E.buyBusiness(operator, "detailing");
  for (let index = 0; index < 9; index += 1) E.advanceMonth(operator);
  const operations = operator.pendingEvent.choices.find((choice) => choice.kind === "operate");
  assert.ok(operations);
  assert.equal(E.resolveEventChoice(operator, operations.id).ok, true);
  assert.equal(operator.businesses[0].eventBoost.months, 6);
});

test("quarterly deal board enforces commitment limits and produces an outcome", () => {
  const state = E.createGame("bootstrap", 101);
  state.cash = 250000;
  const deals = E.availableDeals(state);
  assert.equal(deals.length, 3);
  const deal = deals[0];
  assert.equal(E.takeDeal(state, deal.key).ok, true);
  assert.equal(E.takeDeal(state, deal.key).ok, false);
  assert.equal(state.opportunities.length, 1);
  assert.equal(E.availableDeals(state).find((candidate) => candidate.key === deal.key).taken, true);
  for (let index = 0; index < deal.months; index += 1) E.advanceMonth(state);
  assert.equal(state.opportunities.length, 0);
  assert.ok(state.pendingOutcome);
  assert.equal(state.pendingOutcome.stake, deal.cost);
});

test("cash-limited prepayment preserves a sub-dollar loan balance until paid", () => {
  const state = E.createGame("bootstrap", 89);
  assert.equal(E.takeLoan(state, 5000).ok, true);
  const loanId = state.loans[0].id;
  state.cash = 4999.50;
  const netWorthBefore = E.netWorth(state);

  assert.equal(E.repayLoan(state, loanId, 5000).ok, true);
  assert.equal(state.cash, 0);
  assert.equal(state.loans[0]?.id, loanId);
  assert.equal(E.loanBalance(state), 0.5);
  assert.equal(E.netWorth(state), netWorthBefore);

  state.cash = 10;
  assert.equal(E.repayLoan(state, loanId, 5000).ok, true);
  assert.equal(state.cash, 9.5);
  assert.equal(E.loanBalance(state), 0);
  assert.equal(state.loans.length, 0);
});

test("six-month options and futures settle on the sixth advance after opening", () => {
  const state = E.createGame("bootstrap", 1);
  E.advanceMonth(state); // Asset opened after the start of the campaign.
  assert.equal(E.openOption(state, "vti", "call", 1000).ok, true);
  assert.equal(E.openFuture(state, "energy", "long", 1000).ok, true);
  const [option, future] = state.derivatives;

  for (let month = 1; month <= 5; month += 1) {
    assert.equal(E.advanceMonth(state).ok, true);
    assert.deepEqual(state.derivatives.map((position) => position.id), [option.id, future.id]);
  }
  const priorMargin = future.marginBalance;
  const priorPrice = future.lastPrice;

  assert.equal(E.advanceMonth(state).ok, true);
  assert.equal(state.monthsElapsed, option.expiry);
  assert.equal(state.monthsElapsed, future.expiry);
  assert.deepEqual(state.derivatives, []);

  const expiration = state.log.find((entry) => entry.title === "VTI option expired");
  const settlement = state.log.find((entry) => entry.title === "NRG future closed");
  assert.ok(expiration);
  assert.ok(settlement);
  const expectedOption = option.contracts * 100 * Math.max(0, state.prices.vti - option.strike);
  const expectedFuture = priorMargin + future.notional * (state.prices.energy / priorPrice - 1);
  assert.ok(Math.abs(expectedOption - expiration.amount) < 0.01);
  assert.ok(Math.abs(expectedFuture - settlement.amount) < 0.01);

  assert.equal(E.advanceMonth(state).ok, true);
  assert.equal(state.log.filter((entry) => entry.title === expiration.title).length, 1);
  assert.equal(state.log.filter((entry) => entry.title === settlement.title).length, 1);
});

test("property operating cash flow stops charging a paid-off mortgage after reload", () => {
  const state = E.createGame("bootstrap", 101);
  state.cash = 1000000;
  assert.equal(E.buyProperty(state, "retail").ok, true);
  const property = state.properties[0];
  property.mortgage = 0;
  property.monthsRemaining = 0;

  const resumed = E.hydrate(E.serialize(state));
  const owned = resumed.properties[0];
  const spec = E.getProperty(owned.type);
  E.advanceMonth(resumed);
  assert.equal(owned.mortgage, 0);
  assert.equal(owned.monthsRemaining, 0);
  assert.equal(owned.lastCashFlow, (owned.occupied ? spec.rent : 0) - spec.rent * spec.expenses);
  assert.equal(resumed.stats.rentProfit, owned.lastCashFlow);
});

test("a final mortgage installment charges only remaining principal and interest", () => {
  const state = E.createGame("bootstrap", 102);
  state.cash = 1000000;
  assert.equal(E.buyProperty(state, "retail").ok, true);
  const owned = state.properties[0];
  const spec = E.getProperty(owned.type);
  owned.mortgage = 100;
  owned.monthsRemaining = 1;
  const interest = owned.mortgage * owned.rate / 12;
  E.advanceMonth(state);

  assert.equal(owned.mortgage, 0);
  assert.equal(owned.monthsRemaining, 0);
  const operatingIncome = (owned.occupied ? spec.rent : 0) - spec.rent * spec.expenses;
  assert.equal(owned.lastCashFlow, operatingIncome - (100 + interest));
  assert.equal(state.stats.interest, interest);
  assert.equal(state.taxes[2026].business, operatingIncome - interest);
});

test("closing a future after a saved maintenance top-up records the trading loss", () => {
  const state = E.createGame("bootstrap", 1);
  assert.equal(E.openFuture(state, "energy", "long", 1000).ok, true);
  const future = state.derivatives[0];
  const startPrice = future.lastPrice;

  E.advanceMonth(state);
  const expectedGain = future.notional * (future.lastPrice / startPrice - 1);
  assert.ok(expectedGain < -550);
  assert.equal(future.marginBalance, 1000); // Maintenance restored the account.

  const resumed = E.hydrate(E.serialize(state));
  assert.equal(E.closeDerivative(resumed, future.id).ok, true);
  assert.ok(Math.abs(resumed.stats.realizedGains - expectedGain) < 0.01);
  assert.ok(Math.abs(resumed.taxes[2026].shortGains - expectedGain) < 0.01);
});

test("future expiry accounts for multiple top-ups, including from a legacy save", () => {
  let state = E.createGame("bootstrap", 2);
  assert.equal(E.openFuture(state, "energy", "long", 1000).ok, true);
  delete state.derivatives[0].marginTopUps; // Older saves have no recorded top-ups.
  state = E.hydrate(E.serialize(state));
  const future = state.derivatives[0];

  let expectedGain = 0;
  let topUps = 0;
  for (let month = 0; month < 6; month += 1) {
    const priorBalance = future.marginBalance;
    const priorPrice = future.lastPrice;
    E.advanceMonth(state);
    const pnl = future.notional * (future.lastPrice / priorPrice - 1);
    expectedGain += pnl;
    if (future.marginBalance - priorBalance - pnl > 0.01) topUps += 1;
  }
  assert.ok(topUps > 1);
  assert.deepEqual(state.derivatives, []);
  assert.ok(Math.abs(state.stats.realizedGains - expectedGain) < 0.01);
  assert.ok(Math.abs(state.taxes[2026].shortGains - expectedGain) < 0.01);
});

test("future liquidation counts both earlier top-ups and the last partial deposit", () => {
  const state = E.createGame("bootstrap", 2);
  assert.equal(E.openFuture(state, "energy", "long", 1000).ok, true);
  const future = state.derivatives[0];

  let expectedGain = 0;
  for (let month = 0; month < 3; month += 1) {
    const priorPrice = future.lastPrice;
    if (month === 2) {
      state.cash = 50;
      state.salary = 0;
      state.livingExpenses = 0;
    }
    E.advanceMonth(state);
    expectedGain += future.notional * (future.lastPrice / priorPrice - 1);
    if (month === 1) assert.equal(future.marginBalance, 1000);
  }
  assert.deepEqual(state.derivatives, []);
  assert.ok(future.marginBalance > 50 && future.marginBalance < 450);
  assert.ok(state.log.some((entry) => entry.title === "Futures position liquidated"));
  assert.ok(Math.abs(state.stats.realizedGains - expectedGain) < 0.01);
  assert.ok(Math.abs(state.taxes[2026].shortGains - expectedGain) < 0.01);
});

for (const [dealId, months, category, otherCategory] of [
  ["satellite-data", 11, "shortGains", "longGains"],
  ["orbital-manifest", 12, "longGains", "shortGains"]
]) {
  test(`Deal Board classifies a ${months}-month project at maturity`, () => {
    const state = E.createGame("bootstrap", 102);
    let deal;
    for (let index = 0; index < E.GAME_MONTHS; index += 1) {
      deal = E.availableDeals(state).find((candidate) => candidate.id === dealId);
      if (deal) break;
      E.advanceMonth(state);
    }
    assert.ok(deal, `Expected ${dealId} on the Deal Board`);
    assert.equal(deal.months, months);

    state.cash = 1000000;
    assert.equal(E.takeDeal(state, deal.key).ok, true);
    const [project] = state.opportunities;
    for (let index = 1; index < months; index += 1) E.advanceMonth(state);
    assert.equal(state.opportunities[0]?.monthsRemaining, 1);
    assert.equal(state.stats.realizedGains, 0);

    const settlementYear = state.year;
    E.advanceMonth(state);
    assert.equal(state.opportunities.length, 0);
    assert.equal(state.monthsElapsed - project.startedAt, months);
    assert.equal(state.pendingOutcome?.id, project.id);
    const profit = state.pendingOutcome.profit;
    assert.notEqual(profit, 0);
    assert.equal(state.taxes[settlementYear][category], profit);
    assert.equal(state.taxes[settlementYear][otherCategory], 0);

    E.advanceMonth(state);
    assert.equal(state.stats.realizedGains, profit);
  });
}
