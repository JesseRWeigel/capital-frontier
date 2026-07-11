(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.GameData = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ASSETS = [
    {
      id: "vti", symbol: "VTI", name: "Total U.S. Market", class: "Stocks", price: 286,
      drift: 0.068, vol: 0.17, yield: 0.013, rateBeta: -1.1, growthBeta: 1.1,
      description: "Broad ownership of U.S. public companies. Productive, diversified, and still volatile."
    },
    {
      id: "quality", symbol: "QUAL", name: "Quality Companies", class: "Stocks", price: 191,
      drift: 0.064, vol: 0.15, yield: 0.015, rateBeta: -0.7, growthBeta: 0.9,
      description: "Profitable firms with durable balance sheets and less dependence on cheap credit."
    },
    {
      id: "ai", symbol: "AIX", name: "AI & Automation", class: "Stocks", price: 124,
      drift: 0.095, vol: 0.33, yield: 0.002, rateBeta: -2.2, growthBeta: 1.8, unlockYear: 2026,
      description: "Semiconductors, model infrastructure, robotics, and automation. High growth, high duration."
    },
    {
      id: "space", symbol: "ORBT", name: "Space Economy", class: "Stocks", price: 38,
      drift: 0.105, vol: 0.42, yield: 0, rateBeta: -2.4, growthBeta: 1.9, unlockYear: 2028,
      description: "Launch, satellites, in-orbit services, and lunar logistics. Long timelines and binary risks."
    },
    {
      id: "tbill", symbol: "BIL", name: "Treasury Bills", class: "Bonds", price: 100,
      drift: 0, vol: 0.008, yield: 0.036, rateBeta: 0.1, growthBeta: -0.05,
      description: "Short-duration U.S. government debt. Low volatility with income that follows policy rates."
    },
    {
      id: "treasury", symbol: "UST10", name: "10-Year Treasuries", class: "Bonds", price: 96,
      drift: 0.008, vol: 0.085, yield: 0.041, rateBeta: -5.8, growthBeta: -0.35,
      description: "Duration exposure: valuable when rates fall, painful when inflation pushes yields higher."
    },
    {
      id: "corp", symbol: "IGB", name: "Investment-Grade Credit", class: "Bonds", price: 88,
      drift: 0.012, vol: 0.075, yield: 0.052, rateBeta: -3.8, growthBeta: 0.25,
      description: "Corporate bonds with interest-rate and recession risk. Spreads widen when liquidity leaves."
    },
    {
      id: "gold", symbol: "GOLD", name: "Gold", class: "Alternatives", price: 238,
      drift: 0.025, vol: 0.16, yield: 0, rateBeta: -0.35, inflationBeta: 1.8, growthBeta: -0.15,
      description: "A scarce monetary asset with no cash flow. Tends to benefit from negative real rates and fear."
    },
    {
      id: "btc", symbol: "BTC", name: "Bitcoin", class: "Digital", price: 108500,
      drift: 0.13, vol: 0.64, yield: 0, rateBeta: -2.1, inflationBeta: 0.9, growthBeta: 1.35,
      description: "Fixed-supply digital bearer asset. Liquid and scarce, with severe drawdowns and policy risk."
    },
    {
      id: "eth", symbol: "ETH", name: "Smart Contract Network", class: "Digital", price: 5900,
      drift: 0.11, vol: 0.72, yield: 0.022, rateBeta: -2.0, growthBeta: 1.55,
      description: "Programmable settlement infrastructure. Adds staking yield, technical risk, and competition."
    },
    {
      id: "energy", symbol: "NRG", name: "Energy Producers", class: "Real Assets", price: 71,
      drift: 0.04, vol: 0.29, yield: 0.031, rateBeta: -0.45, inflationBeta: 1.35, growthBeta: 0.65,
      description: "Oil, gas, nuclear, and power producers. Cyclical cash flow with an AI electricity tailwind."
    },
    {
      id: "copper", symbol: "COPR", name: "Copper Basket", class: "Real Assets", price: 31,
      drift: 0.045, vol: 0.28, yield: 0.005, rateBeta: -0.8, inflationBeta: 1.1, growthBeta: 1.25,
      description: "Electrification and construction input. Supply takes years to add, but recessions hit demand."
    }
  ];

  const BUSINESSES = [
    {
      id: "detailing", name: "Mobile Fleet Detailing", icon: "car", unlockYear: 2026,
      cost: 18000, monthlyRevenue: 8200, margin: 0.22, growth: 0.025, risk: 0.08, multiple: 2.4,
      labor: 0.7, ai: 0.05, energy: 0.15, description: "A cash-flowing local service. Win recurring fleet contracts and manage labor tightly."
    },
    {
      id: "hvac", name: "Heat Pump & HVAC Shop", icon: "wrench", unlockYear: 2026,
      cost: 68000, monthlyRevenue: 24000, margin: 0.18, growth: 0.04, risk: 0.10, multiple: 3.1,
      labor: 0.85, ai: 0.12, energy: 0.55, description: "Skilled-trade demand with recurring maintenance and building-electrification exposure."
    },
    {
      id: "eldercare", name: "Home Elder Care Network", icon: "heart", unlockYear: 2026,
      cost: 125000, monthlyRevenue: 41000, margin: 0.15, growth: 0.06, risk: 0.13, multiple: 3.5,
      labor: 0.95, ai: 0.15, energy: 0.05, description: "Demographic demand, staffing pressure, and regulated operations. Resilient but labor-heavy."
    },
    {
      id: "saas", name: "Vertical AI Software", icon: "code", unlockYear: 2027,
      cost: 95000, monthlyRevenue: 26000, margin: 0.34, growth: 0.12, risk: 0.23, multiple: 5.5,
      labor: 0.35, ai: 0.95, energy: 0.3, description: "Automate one expensive workflow. Excellent economics until models commoditize the feature."
    },
    {
      id: "robotics", name: "Robotics Integrator", icon: "bot", unlockYear: 2028,
      cost: 240000, monthlyRevenue: 68000, margin: 0.21, growth: 0.10, risk: 0.18, multiple: 4.6,
      labor: 0.55, ai: 0.75, energy: 0.45, description: "Install and maintain automation for warehouses and factories. Projects are lumpy."
    },
    {
      id: "microgrid", name: "Industrial Microgrids", icon: "zap", unlockYear: 2028,
      cost: 420000, monthlyRevenue: 94000, margin: 0.19, growth: 0.08, risk: 0.15, multiple: 4.3,
      labor: 0.4, ai: 0.35, energy: 1.0, description: "Build firm power for factories and compute campuses. Capital intensive with long contracts."
    },
    {
      id: "datacenter", name: "Edge Data Center", icon: "server", unlockYear: 2029,
      cost: 950000, monthlyRevenue: 182000, margin: 0.27, growth: 0.11, risk: 0.19, multiple: 6.2,
      labor: 0.2, ai: 1.0, energy: 1.0, description: "Lease power-dense racks near customers. Power contracts and utilization determine survival."
    },
    {
      id: "biolab", name: "AI Biodesign Lab", icon: "flask", unlockYear: 2031,
      cost: 1300000, monthlyRevenue: 210000, margin: 0.24, growth: 0.14, risk: 0.29, multiple: 6.8,
      labor: 0.45, ai: 0.9, energy: 0.45, description: "Design enzymes and therapies with models, then navigate slow validation and regulation."
    },
    {
      id: "orbital", name: "Orbital Services Broker", icon: "rocket", unlockYear: 2033,
      cost: 2200000, monthlyRevenue: 340000, margin: 0.31, growth: 0.16, risk: 0.34, multiple: 7.5,
      labor: 0.25, ai: 0.7, energy: 0.25, description: "Coordinate launch slots, servicing, and insurance. Network effects meet launch failure risk."
    }
  ];

  const PROPERTIES = [
    {
      id: "duplex", name: "Sunbelt Duplex", icon: "home", price: 340000, down: 0.25,
      rent: 2900, expenses: 0.39, appreciation: 0.032, vol: 0.06, capexRisk: 0.05,
      description: "Two units, manageable leverage, and hands-on tenant risk."
    },
    {
      id: "retail", name: "Neighborhood Storefront", icon: "store", price: 610000, down: 0.3,
      rent: 5900, expenses: 0.33, appreciation: 0.025, vol: 0.08, capexRisk: 0.07,
      description: "Local commercial space. Longer leases, but vacancy can last."
    },
    {
      id: "warehouse", name: "Last-Mile Warehouse", icon: "warehouse", price: 1450000, down: 0.3,
      rent: 14800, expenses: 0.28, appreciation: 0.035, vol: 0.09, capexRisk: 0.06,
      description: "Logistics property with automation upside and refinancing exposure."
    },
    {
      id: "farmland", name: "Midwest Farmland", icon: "sprout", price: 980000, down: 0.35,
      rent: 7200, expenses: 0.21, appreciation: 0.028, vol: 0.045, capexRisk: 0.04,
      description: "Productive land with modest yield, weather risk, and inflation sensitivity."
    },
    {
      id: "compute", name: "Powered Data Center Shell", icon: "server", price: 3600000, down: 0.4,
      rent: 42000, expenses: 0.36, appreciation: 0.045, vol: 0.13, capexRisk: 0.11, unlockYear: 2029,
      description: "Industrial shell with grid capacity. Scarce power helps, obsolescence hurts."
    }
  ];

  const EVENTS = [
    {
      id: "agents", year: 2027, month: 2, title: "Agentic software crosses the enterprise chasm",
      body: "Routine back-office work starts moving to supervised agents. Software margins expand, while undifferentiated services face price pressure.",
      effects: { aiTrend: 0.18, wageGrowth: -0.003, growth: 0.25 }, lesson: "Productivity gains reward owners who redeploy labor and capital early."
    },
    {
      id: "grid", year: 2028, month: 5, title: "The grid becomes the AI bottleneck",
      body: "Interconnection queues stretch for years. Firm power and cooling capacity command premiums.",
      effects: { energyTrend: 0.19, inflation: 0.5, aiTrend: -0.06 }, lesson: "Complementary scarce resources often capture more value than the celebrated technology."
    },
    {
      id: "credit", year: 2029, month: 8, title: "Private credit rollover shock",
      body: "Defaults expose optimistic underwriting. Lenders pull back and leveraged assets reprice.",
      effects: { rate: 0.75, growth: -1.2, risk: -0.16, property: -0.09 }, lesson: "Maturity mismatch can turn a solvent project into a forced seller."
    },
    {
      id: "robot", year: 2031, month: 1, title: "General-purpose robots reach commercial payback",
      body: "Warehouses and light manufacturing adopt adaptable robots at scale.",
      effects: { aiTrend: 0.13, wageGrowth: 0.002, growth: 0.45 }, lesson: "A technology matters economically when total cost falls below the next-best process."
    },
    {
      id: "token", year: 2032, month: 6, title: "Regulated tokenized settlement arrives",
      body: "Treasuries and private funds settle on shared ledgers. Compliant digital rails gain; speculative tokens fragment.",
      effects: { cryptoTrend: 0.15, rate: -0.15, risk: 0.06 }, lesson: "Adoption follows lower transaction costs, but property rights still depend on institutions."
    },
    {
      id: "launch", year: 2034, month: 3, title: "Reusable launch enters airline-like cadence",
      body: "Cheaper, frequent launch unlocks in-orbit servicing and new communications markets.",
      effects: { spaceTrend: 0.28, growth: 0.2 }, lesson: "Lower input costs create businesses that were previously impossible, not merely cheaper."
    },
    {
      id: "fiscal", year: 2036, month: 9, title: "Treasury term premium revolt",
      body: "Bond buyers demand compensation for persistent deficits. Long rates rise even as growth slows.",
      effects: { rate: 0.95, inflation: 0.35, risk: -0.12, property: -0.07 }, lesson: "The price of capital is a signal. Suppressing it can postpone, not erase, adjustment."
    },
    {
      id: "lunar", year: 2039, month: 4, title: "Cislunar infrastructure contracts begin",
      body: "Communications, navigation, and cargo standards turn lunar activity into an investable supply chain.",
      effects: { spaceTrend: 0.32, energyTrend: 0.05, growth: 0.25 }, lesson: "Standards and repeat customers convert engineering achievements into markets."
    },
    {
      id: "abundance", year: 2042, month: 0, title: "Machine intelligence reprices expertise",
      body: "High-quality analysis becomes cheap. Trust, distribution, proprietary data, energy, and physical execution remain scarce.",
      effects: { aiTrend: 0.2, wageGrowth: -0.006, growth: 0.55 }, lesson: "Profit persists where entrepreneurs control scarce complements, not abundant tools."
    }
  ];

  const RANDOM_EVENTS = [
    { title: "Soft landing optimism", condition: "cooling_inflation", body: "Inflation cools without a contraction. Risk appetite returns.", effects: { growth: 0.45, inflation: -0.25, risk: 0.07 } },
    { title: "Energy supply disruption", condition: "energy_pressure", body: "Fuel and power prices jump while consumers pull back.", effects: { inflation: 0.6, growth: -0.35, energyTrend: 0.12 } },
    { title: "Regional recession", condition: "slowdown", body: "Hiring slows, vacancies rise, and credit standards tighten.", effects: { growth: -1.0, risk: -0.1, property: -0.045 } },
    { title: "Productivity surprise", condition: "technology_maturing", body: "Business output rises faster than payrolls. Margins and real growth improve.", effects: { growth: 0.65, inflation: -0.2, aiTrend: 0.06 } },
    { title: "Speculative squeeze", condition: "risk_euphoria", body: "A crowded trade unwinds. Leveraged portfolios meet thin liquidity.", effects: { risk: -0.14, cryptoTrend: -0.12 } },
    { title: "Housing shortage deepens", condition: "housing_pressure", body: "Permitting constraints keep rents firm despite expensive mortgages.", effects: { property: 0.055, inflation: 0.18 } },
    { title: "Deregulation wave", condition: "policy_window", body: "Permitting and formation costs decline for small firms and construction.", effects: { growth: 0.5, property: 0.02, spaceTrend: 0.05 } },
    { title: "Cyber outage", condition: "digital_dependence", body: "A major outage interrupts digital commerce and exposes concentration risk.", effects: { growth: -0.45, aiTrend: -0.07, cryptoTrend: -0.06 } }
  ];

  const SCENARIOS = {
    bootstrap: {
      id: "bootstrap", name: "The Bootstrapper", kicker: "Cash-flow first",
      cash: 85000, salary: 9200, expenses: 4100, debt: 0, knowledge: 12,
      description: "A strong income, useful savings, and no safety net beyond what you build."
    },
    leveraged: {
      id: "leveraged", name: "The Operator", kicker: "Assets and obligations",
      cash: 155000, salary: 6800, expenses: 5600, debt: 92000, knowledge: 20,
      description: "More starting capital and a small acquired business loan at 8.4%."
    },
    technologist: {
      id: "technologist", name: "The Technologist", kicker: "Human capital",
      cash: 52000, salary: 12800, expenses: 4800, debt: 28000, knowledge: 34,
      description: "High earnings and future-market insight, but concentrated career exposure."
    }
  };

  const PRINCIPLES = [
    { id: "time", title: "Time preference", text: "Cash today has option value. Lock it up only when expected return compensates for time and uncertainty." },
    { id: "calculation", title: "Economic calculation", text: "Profit and loss reveal whether customers value your output more than the resources consumed." },
    { id: "signals", title: "Interest rates are signals", text: "Rates coordinate saving and long-lived investment. Cheap credit can make fragile projects look sound." },
    { id: "cantillon", title: "Money enters unevenly", text: "New credit changes relative prices before the general price level. Watch who receives funding first." },
    { id: "capital", title: "Capital has structure", text: "A warehouse, a chip fab, and an app are not interchangeable. Each depends on complementary skills and inputs." },
    { id: "optionality", title: "Resilience creates optionality", text: "Low fixed costs and liquidity let you buy when forced sellers cannot wait." },
    { id: "entrepreneur", title: "Entrepreneurship is discovery", text: "Forecasts fail. Start small, test demand, and update faster than competitors." }
  ];

  const DEALS = [
    {
      id: "fleet-contract", name: "Regional fleet service contract", sector: "services", unlockYear: 2026,
      stake: 8000, months: 4, chance: 0.72, payoutMultiple: 1.55, recoveryRate: 0.45,
      description: "Fund hiring and equipment to pursue a recurring commercial service agreement."
    },
    {
      id: "inventory-lot", name: "Distressed inventory lot", sector: "trade", unlockYear: 2026,
      stake: 6000, months: 3, chance: 0.66, payoutMultiple: 1.7, recoveryRate: 0.38,
      description: "Buy a discounted lot and test whether local distribution can clear it profitably."
    },
    {
      id: "land-option", name: "Industrial land entitlement", sector: "property", unlockYear: 2026,
      stake: 22000, months: 10, chance: 0.52, payoutMultiple: 2.5, recoveryRate: 0.5,
      description: "Option a parcel while pursuing power, zoning, and an industrial buyer."
    },
    {
      id: "ai-integration", name: "AI workflow integration pilot", sector: "ai", unlockYear: 2027,
      stake: 15000, months: 6, chance: 0.56, payoutMultiple: 2.15, recoveryRate: 0.2,
      description: "Build and validate automation for one costly enterprise workflow."
    },
    {
      id: "grid-option", name: "Grid interconnection option", sector: "energy", unlockYear: 2028,
      stake: 32000, months: 9, chance: 0.46, payoutMultiple: 2.9, recoveryRate: 0.35,
      description: "Reserve scarce power capacity before a data-center or industrial tenant commits."
    },
    {
      id: "robot-subcontract", name: "Robotics deployment subcontract", sector: "ai", unlockYear: 2029,
      stake: 42000, months: 8, chance: 0.53, payoutMultiple: 2.4, recoveryRate: 0.25,
      description: "Finance the integration work behind a warehouse automation award."
    },
    {
      id: "compute-reservation", name: "Compute capacity reservation", sector: "ai", unlockYear: 2030,
      stake: 55000, months: 7, chance: 0.5, payoutMultiple: 2.55, recoveryRate: 0.18,
      description: "Reserve scarce accelerator capacity and find a committed model-training customer."
    },
    {
      id: "satellite-data", name: "Satellite data reseller", sector: "space", unlockYear: 2032,
      stake: 70000, months: 11, chance: 0.45, payoutMultiple: 3.1, recoveryRate: 0.15,
      description: "Package orbital imagery into a decision product for insurers and agriculture."
    },
    {
      id: "orbital-manifest", name: "Shared launch manifest", sector: "space", unlockYear: 2035,
      stake: 140000, months: 12, chance: 0.42, payoutMultiple: 3.5, recoveryRate: 0.12,
      description: "Aggregate small payload customers into one insured launch manifest."
    }
  ];

  return { ASSETS, BUSINESSES, PROPERTIES, EVENTS, RANDOM_EVENTS, SCENARIOS, PRINCIPLES, DEALS };
});
