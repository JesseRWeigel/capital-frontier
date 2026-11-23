(function (root, factory) {
  const api = factory(
    root.GameData || (typeof require === "function" ? require("./data.js") : null)
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EconEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Data) {
  "use strict";

  if (!Data) throw new Error("Capital Frontier data was not loaded.");

  const VERSION = 1;
  const START_YEAR = 2026;
  const START_MONTH = 6;
  const GAME_MONTHS = 240;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SINGLE_BRACKETS_2026 = [
    [12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24],
    [256225, 0.32], [640600, 0.35], [Infinity, 0.37]
  ];

  function round(value, places = 2) {
    const power = 10 ** places;
    return Math.round((value + Number.EPSILON) * power) / power;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function random(state) {
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function normal(state) {
    const u = Math.max(random(state), 1e-9);
    const v = Math.max(random(state), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function uid(state, prefix) {
    state.ids += 1;
    return `${prefix}-${state.ids}`;
  }

  function getAsset(id) {
    return Data.ASSETS.find((asset) => asset.id === id);
  }

  function getBusiness(id) {
    return Data.BUSINESSES.find((business) => business.id === id);
  }

  function getProperty(id) {
    return Data.PROPERTIES.find((property) => property.id === id);
  }

  function currentDate(state) {
    return { year: state.year, month: state.month, label: `${MONTHS[state.month]} ${state.year}` };
  }

  function elapsedSince(startIndex, state) {
    return state.monthsElapsed - startIndex;
  }

  function log(state, type, title, detail, amount) {
    state.log.unshift({
      id: uid(state, "log"), type, title, detail,
      amount: typeof amount === "number" ? round(amount) : null,
      date: currentDate(state).label,
      monthIndex: state.monthsElapsed
    });
    state.log = state.log.slice(0, 80);
  }

  function addLesson(state, principleId, context) {
    const principle = Data.PRINCIPLES.find((item) => item.id === principleId);
    if (!principle) return;
    const existing = state.lessons.find((item) => item.id === principleId);
    if (!existing) {
      state.lessons.unshift({ ...principle, context, date: currentDate(state).label });
      state.knowledge = clamp(state.knowledge + 2, 0, 100);
    } else if (context) {
      existing.context = context;
      existing.date = currentDate(state).label;
    }
  }

  function initialTaxLedger(year) {
    return {
      year, wages: 0, business: 0, dividends: 0, interest: 0,
      shortGains: 0, longGains: 0, depreciation: 0, withheld: 0,
      estimatedPaid: 0, liability: null, balance: null, settled: false
    };
  }

  function createGame(scenarioId = "bootstrap", seed = Date.now()) {
    const scenario = Data.SCENARIOS[scenarioId] || Data.SCENARIOS.bootstrap;
    const prices = {};
    const priceHistory = {};
    Data.ASSETS.forEach((asset) => {
      prices[asset.id] = asset.price;
      priceHistory[asset.id] = [asset.price];
    });

    const state = {
      version: VERSION,
      seed: Number(seed) >>> 0,
      ids: 0,
      scenario: scenario.id,
      year: START_YEAR,
      month: START_MONTH,
      monthsElapsed: 0,
      finished: false,
      bankruptcies: 0,
      cash: scenario.cash,
      salary: scenario.salary,
      livingExpenses: scenario.expenses,
      consumerDebt: scenario.debt,
      consumerDebtRate: 0.084,
      marginLoan: 0,
      portfolio: {},
      prices,
      priceHistory,
      businesses: [],
      properties: [],
      loans: [],
      derivatives: [],
      opportunities: [],
      takenDeals: [],
      shockShield: { strength: 0, months: 0 },
      metrics: {
        fedRate: 3.625,
        priorFedRate: 3.625,
        inflation: 2.8,
        realGrowth: 2.1,
        unemployment: 4.2,
        riskAppetite: 0.08,
        creditImpulse: 0.12,
        yield10: 4.15,
        moneyGrowth: 4.4
      },
      modifiers: {
        aiTrend: 0, spaceTrend: 0, energyTrend: 0, cryptoTrend: 0,
        property: 0, wageGrowth: 0, months: 0
      },
      knowledge: scenario.knowledge,
      reputation: 50,
      resilience: 45,
      actions: 0,
      taxes: { [START_YEAR]: initialTaxLedger(START_YEAR) },
      pendingEvent: null,
      pendingOutcome: null,
      seenEvents: [],
      choices: [],
      log: [],
      lessons: [],
      badges: [],
      netWorthHistory: [scenario.cash - scenario.debt],
      cashHistory: [scenario.cash],
      stats: {
        earned: 0, spent: 0, taxes: 0, interest: 0, marginCalls: 0,
        businessProfit: 0, rentProfit: 0, realizedGains: 0, peakNetWorth: scenario.cash - scenario.debt
      }
    };

    if (scenario.id === "leveraged") {
      state.loans.push({
        id: uid(state, "loan"), type: "Acquisition note", principal: scenario.debt,
        rate: state.consumerDebtRate, monthsRemaining: 60, payment: amortizedPayment(scenario.debt, state.consumerDebtRate, 60)
      });
      state.consumerDebt = 0;
    }
    if (scenario.id === "technologist") state.consumerDebtRate = 0.061;

    log(state, "system", "Your capital journey begins", scenario.description);
    addLesson(state, "optionality", "Your opening cash is both runway and opportunity capital.");
    return state;
  }

  function taxLedger(state, year = state.year) {
    if (!state.taxes[year]) state.taxes[year] = initialTaxLedger(year);
    return state.taxes[year];
  }

  function progressiveTax(taxableIncome, year = START_YEAR) {
    if (taxableIncome <= 0) return 0;
    const inflationFactor = Math.pow(1.02, Math.max(0, year - START_YEAR));
    let tax = 0;
    let prior = 0;
    for (const [baseLimit, rate] of SINGLE_BRACKETS_2026) {
      const limit = baseLimit === Infinity ? Infinity : baseLimit * inflationFactor;
      const slice = Math.min(taxableIncome, limit) - prior;
      if (slice > 0) tax += slice * rate;
      if (taxableIncome <= limit) break;
      prior = limit;
    }
    return tax;
  }

  function calculateTax(ledger) {
    const inflationFactor = Math.pow(1.02, Math.max(0, ledger.year - START_YEAR));
    const standardDeduction = 16100 * inflationFactor;
    const ordinary = ledger.wages + ledger.business + ledger.dividends + ledger.interest + ledger.shortGains - ledger.depreciation;
    const taxableOrdinary = Math.max(0, ordinary - standardDeduction);
    const federal = progressiveTax(taxableOrdinary, ledger.year);
    const longRate = taxableOrdinary > 640600 * inflationFactor ? 0.20 : taxableOrdinary > 50400 * inflationFactor ? 0.15 : 0;
    const capitalGains = Math.max(0, ledger.longGains) * longRate;
    const payroll = Math.min(ledger.wages, 184500 * inflationFactor) * 0.0765;
    const selfEmployment = Math.max(0, ledger.business) * 0.1413;
    const state = Math.max(0, ordinary + ledger.longGains) * 0.045;
    const niit = Math.max(0, ordinary + ledger.longGains - 200000 * inflationFactor) * 0.038;
    return {
      federal: round(federal), capitalGains: round(capitalGains), payroll: round(payroll),
      selfEmployment: round(selfEmployment), state: round(state), niit: round(niit),
      total: round(federal + capitalGains + payroll + selfEmployment + state + niit)
    };
  }

  function amortizedPayment(principal, annualRate, months) {
    if (principal <= 0 || months <= 0) return 0;
    const r = annualRate / 12;
    if (!r) return principal / months;
    return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  }

  function portfolioValue(state, predicate) {
    return Object.entries(state.portfolio).reduce((sum, [id, holding]) => {
      const asset = getAsset(id);
      if (!asset || (predicate && !predicate(asset))) return sum;
      return sum + holding.units * state.prices[id];
    }, 0);
  }

  function businessValue(state) {
    return state.businesses.reduce((sum, owned) => {
      const spec = getBusiness(owned.type);
      if (!spec) return sum;
      const annualProfit = spec.monthlyRevenue * 12 * spec.margin * owned.scale * owned.health;
      return sum + Math.max(spec.cost * 0.35, annualProfit * spec.multiple);
    }, 0);
  }

  function propertyEquity(state) {
    return state.properties.reduce((sum, property) => sum + property.value - property.mortgage, 0);
  }

  function loanBalance(state) {
    return state.loans.reduce((sum, loan) => sum + loan.principal, 0) + state.consumerDebt;
  }

  function netWorth(state) {
    return round(state.cash + portfolioValue(state) + businessValue(state) + propertyEquity(state) - state.marginLoan - loanBalance(state));
  }

  function liquidNetWorth(state) {
    return round(state.cash + portfolioValue(state) - state.marginLoan - state.consumerDebt);
  }

  function allocation(state) {
    const values = {};
    Object.entries(state.portfolio).forEach(([id, holding]) => {
      const asset = getAsset(id);
      if (!asset) return;
      values[asset.class] = (values[asset.class] || 0) + holding.units * state.prices[id];
    });
    if (state.properties.length) values["Real Estate"] = propertyEquity(state);
    if (state.businesses.length) values.Businesses = businessValue(state);
    values.Cash = Math.max(0, state.cash);
    return values;
  }

  function recordGain(state, gain, heldMonths) {
    const ledger = taxLedger(state);
    if (heldMonths >= 12) ledger.longGains += gain;
    else ledger.shortGains += gain;
    state.stats.realizedGains += gain;
  }

  function buyAsset(state, assetId, dollars) {
    const asset = getAsset(assetId);
    dollars = Number(dollars);
    if (!asset || state.year < (asset.unlockYear || START_YEAR)) return { ok: false, message: "That market is not available yet." };
    if (!Number.isFinite(dollars) || dollars < 100) return { ok: false, message: "Minimum order is $100." };
    if (state.cash < dollars) return { ok: false, message: "Not enough available cash." };
    const slippage = dollars > 1000000 ? 0.0015 : 0.0005;
    const fee = Math.max(1, dollars * slippage);
    const invested = dollars - fee;
    const units = invested / state.prices[assetId];
    const current = state.portfolio[assetId] || { units: 0, costBasis: 0, firstBought: state.monthsElapsed };
    current.units += units;
    current.costBasis += dollars;
    current.firstBought = Math.min(current.firstBought, state.monthsElapsed);
    state.portfolio[assetId] = current;
    state.cash -= dollars;
    state.actions += 1;
    log(state, "trade", `Bought ${asset.symbol}`, `${round(units, 4)} units including execution cost`, -dollars);
    addLesson(state, "time", `You exchanged liquid cash for ${asset.name}; the expected return now must compensate for risk and time.`);
    checkBadges(state);
    return { ok: true, message: `Invested $${Math.round(dollars).toLocaleString()} in ${asset.symbol}.` };
  }

  function sellAsset(state, assetId, dollars) {
    const asset = getAsset(assetId);
    const holding = state.portfolio[assetId];
    if (!asset || !holding) return { ok: false, message: "You do not own that asset." };
    const marketValue = holding.units * state.prices[assetId];
    const gross = dollars === "all" ? marketValue : Math.min(Number(dollars), marketValue);
    if (!Number.isFinite(gross) || gross < 25) return { ok: false, message: "Order is too small." };
    const fraction = gross / marketValue;
    const basis = holding.costBasis * fraction;
    const fee = Math.max(1, gross * 0.0005);
    const proceeds = gross - fee;
    const gain = proceeds - basis;
    holding.units *= 1 - fraction;
    holding.costBasis -= basis;
    if (holding.units < 1e-8) delete state.portfolio[assetId];
    state.cash += proceeds;
    recordGain(state, gain, elapsedSince(holding.firstBought, state));
    state.actions += 1;
    log(state, "trade", `Sold ${asset.symbol}`, `${gain >= 0 ? "Realized gain" : "Realized loss"} of $${Math.abs(Math.round(gain)).toLocaleString()}`, proceeds);
    return { ok: true, message: `Sold $${Math.round(gross).toLocaleString()} of ${asset.symbol}.` };
  }

  function buyBusiness(state, businessId) {
    const spec = getBusiness(businessId);
    if (!spec || state.year < spec.unlockYear) return { ok: false, message: "That venture has not reached commercial maturity." };
    const setup = spec.cost * 1.04;
    if (state.cash < setup) return { ok: false, message: "You need the purchase price plus 4% setup liquidity." };
    const owned = {
      id: uid(state, "biz"), type: businessId, boughtAt: state.monthsElapsed,
      basis: setup, scale: 1, health: 1, reinvest: 0.1, lastProfit: 0, lifetimeProfit: 0
    };
    state.businesses.push(owned);
    state.cash -= setup;
    state.reputation = clamp(state.reputation + 2, 0, 100);
    state.actions += 1;
    log(state, "business", `Opened ${spec.name}`, "Startup costs include working capital and formation expenses.", -setup);
    addLesson(state, "calculation", "Monthly profit will test whether customers value the venture above all inputs consumed.");
    checkBadges(state);
    return { ok: true, message: `${spec.name} is operating.` };
  }

  function upgradeBusiness(state, ownedId) {
    const owned = state.businesses.find((item) => item.id === ownedId);
    if (!owned) return { ok: false, message: "Business not found." };
    const spec = getBusiness(owned.type);
    const cost = spec.cost * (0.42 + owned.scale * 0.18);
    if (state.cash < cost) return { ok: false, message: "Insufficient cash for this expansion." };
    state.cash -= cost;
    owned.basis += cost;
    owned.scale *= 1.5;
    owned.health = clamp(owned.health + 0.04, 0.4, 1.25);
    log(state, "business", `Expanded ${spec.name}`, "Capacity rose 50%; fixed costs and execution risk rose too.", -cost);
    addLesson(state, "capital", "Expansion commits specific capital that cannot instantly become something else.");
    return { ok: true, message: "Expansion completed." };
  }

  function setReinvestment(state, ownedId, rate) {
    const owned = state.businesses.find((item) => item.id === ownedId);
    if (!owned) return { ok: false, message: "Business not found." };
    owned.reinvest = clamp(Number(rate), 0, 0.5);
    return { ok: true, message: `Reinvestment set to ${Math.round(owned.reinvest * 100)}%.` };
  }

  function sellBusiness(state, ownedId) {
    const index = state.businesses.findIndex((item) => item.id === ownedId);
    if (index < 0) return { ok: false, message: "Business not found." };
    const owned = state.businesses[index];
    const spec = getBusiness(owned.type);
    const value = businessValue({ ...state, businesses: [owned] }) * 0.94;
    const gain = value - owned.basis;
    state.businesses.splice(index, 1);
    state.cash += value;
    recordGain(state, gain, elapsedSince(owned.boughtAt, state));
    log(state, "business", `Sold ${spec.name}`, "Broker and legal costs reduced proceeds by 6%.", value);
    return { ok: true, message: `Business sold for $${Math.round(value).toLocaleString()}.` };
  }

  function buyProperty(state, propertyId) {
    const spec = getProperty(propertyId);
    if (!spec || state.year < (spec.unlockYear || START_YEAR)) return { ok: false, message: "That property type is not available yet." };
    const downPayment = spec.price * spec.down;
    const closing = spec.price * 0.03;
    if (state.cash < downPayment + closing) return { ok: false, message: "You need the down payment plus 3% closing costs." };
    const principal = spec.price - downPayment;
    const commercial = !["duplex", "farmland"].includes(spec.id);
    const rate = (state.metrics.fedRate + (commercial ? 2.8 : 2.5)) / 100;
    const term = commercial ? 240 : 360;
    state.properties.push({
      id: uid(state, "property"), type: propertyId, boughtAt: state.monthsElapsed,
      basis: spec.price + closing, value: spec.price, mortgage: principal, rate,
      payment: amortizedPayment(principal, rate, term), monthsRemaining: term,
      occupied: true, lastCashFlow: 0
    });
    state.cash -= downPayment + closing;
    log(state, "property", `Acquired ${spec.name}`, `${Math.round(spec.down * 100)}% down at ${(rate * 100).toFixed(2)}% fixed`, -(downPayment + closing));
    addLesson(state, "signals", "The mortgage rate changes the value of future rents and your margin of safety.");
    checkBadges(state);
    return { ok: true, message: `${spec.name} acquired.` };
  }

  function sellProperty(state, ownedId) {
    const index = state.properties.findIndex((item) => item.id === ownedId);
    if (index < 0) return { ok: false, message: "Property not found." };
    const property = state.properties[index];
    const spec = getProperty(property.type);
    const saleCosts = property.value * 0.06;
    const proceeds = property.value - saleCosts - property.mortgage;
    const gain = property.value - saleCosts - property.basis;
    state.properties.splice(index, 1);
    state.cash += proceeds;
    recordGain(state, gain, elapsedSince(property.boughtAt, state));
    log(state, "property", `Sold ${spec.name}`, "Mortgage retired; selling costs were 6%.", proceeds);
    return { ok: true, message: `Property sold with $${Math.round(proceeds).toLocaleString()} in equity proceeds.` };
  }

  function takeLoan(state, amount) {
    amount = Number(amount);
    const maximum = Math.max(25000, Math.min(500000, Math.max(0, netWorth(state)) * 0.3 + state.salary * 2));
    const outstanding = state.loans.filter((loan) => loan.type === "Business term loan").reduce((sum, loan) => sum + loan.principal, 0);
    if (!Number.isFinite(amount) || amount < 5000) return { ok: false, message: "Minimum term loan is $5,000." };
    if (outstanding + amount > maximum) return { ok: false, message: `Lenders cap your business credit near $${Math.round(maximum).toLocaleString()}.` };
    const rate = (state.metrics.fedRate + 5.25 + Math.max(0, 50 - state.reputation) * 0.035) / 100;
    const months = 60;
    state.loans.push({
      id: uid(state, "loan"), type: "Business term loan", principal: amount,
      rate, monthsRemaining: months, payment: amortizedPayment(amount, rate, months)
    });
    state.cash += amount;
    log(state, "credit", "Term loan funded", `Five-year amortization at ${(rate * 100).toFixed(2)}%`, amount);
    addLesson(state, "signals", "Borrowed money accelerates both good judgment and mistakes; the payment does not care which occurred.");
    return { ok: true, message: `$${Math.round(amount).toLocaleString()} added to cash.` };
  }

  function repayLoan(state, loanId, amount) {
    const loan = state.loans.find((item) => item.id === loanId);
    if (!loan) return { ok: false, message: "Loan not found." };
    amount = Math.min(Number(amount), loan.principal, state.cash);
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "No cash available for that payment." };
    loan.principal -= amount;
    state.cash -= amount;
    if (loan.principal === 0) state.loans = state.loans.filter((item) => item.id !== loanId);
    log(state, "credit", "Principal prepaid", loan.type, -amount);
    return { ok: true, message: `Repaid $${Math.round(amount).toLocaleString()}.` };
  }

  function eligibleMarginValue(state) {
    return portfolioValue(state, (asset) => ["Stocks", "Bonds"].includes(asset.class) && !["space", "ai"].includes(asset.id));
  }

  function marginStatus(state) {
    const collateral = eligibleMarginValue(state);
    const equity = collateral - state.marginLoan;
    return {
      collateral: round(collateral), equity: round(equity),
      ratio: collateral > 0 ? equity / collateral : 1,
      initialCapacity: round(Math.max(0, collateral * 0.5 - state.marginLoan)),
      maintenance: 0.30,
      rate: (state.metrics.fedRate + 4) / 100
    };
  }

  function borrowMargin(state, amount) {
    amount = Number(amount);
    const status = marginStatus(state);
    if (!Number.isFinite(amount) || amount < 1000) return { ok: false, message: "Minimum margin draw is $1,000." };
    if (amount > status.initialCapacity) return { ok: false, message: "That exceeds 50% initial margin capacity." };
    state.marginLoan += amount;
    state.cash += amount;
    log(state, "credit", "Margin cash drawn", `Variable rate currently ${(status.rate * 100).toFixed(2)}%`, amount);
    addLesson(state, "cantillon", "Easy collateral credit increases your buying power before it changes the supply of real goods.");
    return { ok: true, message: `$${Math.round(amount).toLocaleString()} borrowed on margin.` };
  }

  function repayMargin(state, amount) {
    amount = Math.min(Number(amount), state.marginLoan, Math.max(0, state.cash));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "No margin balance can be repaid from cash." };
    state.marginLoan -= amount;
    state.cash -= amount;
    log(state, "credit", "Margin principal repaid", "Reduced variable-rate exposure.", -amount);
    return { ok: true, message: `Margin reduced by $${Math.round(amount).toLocaleString()}.` };
  }

  function openOption(state, assetId, direction, premium) {
    const asset = getAsset(assetId);
    premium = Number(premium);
    if (!asset || !["vti", "ai", "btc"].includes(assetId)) return { ok: false, message: "Options are not listed for that asset here." };
    if (!["call", "put"].includes(direction)) return { ok: false, message: "Choose call or put." };
    if (!Number.isFinite(premium) || premium < 250 || state.cash < premium) return { ok: false, message: "Premium must be at least $250 and paid in cash." };
    const spot = state.prices[assetId];
    const strike = spot * (direction === "call" ? 1.05 : 0.95);
    const quote = Math.max(spot * asset.vol * Math.sqrt(0.5) * 0.42, spot * 0.025);
    const contracts = premium / (quote * 100);
    state.derivatives.push({
      id: uid(state, "option"), type: "option", assetId, direction, premium,
      strike, contracts, opened: state.monthsElapsed, expiry: state.monthsElapsed + 6
    });
    state.cash -= premium;
    log(state, "derivative", `${asset.symbol} ${direction.toUpperCase()} opened`, `6-month strike $${round(strike).toLocaleString()}; premium can expire worthless.`, -premium);
    addLesson(state, "time", "Option value decays because the right has a deadline. Direction alone is not enough; timing and price matter.");
    return { ok: true, message: `${direction} position opened.` };
  }

  function openFuture(state, assetId, direction, margin) {
    const asset = getAsset(assetId);
    margin = Number(margin);
    if (!asset || !["energy", "copper", "btc"].includes(assetId)) return { ok: false, message: "Futures are unavailable for that market." };
    if (!["long", "short"].includes(direction)) return { ok: false, message: "Choose long or short." };
    if (!Number.isFinite(margin) || margin < 500 || state.cash < margin) return { ok: false, message: "Initial futures margin must be at least $500 cash." };
    state.cash -= margin;
    state.derivatives.push({
      id: uid(state, "future"), type: "future", assetId, direction, initialMargin: margin,
      marginBalance: margin, marginTopUps: 0, notional: margin * 8, entry: state.prices[assetId], lastPrice: state.prices[assetId],
      opened: state.monthsElapsed, expiry: state.monthsElapsed + 6
    });
    log(state, "derivative", `${asset.symbol} future opened`, `8x notional exposure; losses settle monthly.`, -margin);
    addLesson(state, "signals", "Futures transfer price risk, but leverage turns small forecast errors into cash demands.");
    return { ok: true, message: `${direction} future opened.` };
  }

  function closeDerivative(state, derivativeId) {
    const derivative = state.derivatives.find((item) => item.id === derivativeId);
    if (!derivative) return { ok: false, message: "Position not found." };
    settleDerivative(state, derivative, true);
    state.derivatives = state.derivatives.filter((item) => item.id !== derivativeId);
    return { ok: true, message: "Derivative position closed." };
  }

  function optionValue(state, option, includeTime = true) {
    const spot = state.prices[option.assetId];
    const intrinsic = option.direction === "call" ? Math.max(0, spot - option.strike) : Math.max(0, option.strike - spot);
    const monthsLeft = Math.max(0, option.expiry - state.monthsElapsed);
    const asset = getAsset(option.assetId);
    const timeValue = includeTime ? spot * asset.vol * Math.sqrt(monthsLeft / 12) * 0.22 : 0;
    return option.contracts * 100 * (intrinsic + timeValue);
  }

  function futureGain(future) {
    // Maintenance deposits are additional player capital, not trading gains.
    // Older saves did not record past top-ups.
    return future.marginBalance - future.initialMargin - (future.marginTopUps ?? 0);
  }

  function settleDerivative(state, derivative, voluntary) {
    const asset = getAsset(derivative.assetId);
    if (derivative.type === "option") {
      const proceeds = optionValue(state, derivative, voluntary);
      state.cash += proceeds;
      recordGain(state, proceeds - derivative.premium, elapsedSince(derivative.opened, state));
      log(state, "derivative", `${asset.symbol} option ${voluntary ? "closed" : "expired"}`, proceeds > 0 ? "Remaining value settled in cash." : "The premium expired worthless.", proceeds);
      return proceeds;
    }
    state.cash += Math.max(0, derivative.marginBalance);
    const gain = futureGain(derivative);
    recordGain(state, gain, elapsedSince(derivative.opened, state));
    log(state, "derivative", `${asset.symbol} future closed`, `${gain >= 0 ? "Net gain" : "Net loss"} $${Math.abs(Math.round(gain)).toLocaleString()}`, Math.max(0, derivative.marginBalance));
    return Math.max(0, derivative.marginBalance);
  }

  function processIncome(state) {
    const ledger = taxLedger(state);
    const gross = state.salary;
    const annualizedFederal = progressiveTax(Math.max(0, gross * 12 - 16100), state.year) / 12;
    const payroll = gross * 0.0765;
    const stateWithholding = gross * 0.045;
    const withholding = annualizedFederal + payroll + stateWithholding;
    state.cash += gross - withholding;
    ledger.wages += gross;
    ledger.withheld += withholding;
    state.stats.earned += gross;
    state.stats.taxes += withholding;

    const inflationMonthly = state.metrics.inflation / 100 / 12;
    state.livingExpenses *= 1 + inflationMonthly;
    state.cash -= state.livingExpenses;
    state.stats.spent += state.livingExpenses;

    if (state.consumerDebt > 0) {
      const interest = state.consumerDebt * state.consumerDebtRate / 12;
      const payment = Math.min(state.consumerDebt + interest, Math.max(350, state.consumerDebt * 0.025));
      const principal = Math.max(0, payment - interest);
      state.consumerDebt -= principal;
      state.cash -= payment;
      state.stats.interest += interest;
    }
  }

  function processBusinesses(state) {
    const ledger = taxLedger(state);
    state.businesses.forEach((owned) => {
      const spec = getBusiness(owned.type);
      const cycle = 1 + (state.metrics.realGrowth - 2) / 100 * (0.35 + spec.risk);
      const tech = 1 + state.modifiers.aiTrend * spec.ai * 0.12;
      const laborPressure = 1 - Math.max(0, 4 - state.metrics.unemployment) / 100 * spec.labor;
      const energyPressure = 1 - Math.max(0, state.metrics.inflation - 2) / 100 * spec.energy * 0.18;
      const noise = 1 + normal(state) * spec.risk * 0.22;
      const maturityGrowth = 1 + spec.growth / 12;
      owned.scale *= maturityGrowth + owned.reinvest * 0.015;
      owned.health = clamp(owned.health + normal(state) * 0.012 - Math.max(0, -state.metrics.realGrowth) * spec.risk * 0.006, 0.5, 1.2);

      const temporaryBoost = owned.eventBoost?.months > 0 ? 1 + owned.eventBoost.strength : 1;
      const revenue = spec.monthlyRevenue * owned.scale * owned.health * cycle * tech * noise * temporaryBoost;
      const margin = clamp(spec.margin * laborPressure * energyPressure, 0.03, 0.55);
      const operatingProfit = revenue * margin;
      const reinvestment = Math.max(0, operatingProfit * owned.reinvest);
      const distribution = operatingProfit - reinvestment;
      owned.lastProfit = distribution;
      owned.lifetimeProfit += distribution;
      owned.basis += reinvestment;
      state.cash += distribution;
      ledger.business += operatingProfit - reinvestment;
      state.stats.businessProfit += distribution;

      if (owned.eventBoost?.months > 0) owned.eventBoost.months -= 1;

      if (random(state) < spec.risk * 0.012) {
        const setback = Math.max(spec.cost * 0.025, revenue * 0.55);
        state.cash -= setback;
        owned.health = clamp(owned.health - 0.12, 0.45, 1.2);
        log(state, "warning", `${spec.name}: operating setback`, "A customer loss, repair, or compliance cost hit cash flow.", -setback);
      }
    });
  }

  function processProperties(state) {
    const ledger = taxLedger(state);
    state.properties.forEach((owned) => {
      const spec = getProperty(owned.type);
      if (owned.occupied && random(state) < 0.012 + Math.max(0, state.metrics.unemployment - 5) * 0.004) {
        owned.occupied = false;
        log(state, "warning", `${spec.name}: vacancy`, "Rent stops until a replacement tenant is found.");
      } else if (!owned.occupied && random(state) < 0.28) {
        owned.occupied = true;
        log(state, "property", `${spec.name}: tenant placed`, "Leasing resumes next month.");
      }

      const rent = owned.occupied ? spec.rent * Math.pow(1 + state.metrics.inflation / 100, elapsedSince(owned.boughtAt, state) / 12) : 0;
      const expenses = spec.rent * spec.expenses;
      const interest = owned.mortgage * owned.rate / 12;
      // Cap the installment at the payoff amount; paid-off properties have no debt service.
      const payoff = owned.mortgage + interest;
      const payment = Math.min(payoff, owned.payment);
      owned.mortgage = payment === payoff ? 0 : owned.mortgage - Math.max(0, payment - interest);
      owned.monthsRemaining = owned.mortgage === 0 ? 0 : Math.max(0, owned.monthsRemaining - 1);
      const cashFlow = rent - expenses - payment;
      owned.lastCashFlow = cashFlow;
      state.cash += cashFlow;
      ledger.business += rent - expenses - interest;
      ledger.depreciation += owned.basis * 0.8 / (spec.id === "duplex" ? 27.5 : 39) / 12;
      state.stats.rentProfit += cashFlow;
      state.stats.interest += interest;

      const rateDrag = (state.metrics.fedRate - state.metrics.priorFedRate) * -0.035;
      const monthlyReturn = spec.appreciation / 12 + state.modifiers.property / 12 + rateDrag + normal(state) * spec.vol / Math.sqrt(12);
      owned.value *= Math.max(0.82, 1 + monthlyReturn);
      if (random(state) < spec.capexRisk / 12) {
        const capex = owned.value * (0.008 + random(state) * 0.018);
        state.cash -= capex;
        log(state, "warning", `${spec.name}: capital repair`, "Ownership cash flow is not the same as rent collected.", -capex);
      }
    });
  }

  function processDebt(state) {
    state.loans = state.loans.filter((loan) => {
      const interest = loan.principal * loan.rate / 12;
      const payment = Math.min(loan.principal + interest, loan.payment);
      const principal = Math.max(0, payment - interest);
      loan.principal -= principal;
      loan.monthsRemaining -= 1;
      state.cash -= payment;
      state.stats.interest += interest;
      if (loan.principal < 1 || loan.monthsRemaining <= 0) {
        log(state, "credit", `${loan.type} retired`, "The final scheduled payment cleared.");
        return false;
      }
      return true;
    });

    if (state.marginLoan > 0) {
      const interest = state.marginLoan * marginStatus(state).rate / 12;
      state.cash -= interest;
      state.stats.interest += interest;
    }
  }

  function processDividends(state) {
    const ledger = taxLedger(state);
    Object.entries(state.portfolio).forEach(([id, holding]) => {
      const asset = getAsset(id);
      const yieldRate = asset.id === "tbill" ? Math.max(0.002, (state.metrics.fedRate - 0.2) / 100) : asset.yield;
      if (!yieldRate) return;
      const distribution = holding.units * state.prices[id] * yieldRate / 12;
      state.cash += distribution;
      if (asset.class === "Bonds") ledger.interest += distribution;
      else ledger.dividends += distribution;
    });
  }

  function updateMacro(state) {
    state.metrics.priorFedRate = state.metrics.fedRate;
    const demand = state.metrics.creditImpulse * 0.15;
    state.metrics.realGrowth = clamp(
      state.metrics.realGrowth + (1.8 - state.metrics.realGrowth) * 0.08 + demand + normal(state) * 0.22,
      -4.5, 6.5
    );
    state.metrics.inflation = clamp(
      state.metrics.inflation + (2.1 - state.metrics.inflation) * 0.055 + Math.max(0, state.metrics.realGrowth - 3) * 0.025 + normal(state) * 0.09,
      -0.8, 9.5
    );
    state.metrics.unemployment = clamp(
      state.metrics.unemployment + (4.5 - state.metrics.unemployment) * 0.07 - (state.metrics.realGrowth - 1.8) * 0.045 + normal(state) * 0.06,
      2.6, 12.5
    );
    if (state.month % 3 === 0) {
      const desired = clamp(2.5 + (state.metrics.inflation - 2) * 0.65 + (state.metrics.realGrowth - 2) * 0.18, 0.1, 9.5);
      state.metrics.fedRate = clamp(state.metrics.fedRate + clamp(desired - state.metrics.fedRate, -0.5, 0.5), 0.1, 9.5);
    }
    state.metrics.yield10 = clamp(state.metrics.fedRate * 0.55 + 2.15 + state.metrics.inflation * 0.12 + normal(state) * 0.08, 1.1, 10.5);
    state.metrics.riskAppetite = clamp(state.metrics.riskAppetite * 0.72 + (state.metrics.realGrowth - 1.5) * 0.025 + normal(state) * 0.045, -0.45, 0.45);
    state.metrics.creditImpulse = clamp(state.metrics.creditImpulse * 0.75 - (state.metrics.fedRate - 3) * 0.02 + normal(state) * 0.035, -0.4, 0.4);
    state.metrics.moneyGrowth = clamp(4.2 + state.metrics.creditImpulse * 5 + normal(state) * 0.25, -1, 12);

    if (state.modifiers.months > 0) {
      state.modifiers.months -= 1;
      ["aiTrend", "spaceTrend", "energyTrend", "cryptoTrend", "property", "wageGrowth"].forEach((key) => {
        state.modifiers[key] *= 0.94;
      });
    }
    const annualWageGrowth = 0.018 + state.metrics.inflation / 100 * 0.55 + state.modifiers.wageGrowth;
    state.salary *= 1 + annualWageGrowth / 12;
  }

  function updateMarkets(state) {
    const deltaRate = state.metrics.fedRate - state.metrics.priorFedRate;
    Data.ASSETS.forEach((asset) => {
      let trend = 0;
      if (asset.id === "ai") trend += state.modifiers.aiTrend;
      if (asset.id === "space") trend += state.modifiers.spaceTrend;
      if (["energy", "copper"].includes(asset.id)) trend += state.modifiers.energyTrend;
      if (["btc", "eth"].includes(asset.id)) trend += state.modifiers.cryptoTrend;
      const macro = ((state.metrics.realGrowth - 1.8) / 100) * (asset.growthBeta || 0);
      const inflation = ((state.metrics.inflation - 2.1) / 100) * (asset.inflationBeta || 0);
      const rateMove = (deltaRate / 100) * (asset.rateBeta || 0);
      const sentiment = state.metrics.riskAppetite * asset.vol * 0.04;
      const shock = normal(state) * asset.vol / Math.sqrt(12);
      let annualDrift = asset.drift + macro + inflation + trend;
      if (asset.id === "tbill") annualDrift = Math.max(0.002, (state.metrics.fedRate - 0.2) / 100);
      let monthlyReturn = annualDrift / 12 + rateMove + sentiment + shock;
      if (monthlyReturn < 0 && state.shockShield?.months > 0) monthlyReturn *= 1 - state.shockShield.strength;
      state.prices[asset.id] = round(Math.max(asset.price * 0.08, state.prices[asset.id] * (1 + clamp(monthlyReturn, -0.42, 0.55))), 4);
      const history = state.priceHistory[asset.id];
      history.push(state.prices[asset.id]);
      if (history.length > 241) history.shift();
    });
    if (state.shockShield?.months > 0) state.shockShield.months -= 1;
  }

  function processDerivatives(state) {
    // Prices already reflect this advance; the month counter updates afterward.
    const settlementMonth = state.monthsElapsed + 1;
    const survivors = [];
    state.derivatives.forEach((derivative) => {
      if (derivative.type === "future") {
        const price = state.prices[derivative.assetId];
        const direction = derivative.direction === "long" ? 1 : -1;
        const pnl = derivative.notional * direction * (price / derivative.lastPrice - 1);
        derivative.marginBalance += pnl;
        derivative.lastPrice = price;
        if (derivative.marginBalance < derivative.initialMargin * 0.45) {
          const available = Math.max(0, state.cash);
          const topUp = Math.min(available, derivative.initialMargin - derivative.marginBalance);
          state.cash -= topUp;
          derivative.marginBalance += topUp;
          derivative.marginTopUps = (derivative.marginTopUps ?? 0) + topUp;
          if (derivative.marginBalance < derivative.initialMargin * 0.45) {
            state.cash += Math.max(0, derivative.marginBalance);
            recordGain(state, futureGain(derivative), elapsedSince(derivative.opened, state));
            log(state, "warning", "Futures position liquidated", "Maintenance margin could not be restored.", Math.max(0, derivative.marginBalance));
            return;
          }
        }
      }
      if (settlementMonth >= derivative.expiry) settleDerivative(state, derivative, false);
      else survivors.push(derivative);
    });
    state.derivatives = survivors;
  }

  function processOpportunities(state) {
    const active = [];
    state.opportunities.forEach((project) => {
      project.monthsRemaining -= 1;
      if (project.monthsRemaining > 0) {
        active.push(project);
        return;
      }
      const success = random(state) < project.successChance;
      const payout = success ? project.stake * project.payoutMultiple : project.stake * project.recoveryRate;
      const profit = payout - project.stake;
      state.cash += payout;
      // The project just completed this advance, before the campaign counter increments.
      recordGain(state, profit, elapsedSince(project.startedAt, state) + 1);
      state.knowledge = clamp(state.knowledge + (success ? 1 : 3), 0, 100);
      state.reputation = clamp(state.reputation + (success ? 3 : -1), 0, 100);
      state.pendingOutcome = {
        id: project.id,
        success,
        title: success ? `${project.name} pays off` : `${project.name} misses its target`,
        body: success
          ? `The project found paying demand and returned ${project.payoutMultiple.toFixed(1)}× the committed capital.`
          : `The thesis did not convert into enough customer value. Salvage recovered ${Math.round(project.recoveryRate * 100)}% of the stake.`,
        stake: project.stake,
        payout,
        profit,
        lesson: success ? "A successful forecast matters only when it becomes a cash-generating transaction." : "Small experiments make being wrong survivable and informative."
      };
      log(state, success ? "opportunity" : "warning", state.pendingOutcome.title, state.pendingOutcome.body, payout);
    });
    state.opportunities = active;
  }

  function applyEffects(state, effects) {
    if (!effects) return;
    if (effects.rate) state.metrics.fedRate = clamp(state.metrics.fedRate + effects.rate, 0.1, 9.5);
    if (effects.inflation) state.metrics.inflation = clamp(state.metrics.inflation + effects.inflation, -0.8, 9.5);
    if (effects.growth) state.metrics.realGrowth = clamp(state.metrics.realGrowth + effects.growth, -4.5, 6.5);
    if (effects.risk) state.metrics.riskAppetite = clamp(state.metrics.riskAppetite + effects.risk, -0.45, 0.45);
    ["aiTrend", "spaceTrend", "energyTrend", "cryptoTrend", "property", "wageGrowth"].forEach((key) => {
      if (effects[key]) state.modifiers[key] += effects[key];
    });
    state.modifiers.months = Math.max(state.modifiers.months, 12);
  }

  function randomEventEligible(state, event) {
    switch (event.condition) {
      case "cooling_inflation": return state.metrics.inflation > 2.3 && state.metrics.realGrowth > 0.5;
      case "energy_pressure": return state.metrics.inflation > 2.4 || state.modifiers.energyTrend > 0.03;
      case "slowdown": return state.metrics.realGrowth < 1.2 || state.metrics.unemployment > 5;
      case "technology_maturing": return state.year >= 2028 && state.metrics.realGrowth > 0;
      case "risk_euphoria": return state.metrics.riskAppetite > 0.1 || state.metrics.creditImpulse > 0.18;
      case "housing_pressure": return state.metrics.fedRate > 4 || state.metrics.inflation > 3;
      case "policy_window": return state.year >= 2028 && state.metrics.realGrowth < 3.5;
      case "digital_dependence": return state.year >= 2028;
      default: return true;
    }
  }

  function eventContext(state, event) {
    const snapshot = `Inflation is ${state.metrics.inflation.toFixed(1)}%, real growth is ${state.metrics.realGrowth.toFixed(1)}%, and the policy rate is ${state.metrics.fedRate.toFixed(2)}%.`;
    const reasons = {
      cooling_inflation: "Price pressure is still above target while the economy remains out of recession.",
      energy_pressure: "Elevated inflation and constrained power investment leave the economy exposed to another supply shock.",
      slowdown: "Growth or employment has weakened enough for local stress to spread through credit.",
      technology_maturing: "Several years of AI investment are now reaching operating workflows and measured output.",
      risk_euphoria: "Strong risk appetite or accelerating credit has crowded investors into similar positions.",
      housing_pressure: "High financing costs and persistent inflation have discouraged enough new construction to tighten supply.",
      policy_window: "Slower activity has made reducing permitting and formation costs politically attractive.",
      digital_dependence: "The economy now relies heavily enough on shared digital infrastructure for a concentrated outage to matter."
    };
    if (event.condition && reasons[event.condition]) return `${reasons[event.condition]} ${snapshot}`;
    return `This scheduled technology milestone enters the commercial scenario in ${currentDate(state).label}. ${snapshot}`;
  }

  function describeEffects(effects) {
    const descriptions = [];
    if (effects.rate) descriptions.push(`policy rate ${effects.rate > 0 ? "+" : ""}${Math.round(effects.rate * 100)} bps`);
    if (effects.inflation) descriptions.push(`inflation ${effects.inflation > 0 ? "+" : ""}${effects.inflation.toFixed(2)} points`);
    if (effects.growth) descriptions.push(`real growth ${effects.growth > 0 ? "+" : ""}${effects.growth.toFixed(2)} points`);
    if (effects.risk) descriptions.push(`risk sentiment ${effects.risk > 0 ? "+" : ""}${Math.round(effects.risk * 100)} points`);
    if (effects.property) descriptions.push(`property trend ${effects.property > 0 ? "+" : ""}${Math.round(effects.property * 100)}% annualized`);
    if (effects.aiTrend) descriptions.push(`AI trend ${effects.aiTrend > 0 ? "+" : ""}${Math.round(effects.aiTrend * 100)}% annualized`);
    if (effects.spaceTrend) descriptions.push(`space trend ${effects.spaceTrend > 0 ? "+" : ""}${Math.round(effects.spaceTrend * 100)}% annualized`);
    if (effects.energyTrend) descriptions.push(`energy trend ${effects.energyTrend > 0 ? "+" : ""}${Math.round(effects.energyTrend * 100)}% annualized`);
    if (effects.cryptoTrend) descriptions.push(`digital-asset trend ${effects.cryptoTrend > 0 ? "+" : ""}${Math.round(effects.cryptoTrend * 100)}% annualized`);
    if (effects.wageGrowth) descriptions.push(`wage trend ${effects.wageGrowth > 0 ? "+" : ""}${(effects.wageGrowth * 100).toFixed(1)}% annualized`);
    return descriptions;
  }

  function eventSector(event) {
    const effects = event.effects || {};
    if (effects.aiTrend) return "ai";
    if (effects.spaceTrend) return "space";
    if (effects.energyTrend) return "energy";
    if (effects.cryptoTrend) return "crypto";
    if (effects.property) return "property";
    return "macro";
  }

  function buildEventChoices(state, event) {
    const sector = eventSector(event);
    const labels = {
      ai: ["Fund an automation pilot", "Test a narrow workflow with six months of committed capital."],
      space: ["Back a launch-services pilot", "Fund a small commercial test around the emerging space supply chain."],
      energy: ["Secure a power project", "Commit capital to scarce generation, storage, or grid capacity."],
      crypto: ["Back a settlement pilot", "Test whether the new digital rails solve a real transaction problem."],
      property: ["Buy distressed optionality", "Fund a small property strategy while competitors reprice risk."],
      macro: ["Finance a customer sprint", "Commit capital to a time-limited commercial response to the new conditions."]
    };
    const directionalTailwind = Object.entries(event.effects || {}).some(([key, value]) =>
      ["growth", "risk", "property", "aiTrend", "spaceTrend", "energyTrend", "cryptoTrend"].includes(key) && value > 0
    );
    const stake = round(clamp(Math.max(5000, Math.max(0, state.cash) * 0.08), 5000, 75000));
    const pilot = {
      id: "pilot", kind: "pilot", label: labels[sector][0], description: labels[sector][1],
      cost: stake, sector, months: sector === "space" ? 9 : 6,
      successChance: clamp(0.46 + state.knowledge * 0.0015 + (directionalTailwind ? 0.06 : 0), 0.46, 0.68),
      payoutMultiple: sector === "space" ? 2.5 : 2.1, recoveryRate: sector === "property" ? 0.45 : 0.2
    };
    const choices = [pilot];
    if (state.businesses.length) {
      choices.push({
        id: "operate", kind: "operate", label: "Reconfigure your operations",
        description: "Spend now to improve execution and revenue across owned businesses for six months.",
        cost: round(clamp(businessValue(state) * 0.02, 1500, 50000)), strength: 0.12, months: 6
      });
    } else if (portfolioValue(state) >= 1000) {
      choices.push({
        id: "protect", kind: "protect", label: "Buy six-month protection",
        description: "Reduce negative public-market returns by 35%. The premium is spent even if markets rise.",
        cost: round(clamp(portfolioValue(state) * 0.012, 500, 25000)), strength: 0.35, months: 6
      });
    } else {
      choices.push({
        id: "economize", kind: "economize", label: "Tighten the household budget",
        description: "Cut optional spending by 3% and preserve more monthly cash for later opportunities.",
        cost: 0
      });
    }
    choices.push({
      id: "hold", kind: "hold", label: "Preserve liquidity",
      description: "Make no special commitment. Keep cash flexible and learn from how the event unfolds.",
      cost: 0
    });
    return choices;
  }

  function resolveEventChoice(state, choiceId) {
    const event = state.pendingEvent;
    if (!event) return { ok: false, message: "There is no event decision waiting." };
    const choice = (event.choices || []).find((candidate) => candidate.id === choiceId);
    if (!choice) return { ok: false, message: "That response is not available." };
    if (choice.cost > state.cash) return { ok: false, message: `You need ${Math.round(choice.cost).toLocaleString()} in available cash for that response.` };
    state.cash -= choice.cost;
    if (choice.kind === "pilot") {
      state.opportunities.push({
        id: uid(state, "project"), name: choice.label, sourceEvent: event.title, sector: choice.sector,
        stake: choice.cost, successChance: choice.successChance, payoutMultiple: choice.payoutMultiple,
        recoveryRate: choice.recoveryRate, monthsRemaining: choice.months, totalMonths: choice.months, startedAt: state.monthsElapsed
      });
      log(state, "opportunity", choice.label, `${choice.months}-month project started with ${Math.round(choice.successChance * 100)}% modeled success odds.`, -choice.cost);
    } else if (choice.kind === "protect") {
      state.shockShield = { strength: choice.strength, months: choice.months };
      log(state, "credit", choice.label, `${Math.round(choice.strength * 100)}% downside reduction is active for ${choice.months} months.`, -choice.cost);
    } else if (choice.kind === "operate") {
      state.businesses.forEach((owned) => {
        owned.eventBoost = { strength: choice.strength, months: choice.months };
        owned.health = clamp(owned.health + 0.03, 0.5, 1.2);
      });
      log(state, "business", choice.label, `Owned ventures receive a ${Math.round(choice.strength * 100)}% revenue boost for ${choice.months} months.`, -choice.cost);
    } else if (choice.kind === "economize") {
      state.livingExpenses *= 0.97;
      state.resilience = clamp(state.resilience + 3, 0, 100);
      log(state, "system", choice.label, "Monthly living expenses were reduced by 3%.");
    } else {
      state.resilience = clamp(state.resilience + 2, 0, 100);
      state.knowledge = clamp(state.knowledge + 1, 0, 100);
      log(state, "system", choice.label, "No capital committed; liquidity and flexibility were preserved.");
    }
    state.choices.push({ eventId: event.id, eventTitle: event.title, choiceId, choiceLabel: choice.label, date: currentDate(state).label });
    state.pendingEvent = null;
    return { ok: true, message: `${choice.label} selected.` };
  }

  function availableDeals(state) {
    const eligible = Data.DEALS.filter((deal) => state.year >= deal.unlockYear);
    if (!eligible.length) return [];
    const quarter = Math.floor(state.month / 3) + 1;
    const rotation = Math.floor(state.monthsElapsed / 3) % eligible.length;
    const selected = [];
    for (let index = 0; index < Math.min(3, eligible.length); index += 1) selected.push(eligible[(rotation + index) % eligible.length]);
    const inflationScale = Math.pow(1.025, Math.max(0, state.year - START_YEAR));
    return selected.map((deal) => {
      const key = `${deal.id}-${state.year}-Q${quarter}`;
      return {
        ...deal,
        key,
        cost: round(deal.stake * inflationScale),
        successChance: clamp(deal.chance + state.knowledge * 0.001 + Math.max(0, state.reputation - 50) * 0.0005, deal.chance, 0.78),
        taken: state.takenDeals.includes(key)
      };
    });
  }

  function takeDeal(state, dealKey) {
    const deal = availableDeals(state).find((candidate) => candidate.key === dealKey);
    if (!deal) return { ok: false, message: "That deal is no longer on the current-quarter board." };
    if (deal.taken) return { ok: false, message: "You already committed to that deal this quarter." };
    if (state.opportunities.length >= 5) return { ok: false, message: "Your team can manage at most five active projects." };
    if (state.cash < deal.cost) return { ok: false, message: `You need ${Math.round(deal.cost).toLocaleString()} in available cash for this deal.` };
    state.cash -= deal.cost;
    state.takenDeals.push(deal.key);
    state.opportunities.push({
      id: uid(state, "project"), name: deal.name, sourceEvent: "Quarterly Deal Board", sector: deal.sector,
      stake: deal.cost, successChance: deal.successChance, payoutMultiple: deal.payoutMultiple,
      recoveryRate: deal.recoveryRate, monthsRemaining: deal.months, totalMonths: deal.months, startedAt: state.monthsElapsed
    });
    log(state, "opportunity", `Deal accepted: ${deal.name}`, `${deal.months}-month commitment with ${Math.round(deal.successChance * 100)}% modeled success odds.`, -deal.cost);
    addLesson(state, "entrepreneur", "A deal is attractive only relative to its price, alternatives, and the cost of being wrong.");
    return { ok: true, message: `${deal.name} added to active projects.` };
  }

  function triggerEvents(state) {
    const scheduled = Data.EVENTS.find((event) =>
      event.year === state.year && event.month === state.month && !state.seenEvents.includes(event.id)
    );
    let event = scheduled;
    if (!event && state.monthsElapsed > 3 && random(state) < 0.045) {
      const eligible = Data.RANDOM_EVENTS.filter((candidate) => randomEventEligible(state, candidate));
      if (eligible.length) {
        const randomEvent = eligible[Math.floor(random(state) * eligible.length)];
        event = { ...randomEvent, id: uid(state, "random-event"), lesson: Data.PRINCIPLES[Math.floor(random(state) * Data.PRINCIPLES.length)].text };
      }
    }
    if (!event) return;
    event = { ...event, context: eventContext(state, event), effectSummary: describeEffects(event.effects) };
    event.choices = buildEventChoices(state, event);
    applyEffects(state, event.effects);
    state.seenEvents.push(event.id);
    state.pendingEvent = deepClone(event);
    log(state, "event", event.title, `${event.body} Modeled effect: ${event.effectSummary.join("; ")}.`);
    state.knowledge = clamp(state.knowledge + 1, 0, 100);
  }

  function dismissEvent(state) {
    state.pendingEvent = null;
  }

  function dismissOutcome(state) {
    state.pendingOutcome = null;
  }

  function enforceMargin(state) {
    const status = marginStatus(state);
    if (state.marginLoan <= 0 || status.ratio >= status.maintenance) return;
    const requiredSale = Math.max(0, status.collateral - status.equity / status.maintenance);
    let remaining = requiredSale;
    const eligible = Object.keys(state.portfolio).filter((id) => {
      const asset = getAsset(id);
      return asset && ["Stocks", "Bonds"].includes(asset.class) && !["space", "ai"].includes(asset.id);
    });
    let proceeds = 0;
    eligible.forEach((id) => {
      if (remaining <= 0) return;
      const holding = state.portfolio[id];
      const value = holding.units * state.prices[id];
      const sale = Math.min(value, remaining);
      const fraction = sale / value;
      const basis = holding.costBasis * fraction;
      holding.units *= 1 - fraction;
      holding.costBasis -= basis;
      if (holding.units < 1e-8) delete state.portfolio[id];
      recordGain(state, sale - basis, elapsedSince(holding.firstBought, state));
      proceeds += sale;
      remaining -= sale;
    });
    const repayment = Math.min(proceeds, state.marginLoan);
    state.marginLoan -= repayment;
    state.stats.marginCalls += 1;
    state.reputation = clamp(state.reputation - 3, 0, 100);
    log(state, "danger", "Broker forced liquidation", `Collateral fell below 30% maintenance equity. $${Math.round(repayment).toLocaleString()} of assets repaid margin.`, -repayment);
    addLesson(state, "optionality", "Leverage removed your ability to choose when to sell.");
  }

  function closeTaxYear(state, year) {
    const ledger = taxLedger(state, year);
    if (ledger.liability !== null) return;
    const tax = calculateTax(ledger);
    ledger.liability = tax.total;
    ledger.breakdown = tax;
    ledger.balance = round(tax.total - ledger.withheld - ledger.estimatedPaid);
    log(state, "tax", `${year} tax year closed`, `${ledger.balance >= 0 ? "Balance due" : "Expected refund"} $${Math.abs(Math.round(ledger.balance)).toLocaleString()} next April.`);
  }

  function settlePriorTaxes(state) {
    if (state.month !== 3) return;
    const ledger = state.taxes[state.year - 1];
    if (!ledger || ledger.settled || ledger.balance === null) return;
    state.cash -= ledger.balance;
    state.stats.taxes += ledger.balance;
    ledger.settled = true;
    log(state, "tax", `${ledger.year} return settled`, ledger.balance >= 0 ? "Federal, payroll, and simplified state balance paid." : "Refund deposited.", -ledger.balance);
  }

  function payEstimatedTaxes(state) {
    if (![3, 5, 8].includes(state.month)) return;
    const ledger = taxLedger(state);
    const nonWageIncome = ledger.business + ledger.dividends + ledger.interest + ledger.shortGains + ledger.longGains;
    if (nonWageIncome <= 0) return;
    const estimatedLiability = calculateTax(ledger).total;
    const targetPrepayment = Math.max(0, (estimatedLiability - ledger.withheld) * 0.9);
    const payment = Math.max(0, targetPrepayment - ledger.estimatedPaid);
    if (payment < 50) return;
    state.cash -= payment;
    ledger.estimatedPaid += payment;
    state.stats.taxes += payment;
    log(state, "tax", "Quarterly estimated tax paid", "Prepayment covers modeled non-wage income and reduces April settlement risk.", -payment);
  }

  function checkBadges(state) {
    const award = (id, name, detail) => {
      if (state.badges.some((badge) => badge.id === id)) return;
      state.badges.push({ id, name, detail, date: currentDate(state).label });
      log(state, "badge", name, detail);
    };
    const nw = netWorth(state);
    if (portfolioValue(state) > 0) award("owner", "Owner, not spectator", "Made a first productive or monetary-asset investment.");
    if (state.cash >= state.livingExpenses * 6) award("runway", "Six months of runway", "Built enough liquidity to absorb a personal income shock.");
    if (state.businesses.length) award("entrepreneur", "Price discovery", "Put capital behind a customer problem.");
    if (state.properties.length) award("landlord", "Deed and debt", "Acquired cash-flowing real estate with explicit financing risk.");
    if (Object.keys(allocation(state)).filter((key) => key !== "Cash" && allocation(state)[key] > 100).length >= 4) award("diversified", "Four engines", "Built exposure to four distinct return drivers.");
    if (nw >= 250000) award("quarter", "$250K net worth", "Compounding has become visible.");
    if (nw >= 1000000) award("million", "Capital allocator", "Crossed $1 million in net worth.");
    if (nw >= 10000000) award("eight", "Eight figures", "Built an institution-sized balance sheet.");
  }

  function fileBankruptcy(state) {
    if (netWorth(state) > 0 && state.cash > -10000) return { ok: false, message: "You are not insolvent enough for the simplified bankruptcy action." };
    let estate = Math.max(0, state.cash) + portfolioValue(state) * 0.94 + businessValue(state) * 0.62;
    state.properties.forEach((property) => {
      estate += Math.max(0, property.value * 0.84 - property.mortgage);
    });
    const secured = state.marginLoan;
    const unsecured = loanBalance(state);
    estate = Math.max(0, estate - secured);
    const exemptFreshStart = Math.min(15000, estate);
    state.cash = Math.max(8000, exemptFreshStart);
    state.portfolio = {};
    state.businesses = [];
    state.properties = [];
    state.derivatives = [];
    state.loans = [];
    state.marginLoan = 0;
    state.consumerDebt = 0;
    state.bankruptcies += 1;
    state.reputation = clamp(state.reputation - 28, 0, 100);
    state.resilience = clamp(state.resilience - 18, 0, 100);
    state.knowledge = clamp(state.knowledge + 7, 0, 100);
    log(state, "danger", "Simplified Chapter 7 discharge", `$${Math.round(unsecured).toLocaleString()} unsecured claims discharged after nonexempt assets were liquidated.`);
    addLesson(state, "optionality", "Bankruptcy creates a legal fresh start, but destroys capital, credit access, and control.");
    return { ok: true, message: "Debts discharged and nonexempt assets liquidated. You may continue rebuilding." };
  }

  function advanceMonth(state) {
    if (state.finished) return { ok: false, message: "The 20-year scenario is complete." };
    state.pendingEvent = null;
    state.pendingOutcome = null;
    processIncome(state);
    processBusinesses(state);
    processProperties(state);
    processDebt(state);
    processDividends(state);
    updateMacro(state);
    updateMarkets(state);
    processDerivatives(state);
    processOpportunities(state);
    enforceMargin(state);
    settlePriorTaxes(state);
    payEstimatedTaxes(state);
    triggerEvents(state);

    if (state.month === 11) closeTaxYear(state, state.year);
    state.stats.peakNetWorth = Math.max(state.stats.peakNetWorth, netWorth(state));
    state.netWorthHistory.push(netWorth(state));
    state.cashHistory.push(round(state.cash));
    if (state.netWorthHistory.length > 241) state.netWorthHistory.shift();
    if (state.cashHistory.length > 241) state.cashHistory.shift();
    state.resilience = clamp(35 + Math.min(35, Math.max(0, state.cash) / Math.max(1, state.livingExpenses * 6) * 25) - Math.min(25, (loanBalance(state) + state.marginLoan) / Math.max(1, netWorth(state)) * 8), 0, 100);
    checkBadges(state);

    if (state.cash < -100000 && netWorth(state) < -50000) fileBankruptcy(state);

    state.monthsElapsed += 1;
    state.month += 1;
    if (state.month > 11) {
      state.month = 0;
      state.year += 1;
      taxLedger(state, state.year);
    }
    if (state.monthsElapsed >= GAME_MONTHS) {
      state.finished = true;
      log(state, "system", "Twenty-year review", "Your score reflects wealth, resilience, knowledge, and the costs of failure.");
    }
    return { ok: true, message: `Advanced to ${currentDate(state).label}.`, event: state.pendingEvent };
  }

  function score(state) {
    const nw = Math.max(1, netWorth(state));
    const wealth = clamp(Math.log10(nw) * 110 - 400, 0, 500);
    const total = Math.round(wealth + state.resilience * 1.5 + state.knowledge + state.reputation - state.bankruptcies * 55 - state.stats.marginCalls * 8);
    let rank = "Household Survivor";
    if (total >= 700) rank = "Frontier Industrialist";
    else if (total >= 575) rank = "Patient Capitalist";
    else if (total >= 450) rank = "Disciplined Allocator";
    else if (total >= 320) rank = "Independent Operator";
    return { total, wealth: Math.round(wealth), rank };
  }

  function opportunitySignals(state) {
    const realRate = state.metrics.fedRate - state.metrics.inflation;
    const curve = state.metrics.yield10 - state.metrics.fedRate;
    const signals = [];
    if (realRate > 1.5) signals.push({ tone: "cool", title: "Cash is expensive", detail: "Positive real rates reward patience and pressure long-duration assets." });
    else signals.push({ tone: "warm", title: "Liquidity is loose", detail: "Low real rates support risk assets but can conceal malinvestment." });
    if (curve < -0.25) signals.push({ tone: "danger", title: "Yield curve inverted", detail: "Credit conditions imply slower activity or future rate cuts." });
    else signals.push({ tone: "neutral", title: "Term premium positive", detail: "Long lenders are being paid more than overnight cash." });
    if (state.metrics.moneyGrowth > 6) signals.push({ tone: "warm", title: "Credit impulse expanding", detail: "Watch the first recipients: property, compute, and financial assets may move before wages." });
    if (state.modifiers.energyTrend > 0.04) signals.push({ tone: "warm", title: "Power is scarce", detail: "Energy-intensive ventures face higher costs while firm generation gains pricing power." });
    if (state.metrics.riskAppetite < -0.12) signals.push({ tone: "danger", title: "Forced sellers emerging", detail: "Keep liquidity, check solvency, and distinguish price declines from impaired cash flow." });
    return signals.slice(0, 4);
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function hydrate(serialized) {
    const state = typeof serialized === "string" ? JSON.parse(serialized) : deepClone(serialized);
    if (!state || state.version !== VERSION) throw new Error("This save is incompatible with the current simulation.");
    state.opportunities ||= [];
    state.takenDeals ||= [];
    state.shockShield ||= { strength: 0, months: 0 };
    state.pendingOutcome ||= null;
    state.businesses.forEach((owned) => { if (!owned.eventBoost) owned.eventBoost = null; });
    if (state.pendingEvent && !state.pendingEvent.choices) state.pendingEvent.choices = buildEventChoices(state, state.pendingEvent);
    return state;
  }

  return {
    VERSION, START_YEAR, START_MONTH, GAME_MONTHS, MONTHS,
    createGame, currentDate, advanceMonth, netWorth, liquidNetWorth, portfolioValue,
    businessValue, propertyEquity, loanBalance, allocation, marginStatus, score,
    opportunitySignals, calculateTax, progressiveTax, amortizedPayment,
    buyAsset, sellAsset, buyBusiness, upgradeBusiness, sellBusiness, setReinvestment,
    buyProperty, sellProperty, takeLoan, repayLoan, borrowMargin, repayMargin,
    openOption, openFuture, closeDerivative, optionValue, fileBankruptcy,
    dismissEvent, dismissOutcome, resolveEventChoice, buildEventChoices, availableDeals, takeDeal,
    serialize, hydrate, getAsset, getBusiness, getProperty, deepClone,
    randomEventEligible, eventContext, describeEffects
  };
});
