(function () {
  "use strict";

  const D = window.GameData;
  const E = window.EconEngine;
  const SAVE_KEY = "capital-frontier-save-v1";
  const SOUND_KEY = "capital-frontier-sound";
  const allocationColors = {
    Cash: "#58766a", Stocks: "#31698b", Bonds: "#8897a0", Alternatives: "#bd842b",
    Digital: "#6d5a85", "Real Assets": "#a3422f", "Real Estate": "#56866b", Businesses: "#d0943d"
  };

  let game = E.createGame("bootstrap", 202607);
  let selectedScenario = "bootstrap";
  let activeTab = "overview";
  let activeLedger = "taxes";
  let tradeAssetId = null;
  let tradeSide = "buy";
  let soundEnabled = localStorage.getItem(SOUND_KEY) !== "off";
  let audioContext = null;
  let masterGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let resizeTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function money(value, compact = false) {
    const absolute = Math.abs(Number(value) || 0);
    const sign = value < 0 ? "−" : "";
    if (compact && absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(2)}B`;
    if (compact && absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(2)}M`;
    if (compact && absolute >= 1e3) return `${sign}$${(absolute / 1e3).toFixed(1)}K`;
    return `${sign}$${Math.round(absolute).toLocaleString("en-US")}`;
  }

  function percent(value, digits = 1) {
    return `${Number(value).toFixed(digits)}%`;
  }

  function signedPercent(value, digits = 1) {
    const number = Number(value);
    return `${number >= 0 ? "+" : ""}${number.toFixed(digits)}%`;
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.72;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playVoice(frequency, start, duration, volume, type = "triangle") {
    if (!audioContext || !masterGain) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playMusicPhrase() {
    const ctx = ensureAudio();
    if (!ctx || ctx.state === "closed") return;
    const chords = [
      [130.81, 164.81, 196.00],
      [146.83, 174.61, 220.00],
      [110.00, 138.59, 164.81],
      [98.00, 130.81, 164.81]
    ];
    const chord = chords[musicStep % chords.length];
    const now = ctx.currentTime + 0.04;
    chord.forEach((frequency, index) => {
      playVoice(frequency, now + index * 0.48, 1.25, index === 0 ? 0.026 : 0.019, "sine");
    });
    playVoice(chord[2] * 2, now + 1.46, 0.62, 0.012, "triangle");
    musicStep += 1;
  }

  function startMusic() {
    if (!soundEnabled || musicTimer) return;
    playMusicPhrase();
    musicTimer = window.setInterval(playMusicPhrase, 3100);
  }

  function stopMusic() {
    if (musicTimer) window.clearInterval(musicTimer);
    musicTimer = null;
  }

  function sound(kind = "click") {
    const ctx = ensureAudio();
    if (!ctx) return;
    const patterns = {
      click: [[420, 0.05, "sine", 0.065]],
      success: [[440, 0.09, "triangle", 0.11], [660, 0.13, "triangle", 0.085]],
      cash: [[300, 0.07, "square", 0.065], [520, 0.12, "triangle", 0.10]],
      advance: [[230, 0.07, "triangle", 0.065], [285, 0.09, "triangle", 0.07]],
      warning: [[170, 0.14, "sawtooth", 0.10], [125, 0.20, "sawtooth", 0.08]],
      event: [[260, 0.14, "triangle", 0.09], [390, 0.20, "sine", 0.10]]
    };
    let offset = 0;
    (patterns[kind] || patterns.click).forEach(([frequency, duration, type, volume]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + duration);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(ctx.currentTime + offset);
      oscillator.stop(ctx.currentTime + offset + duration + 0.01);
      offset += duration * 0.72;
    });
    startMusic();
  }

  function toast(message, isError = false) {
    const region = $("#toast-region");
    const item = document.createElement("div");
    item.className = `toast${isError ? " error" : ""}`;
    item.textContent = message;
    region.appendChild(item);
    while (region.children.length > 4) region.firstElementChild.remove();
    window.setTimeout(() => item.remove(), 3100);
  }

  function save() {
    localStorage.setItem(SAVE_KEY, E.serialize(game));
  }

  function commit(result, effect = "success") {
    if (!result || !result.ok) {
      toast(result?.message || "That action could not be completed.", true);
      sound("warning");
      return false;
    }
    save();
    render();
    toast(result.message);
    sound(effect);
    return true;
  }

  function renderScenarios() {
    const container = $("#scenario-list");
    container.innerHTML = Object.values(D.SCENARIOS).map((scenario) => `
      <button class="scenario-option ${scenario.id === selectedScenario ? "selected" : ""}" type="button" data-scenario="${scenario.id}">
        <span><strong>${esc(scenario.name)}</strong><small>${esc(scenario.description)}</small></span>
        <span class="scenario-money"><strong>${money(scenario.cash)}</strong><small>${esc(scenario.kicker)}</small></span>
      </button>
    `).join("");
    $("#continue-game").hidden = !localStorage.getItem(SAVE_KEY);
  }

  function renderHeader() {
    const date = E.currentDate(game);
    $("#date-label").textContent = date.label;
    $("#era-progress").style.width = `${Math.min(100, game.monthsElapsed / E.GAME_MONTHS * 100)}%`;
    const years = Math.max(0, (E.GAME_MONTHS - game.monthsElapsed) / 12);
    $("#years-left").textContent = game.finished ? "Scenario complete" : `${years.toFixed(years % 1 ? 1 : 0)} years remain`;
    $("#sound-toggle").textContent = soundEnabled ? "♪" : "×";
    $("#sound-toggle").innerHTML = soundEnabled ? '<span aria-hidden="true">♪</span><b>Sound on</b>' : '<span aria-hidden="true">×</span><b>Sound off</b>';
    $("#sound-toggle").classList.toggle("muted", !soundEnabled);
    $("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled));
    $("#sound-toggle").title = soundEnabled ? "Mute music and sound effects" : "Enable music and sound effects";
    const cashDisplay = $("#header-cash");
    cashDisplay.textContent = money(game.cash, true);
    cashDisplay.parentElement.classList.toggle("negative", game.cash < 0);
    $$('[data-action="advance"]').forEach((button) => { button.disabled = game.finished; });

    const tapeIds = ["vti", "treasury", "gold", "btc", "ai", "energy", "space"];
    $("#market-tape").innerHTML = tapeIds.map((id) => {
      const asset = E.getAsset(id);
      const history = game.priceHistory[id];
      const previous = history[history.length - 2] || history[0];
      const change = (game.prices[id] / previous - 1) * 100;
      return `<span class="tape-item"><b>${asset.symbol}</b><span>${id === "btc" ? money(game.prices[id], true) : `$${game.prices[id].toFixed(2)}`}</span><span class="${change >= 0 ? "up" : "down"}">${signedPercent(change)}</span></span>`;
    }).join("");
  }

  function renderOverview() {
    const nw = E.netWorth(game);
    const debt = E.loanBalance(game) + game.marginLoan;
    const priorCash = game.cashHistory.length > 1 ? game.cashHistory[game.cashHistory.length - 2] : game.cash;
    const cashMove = game.cash - priorCash;
    const runway = game.livingExpenses > 0 ? game.cash / game.livingExpenses : 0;
    const score = E.score(game);
    $("#summary-strip").innerHTML = [
      ["Net worth", money(nw, true), `Peak ${money(game.stats.peakNetWorth, true)}`, nw < 0 ? "warning" : ""],
      ["Available cash", money(game.cash, true), `${Math.max(0, runway).toFixed(1)} months runway`, game.cash < game.livingExpenses * 2 ? "warning" : ""],
      ["Last cash movement", money(cashMove, true), "Includes investments and financing", cashMove < 0 ? "warning" : ""],
      ["Total liabilities", money(debt, true), `${game.marginLoan ? `${money(game.marginLoan, true)} margin` : "No margin balance"}`, ""],
      ["Allocator score", score.total.toLocaleString(), score.rank, ""]
    ].map(([label, value, detail, className]) => `
      <div class="summary-item ${className}"><small>${label}</small><strong>${value}</strong><span>${detail}</span></div>
    `).join("");

    const cycle = game.metrics.realGrowth < 0 ? "Contraction" : game.metrics.riskAppetite < -0.1 ? "Risk-off" : game.metrics.realGrowth > 3 ? "Boom" : "Expansion";
    $("#cycle-label").textContent = cycle;
    $("#chart-net-worth").textContent = money(nw, true);

    const allocations = E.allocation(game);
    const gross = Math.max(1, Object.values(allocations).reduce((sum, value) => sum + Math.max(0, value), 0));
    $("#allocation-bars").innerHTML = Object.entries(allocations)
      .filter(([, value]) => value > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => {
        const share = Math.max(0, value) / gross * 100;
        return `<div class="allocation-row"><span>${esc(name)}</span><div class="allocation-track"><span style="width:${share}%;background:${allocationColors[name] || "#617069"}"></span></div><b>${share.toFixed(0)}%</b></div>`;
      }).join("") || '<div class="empty-state"><p>Cash is your only allocation.</p></div>';

    const macro = [
      ["Fed funds", percent(game.metrics.fedRate, 2)], ["Inflation", percent(game.metrics.inflation)],
      ["Real growth", percent(game.metrics.realGrowth)], ["10Y Treasury", percent(game.metrics.yield10, 2)],
      ["Unemployment", percent(game.metrics.unemployment)], ["Money growth", percent(game.metrics.moneyGrowth)]
    ];
    $("#macro-grid").innerHTML = macro.map(([label, value]) => `<div class="macro-item"><small>${label}</small><strong>${value}</strong></div>`).join("");
    $("#signal-list").innerHTML = E.opportunitySignals(game).map((signal) => `
      <div class="signal-item ${signal.tone}"><strong>${esc(signal.title)}</strong><p>${esc(signal.detail)}</p></div>
    `).join("");

    const latest = game.log[0];
    $("#advisor-dispatch").innerHTML = latest ? `
      <div class="dispatch"><span class="dispatch-date">${esc(latest.date)} · ${esc(latest.type)}</span><h3>${esc(latest.title)}</h3><p>${esc(latest.detail || "Your books have been updated.")}</p></div>
    ` : '<div class="empty-state"><p>Advance time to receive the first dispatch.</p></div>';

    const milestones = [250000, 1000000, 10000000, 100000000];
    const prior = [0, ...milestones].filter((value) => value <= nw).at(-1) || 0;
    const target = milestones.find((value) => value > nw) || 100000000;
    const progress = Math.max(0, Math.min(100, (nw - prior) / Math.max(1, target - prior) * 100));
    $("#next-milestone").innerHTML = `<strong>${money(target, true)} net worth</strong><div class="milestone-progress"><span style="width:${progress}%"></span></div><div class="milestone-copy"><span>${progress.toFixed(0)}% complete</span><span>${money(Math.max(0, target - nw), true)} to go</span></div>`;
    renderObjectives();
    renderDeals();
    renderProjects();
    drawWealthChart();
  }

  function renderProjects() {
    const panel = $("#project-panel");
    const projects = game.opportunities || [];
    panel.hidden = projects.length === 0 && !(game.shockShield?.months > 0) && !game.businesses.some((owned) => owned.eventBoost?.months > 0);
    if (panel.hidden) return;
    const rows = projects.map((project) => `
      <div class="project-row"><div class="project-row-top"><strong>${esc(project.name)}</strong><b>${project.monthsRemaining} mo</b></div><div class="project-row-meta"><span>${money(project.stake, true)} at risk</span><span>${Math.round(project.successChance * 100)}% modeled odds</span></div><div class="project-timer"><span style="width:${Math.max(5, project.monthsRemaining / (project.totalMonths || (project.sector === "space" ? 9 : 6)) * 100)}%"></span></div></div>
    `);
    if (game.shockShield?.months > 0) rows.push(`<div class="project-row"><div class="project-row-top"><strong>Portfolio protection</strong><b>${game.shockShield.months} mo</b></div><div class="project-row-meta"><span>${Math.round(game.shockShield.strength * 100)}% downside reduction</span><span>Public markets</span></div></div>`);
    const boosted = game.businesses.filter((owned) => owned.eventBoost?.months > 0);
    if (boosted.length) rows.push(`<div class="project-row"><div class="project-row-top"><strong>Operating sprint</strong><b>${Math.max(...boosted.map((owned) => owned.eventBoost.months))} mo</b></div><div class="project-row-meta"><span>${boosted.length} venture${boosted.length === 1 ? "" : "s"} boosted</span><span>+${Math.round(boosted[0].eventBoost.strength * 100)}% revenue</span></div></div>`);
    $("#project-count").textContent = String(rows.length);
    $("#project-list").innerHTML = rows.join("");
  }

  function renderDeals() {
    const deals = E.availableDeals(game);
    $("#deal-capacity").textContent = `${game.opportunities.length}/5 active`;
    $("#deal-grid").innerHTML = deals.map((deal) => {
      const maxPayout = deal.cost * deal.payoutMultiple;
      const unavailable = deal.taken || game.opportunities.length >= 5 || game.cash < deal.cost;
      let buttonLabel = "Commit capital";
      if (deal.taken) buttonLabel = "Already committed";
      else if (game.opportunities.length >= 5) buttonLabel = "Team at capacity";
      else if (game.cash < deal.cost) buttonLabel = "Insufficient cash";
      return `<article class="deal-card ${deal.taken ? "taken" : ""}"><span class="eyebrow">${esc(deal.sector)} opportunity</span><h3>${esc(deal.name)}</h3><p>${esc(deal.description)}</p><div class="deal-terms"><span><small>Stake</small><b>${money(deal.cost, true)}</b></span><span><small>Duration</small><b>${deal.months} mo</b></span><span><small>Success</small><b>${Math.round(deal.successChance * 100)}%</b></span></div><button class="${deal.taken ? "secondary" : "primary"}" type="button" data-action="take-deal" data-deal="${deal.key}" ${unavailable ? "disabled" : ""}>${buttonLabel} · up to ${money(maxPayout, true)}</button></article>`;
    }).join("");
  }

  function objectivePlan() {
    const allocation = E.allocation(game);
    const investedClasses = Object.entries(allocation).filter(([name, value]) => name !== "Cash" && value >= 500).length;
    const reserveTarget = game.livingExpenses * 6;
    return [
      {
        id: "runway", title: "Protect six months of cash", done: game.cash >= reserveTarget,
        detail: `Keep ${money(reserveTarget, true)} outside volatile investments for bills and opportunities.`, target: "overview", actionLabel: "Review"
      },
      {
        id: "first-position", title: "Invest a measured first $5K", done: E.portfolioValue(game) >= 5000,
        detail: "Start with broad stocks or Treasury bills; avoid leverage while learning price movement.", target: "markets", actionLabel: "Markets"
      },
      {
        id: "first-review", title: "Advance and review one month", done: game.monthsElapsed >= 1,
        detail: "Observe take-home pay, living costs, asset movement, and any distributions before scaling.", directAction: "advance", actionLabel: "+1 month"
      },
      {
        id: "diversify", title: "Build three return engines", done: investedClasses >= 3,
        detail: `${investedClasses}/3 classes owned. Combine assets driven by different economic forces.`, target: "markets", actionLabel: "Allocate"
      },
      {
        id: "enterprise", title: "Open one cash-flowing venture", done: game.businesses.length >= 1,
        detail: "Test customer demand with the smallest business your liquidity can support.", target: "businesses", actionLabel: "Ventures"
      },
      {
        id: "property", title: "Underwrite a property", done: game.properties.length >= 1,
        detail: "Compare rent after expenses with the mortgage payment; preserve closing-cost reserves.", target: "property", actionLabel: "Property"
      },
      {
        id: "quarter-million", title: "Reach $250K without a forced sale", done: E.netWorth(game) >= 250000,
        detail: `Current net worth is ${money(E.netWorth(game), true)}. Compound while keeping debt service survivable.`, target: "overview", actionLabel: "Review"
      }
    ];
  }

  function renderObjectives() {
    const objectives = objectivePlan();
    const complete = objectives.filter((objective) => objective.done).length;
    const currentIndex = objectives.findIndex((objective) => !objective.done);
    const start = Math.max(0, currentIndex - 1);
    const visible = objectives.slice(start, Math.min(objectives.length, start + 4));
    $("#objective-count").textContent = `${complete}/${objectives.length}`;
    $("#objective-list").innerHTML = visible.map((objective) => {
      const current = !objective.done && objectives.indexOf(objective) === currentIndex;
      const destination = objective.directAction ? `data-guide-action="${objective.directAction}"` : `data-guide-target="${objective.target}"`;
      return `<div class="objective-item ${objective.done ? "done" : current ? "current" : ""}"><span class="objective-check">${objective.done ? "✓" : current ? "→" : ""}</span><span class="objective-copy"><strong>${esc(objective.title)}</strong><small>${esc(objective.detail)}</small></span>${objective.done ? "" : `<button class="text-button" type="button" data-action="objective" ${destination}>${esc(objective.actionLabel)}</button>`}</div>`;
    }).join("");
    const current = currentIndex >= 0 ? objectives[currentIndex] : null;
    $("#mission-title").textContent = current ? current.title : "Twenty-year plan complete";
    $("#mission-detail").textContent = current ? current.detail : "Continue managing the balance sheet or begin another scenario.";
    const action = $("#mission-action");
    action.hidden = !current;
    if (current) {
      action.textContent = current.actionLabel;
      if (current.directAction) {
        action.dataset.guideAction = current.directAction;
        delete action.dataset.guideTarget;
      } else {
        action.dataset.guideTarget = current.target;
        delete action.dataset.guideAction;
      }
    }
  }

  function setupCanvas(canvas, height) {
    if (!canvas) return null;
    const width = Math.max(10, canvas.clientWidth);
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { ctx, width, height };
  }

  function drawLineChart(canvas, values, color, height = 190, fill = true) {
    const setup = setupCanvas(canvas, height);
    if (!setup || !values.length) return;
    const { ctx, width } = setup;
    const pad = { left: 6, right: 6, top: 12, bottom: 19 };
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = Math.max(1, max - min);
    const x = (index) => pad.left + index / Math.max(1, values.length - 1) * (width - pad.left - pad.right);
    const y = (value) => pad.top + (max - value) / range * (height - pad.top - pad.bottom);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#dfe4df";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const gridY = pad.top + i / 3 * (height - pad.top - pad.bottom);
      ctx.beginPath(); ctx.moveTo(pad.left, gridY); ctx.lineTo(width - pad.right, gridY); ctx.stroke();
    }
    if (min < 0 && max > 0) {
      ctx.strokeStyle = "#c9877b"; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(pad.left, y(0)); ctx.lineTo(width - pad.right, y(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath();
    values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
    if (fill) {
      ctx.lineTo(x(values.length - 1), height - pad.bottom);
      ctx.lineTo(x(0), height - pad.bottom);
      ctx.closePath();
      ctx.fillStyle = "rgba(29, 90, 69, .10)";
      ctx.fill();
      ctx.beginPath();
      values.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fillStyle = "#617069";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText(money(max, true), pad.left, 9);
    ctx.fillText(E.currentDate(game).label, Math.max(2, width - 54), height - 3);
  }

  function drawWealthChart() {
    drawLineChart($("#wealth-chart"), game.netWorthHistory || [E.netWorth(game)], "#1d5a45", window.innerWidth <= 580 ? 150 : 190);
  }

  function drawSparklines() {
    $$("canvas[data-spark]").forEach((canvas) => {
      const values = game.priceHistory[canvas.dataset.spark].slice(-24);
      const setup = setupCanvas(canvas, 32);
      if (!setup || values.length < 1) return;
      const { ctx, width, height } = setup;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = Math.max(.0001, max - min);
      ctx.beginPath();
      values.forEach((value, index) => {
        const px = index / Math.max(1, values.length - 1) * width;
        const py = 3 + (max - value) / range * (height - 6);
        index ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = values.at(-1) >= values[0] ? "#1d5a45" : "#a3422f";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function renderMarkets() {
    const value = E.portfolioValue(game);
    $("#market-portfolio-value").textContent = money(value, true);
    $("#asset-table").innerHTML = `
      <div class="asset-head"><span>Market</span><span>Price</span><span>1 month</span><span>Trend</span><span></span></div>
      ${D.ASSETS.map((asset) => {
        const locked = game.year < (asset.unlockYear || E.START_YEAR);
        const history = game.priceHistory[asset.id];
        const previous = history[history.length - 2] || history[0];
        const change = (game.prices[asset.id] / previous - 1) * 100;
        return `<div class="asset-row ${locked ? "locked-row" : ""}">
          <div class="asset-name"><b>${esc(asset.symbol)} · ${esc(asset.name)}</b><small>${locked ? `Unlocks ${asset.unlockYear}` : esc(asset.class)}</small></div>
          <div class="asset-price"><strong>${asset.id === "btc" || asset.id === "eth" ? money(game.prices[asset.id], true) : `$${game.prices[asset.id].toFixed(2)}`}</strong><small>${asset.yield ? `${percent(asset.yield * 100)} yield` : "No yield"}</small></div>
          <strong class="${change >= 0 ? "up" : "down"}">${signedPercent(change)}</strong>
          <canvas class="asset-spark" data-spark="${asset.id}" width="84" height="32" aria-label="${esc(asset.symbol)} price trend"></canvas>
          <div class="asset-action"><button class="secondary" type="button" data-action="open-trade" data-asset="${asset.id}" ${locked ? "disabled" : ""}>Trade</button></div>
        </div>`;
      }).join("")}`;

    const holdings = Object.entries(game.portfolio).sort((a, b) => b[1].units * game.prices[b[0]] - a[1].units * game.prices[a[0]]);
    $("#holdings-list").innerHTML = holdings.length ? holdings.map(([id, holding]) => {
      const asset = E.getAsset(id);
      const marketValue = holding.units * game.prices[id];
      const gain = marketValue - holding.costBasis;
      return `<div class="position-row"><div class="position-top"><b>${esc(asset.symbol)}</b><strong>${money(marketValue, true)}</strong></div><div class="position-meta"><span>${holding.units.toFixed(4)} units</span><span class="${gain >= 0 ? "up" : "down"}">${gain >= 0 ? "+" : ""}${money(gain, true)}</span></div></div>`;
    }).join("") : '<div class="empty-state"><strong>No positions yet</strong><p>Broad ownership, lending, and scarcity assets each solve a different problem.</p></div>';

    const derivativeCards = [
      { asset: "vti", title: "U.S. market options", text: "Six-month calls or puts, 5% out of the money.", type: "option" },
      { asset: "ai", title: "AI theme options", text: "High volatility means expensive premium and fast decay.", type: "option" },
      { asset: "btc", title: "Bitcoin options", text: "Defined premium on an unusually volatile underlying.", type: "option" },
      { asset: "energy", title: "Energy futures", text: "Long or short 8× notional, settled every month.", type: "future" },
      { asset: "copper", title: "Copper futures", text: "Hedge or speculate on construction and electrification.", type: "future" },
      { asset: "btc", title: "Bitcoin futures", text: "Cash-settled leverage with strict maintenance margin.", type: "future" }
    ];
    $("#derivative-desk").innerHTML = derivativeCards.map((card) => {
      const asset = E.getAsset(card.asset);
      const directions = card.type === "option" ? ["call", "put"] : ["long", "short"];
      return `<article class="derivative-card ${card.type === "future" ? "future" : ""}"><span class="eyebrow">${esc(asset.symbol)} · ${card.type}</span><h3>${esc(card.title)}</h3><p>${esc(card.text)}</p><div class="derivative-actions">${directions.map((direction) => `<button class="secondary" type="button" data-action="open-${card.type}" data-asset="${card.asset}" data-direction="${direction}">$1K ${direction}</button>`).join("")}</div></article>`;
    }).join("");

    $("#derivative-positions").innerHTML = game.derivatives.length ? game.derivatives.map((position) => {
      const asset = E.getAsset(position.assetId);
      const value = position.type === "option" ? E.optionValue(game, position, true) : position.marginBalance;
      return `<div class="open-position"><span><b>${esc(asset.symbol)} ${esc(position.direction)}</b><br>${position.expiry - game.monthsElapsed} months · ${money(value, true)}</span><button class="text-button" type="button" data-action="close-derivative" data-id="${position.id}">Close</button></div>`;
    }).join("") : "";
    window.requestAnimationFrame(drawSparklines);
  }

  function renderBusinesses() {
    $("#business-value").textContent = money(E.businessValue(game), true);
    $("#owned-businesses").innerHTML = game.businesses.length ? game.businesses.map((owned) => {
      const spec = E.getBusiness(owned.type);
      const value = E.businessValue({ ...game, businesses: [owned] });
      return `<article class="owned-card"><span class="eyebrow">Operating company</span><h3>${esc(spec.name)}</h3><div class="owned-metrics"><div><small>Last profit</small><strong class="${owned.lastProfit >= 0 ? "up" : "down"}">${money(owned.lastProfit, true)}</strong></div><div><small>Scale</small><strong>${owned.scale.toFixed(2)}×</strong></div><div><small>Value</small><strong>${money(value, true)}</strong></div></div><div class="reinvest-control"><label><span>Reinvest profit</span><b>${Math.round(owned.reinvest * 100)}%</b></label><input type="range" min="0" max="50" step="5" value="${Math.round(owned.reinvest * 100)}" data-action="reinvest" data-id="${owned.id}"></div><div class="owned-actions"><button class="primary" type="button" data-action="upgrade-business" data-id="${owned.id}">Expand</button><button class="secondary" type="button" data-action="sell-business" data-id="${owned.id}">Sell company</button></div></article>`;
    }).join("") : '<div class="empty-state"><strong>No operating businesses</strong><p>Start small enough to learn, then scale demonstrated demand.</p></div>';

    $("#business-catalog").innerHTML = D.BUSINESSES.map((spec) => {
      const locked = game.year < spec.unlockYear;
      const annualProfit = spec.monthlyRevenue * 12 * spec.margin;
      return `<article class="catalog-card ${locked ? "locked" : ""}"><div class="catalog-card-head"><div><span class="eyebrow">${locked ? `Available ${spec.unlockYear}` : "Formation opportunity"}</span><h3>${esc(spec.name)}</h3></div><span class="catalog-icon" aria-hidden="true">${esc(spec.name.slice(0, 2))}</span></div><p>${esc(spec.description)}</p><div class="catalog-metrics"><div><small>Startup</small><strong>${money(spec.cost, true)}</strong></div><div><small>Base profit</small><strong>${money(annualProfit, true)}/yr</strong></div><div><small>Risk</small><strong>${spec.risk < .13 ? "Measured" : spec.risk < .22 ? "Elevated" : "Frontier"}</strong></div></div><button class="primary" type="button" data-action="buy-business" data-business="${spec.id}" ${locked ? "disabled" : ""}>${locked ? `Unlocks ${spec.unlockYear}` : "Start venture"}</button></article>`;
    }).join("");
  }

  function renderProperties() {
    $("#property-equity").textContent = money(E.propertyEquity(game), true);
    $("#owned-properties").innerHTML = game.properties.length ? game.properties.map((owned) => {
      const spec = E.getProperty(owned.type);
      const equity = owned.value - owned.mortgage;
      return `<article class="owned-card"><span class="eyebrow">${owned.occupied ? "Occupied" : "Vacant"}</span><h3>${esc(spec.name)}</h3><div class="owned-metrics"><div><small>Cash flow</small><strong class="${owned.lastCashFlow >= 0 ? "up" : "down"}">${money(owned.lastCashFlow, true)}/mo</strong></div><div><small>Mortgage</small><strong>${money(owned.mortgage, true)}</strong></div><div><small>Equity</small><strong>${money(equity, true)}</strong></div></div><div class="owned-actions"><button class="secondary" type="button" data-action="sell-property" data-id="${owned.id}">Sell property</button></div></article>`;
    }).join("") : '<div class="empty-state"><strong>No property holdings</strong><p>Prices can rise while cash flow remains weak. Underwrite both.</p></div>';

    $("#property-catalog").innerHTML = D.PROPERTIES.map((spec) => {
      const locked = game.year < (spec.unlockYear || E.START_YEAR);
      const mortgageRate = (game.metrics.fedRate + (["duplex", "farmland"].includes(spec.id) ? 2.5 : 2.8)) / 100;
      const down = spec.price * spec.down + spec.price * 0.03;
      const payment = E.amortizedPayment(spec.price * (1 - spec.down), mortgageRate, ["duplex", "farmland"].includes(spec.id) ? 360 : 240);
      const cashFlow = spec.rent * (1 - spec.expenses) - payment;
      return `<article class="catalog-card ${locked ? "locked" : ""}"><div class="catalog-card-head"><div><span class="eyebrow">${locked ? `Available ${spec.unlockYear}` : `${Math.round(spec.down * 100)}% down`}</span><h3>${esc(spec.name)}</h3></div><span class="catalog-icon" aria-hidden="true">${esc(spec.name.slice(0, 2))}</span></div><p>${esc(spec.description)}</p><div class="catalog-metrics"><div><small>Price</small><strong>${money(spec.price, true)}</strong></div><div><small>Cash needed</small><strong>${money(down, true)}</strong></div><div><small>Base flow</small><strong class="${cashFlow >= 0 ? "up" : "down"}">${money(cashFlow, true)}/mo</strong></div></div><button class="primary" type="button" data-action="buy-property" data-property="${spec.id}" ${locked ? "disabled" : ""}>${locked ? `Unlocks ${spec.unlockYear}` : "Acquire property"}</button></article>`;
    }).join("");
  }

  function renderCredit() {
    const margin = E.marginStatus(game);
    const liabilities = E.loanBalance(game) + game.marginLoan;
    $("#total-liabilities").textContent = money(liabilities, true);
    $("#margin-rate").textContent = percent(margin.rate * 100, 2);
    $("#margin-console").innerHTML = `<div class="credit-stats"><div><small>Collateral</small><strong>${money(margin.collateral, true)}</strong></div><div><small>Loan balance</small><strong>${money(game.marginLoan, true)}</strong></div><div><small>Available draw</small><strong>${money(margin.initialCapacity, true)}</strong></div></div><div><small>Maintenance equity ratio</small><div class="ratio-bar"><span style="width:${Math.min(100, margin.ratio * 100)}%;background:${margin.ratio < .3 ? "#a02f2f" : "#1d5a45"}"></span></div><div class="ratio-caption"><span>${percent(margin.ratio * 100)}</span><span>30% forced-sale line</span></div></div><div class="button-row"><button class="primary" type="button" data-action="margin-borrow" data-amount="5000" ${margin.initialCapacity < 5000 ? "disabled" : ""}>Borrow $5K</button><button class="primary" type="button" data-action="margin-borrow" data-amount="25000" ${margin.initialCapacity < 25000 ? "disabled" : ""}>Borrow $25K</button><button class="secondary" type="button" data-action="margin-repay" data-amount="5000" ${!game.marginLoan ? "disabled" : ""}>Repay $5K</button><button class="secondary" type="button" data-action="margin-repay" data-amount="all" ${!game.marginLoan ? "disabled" : ""}>Repay all</button></div>`;

    const loanRows = game.loans.map((loan) => `<div class="loan-row"><span><b>${esc(loan.type)}</b><small>${percent(loan.rate * 100, 2)} · ${loan.monthsRemaining} months</small></span><strong>${money(loan.principal, true)}</strong><button class="text-button" type="button" data-action="repay-loan" data-id="${loan.id}" data-amount="5000">Pay $5K</button></div>`).join("");
    $("#loan-console").innerHTML = `${loanRows || '<div class="empty-state"><p>No scheduled business loans.</p></div>'}<div class="button-row"><button class="primary" type="button" data-action="take-loan" data-amount="25000">Borrow $25K</button><button class="secondary" type="button" data-action="take-loan" data-amount="100000">Borrow $100K</button></div>`;

    const insolvent = E.netWorth(game) <= 0 || game.cash <= -10000;
    $("#bankruptcy-console").innerHTML = `<div class="bankruptcy-copy"><p>This simplified Chapter 7 path liquidates market assets and businesses, retires secured claims, discharges unsecured balances, and preserves only a small fresh-start amount. Real exemptions and eligibility depend on state and personal facts.</p><button class="${insolvent ? "primary" : "secondary"}" type="button" data-action="bankruptcy" ${insolvent ? "" : "disabled"}>File simplified Chapter 7</button></div>`;
  }

  function renderLedger() {
    $$("[data-ledger-target]").forEach((button) => button.classList.toggle("active", button.dataset.ledgerTarget === activeLedger));
    const container = $("#ledger-content");
    if (activeLedger === "taxes") {
      const ledger = game.taxes[game.year];
      const estimate = E.calculateTax(ledger);
      const ordinary = ledger.wages + ledger.business + ledger.dividends + ledger.interest + ledger.shortGains;
      const taxRows = Object.values(game.taxes).sort((a, b) => b.year - a.year).map((year) => {
        const liability = year.liability === null ? E.calculateTax(year).total : year.liability;
        const balance = year.balance === null ? liability - year.withheld - year.estimatedPaid : year.balance;
        return `<div class="tax-row"><b>${year.year}${year.settled ? " ✓" : ""}</b><span>${money(year.wages)}</span><span>${money(year.business)}</span><span>${money(year.longGains + year.shortGains)}</span><span>${money(liability)}</span><strong class="${balance <= 0 ? "up" : "down"}">${money(balance)}</strong></div>`;
      }).join("");
      container.innerHTML = `<div class="ledger-view"><div class="tax-summary"><div><small>YTD ordinary income</small><strong>${money(ordinary)}</strong></div><div><small>Est. total tax</small><strong>${money(estimate.total)}</strong></div><div><small>Withheld</small><strong>${money(ledger.withheld + ledger.estimatedPaid)}</strong></div><div><small>Marginal federal rate</small><strong>${marginalRate(ordinary)}</strong></div></div><div class="tax-table"><div class="tax-row head"><span>Tax year</span><span>Wages</span><span>Business/rent</span><span>Realized gains</span><span>Liability</span><span>Balance due</span></div>${taxRows}</div><p class="disclaimer">Model uses 2026 single-filer federal brackets, inflation indexing, payroll/self-employment tax, a simplified 4.5% state tax, quarterly estimates, depreciation, and capital-gain holding periods. It omits many deductions, credits, entity elections, loss limits, and state-specific rules.</p><p class="source-links">Calibration: <a href="https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill" target="_blank" rel="noopener">IRS 2026 adjustments</a> · <a href="https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm" target="_blank" rel="noopener">Federal Reserve, June 2026</a> · <a href="https://www.sec.gov/about/reports-publications/investorpubsmarginhtm" target="_blank" rel="noopener">SEC margin rules</a> · <a href="https://www.cbo.gov/publication/61270" target="_blank" rel="noopener">CBO long-term outlook</a></p></div>`;
    } else if (activeLedger === "journal") {
      container.innerHTML = `<div class="ledger-view journal-list">${game.log.map((item) => `<div class="journal-row"><small>${esc(item.date)}</small><span class="journal-type ${esc(item.type)}">${esc(item.type)}</span><span class="journal-detail"><strong>${esc(item.title)}</strong><small>${esc(item.detail || "")}</small></span><b class="${item.amount === null || item.amount >= 0 ? "up" : "down"}">${item.amount === null ? "" : money(item.amount)}</b></div>`).join("")}</div>`;
    } else if (activeLedger === "academy") {
      const learnedIds = new Set(game.lessons.map((lesson) => lesson.id));
      container.innerHTML = `<div class="ledger-view principle-grid">${D.PRINCIPLES.map((principle, index) => `<article class="principle-card ${learnedIds.has(principle.id) ? "" : "unlearned"}"><span class="principle-number">${index + 1}</span><h3>${esc(learnedIds.has(principle.id) ? principle.title : "Principle undiscovered")}</h3><p>${learnedIds.has(principle.id) ? esc(principle.text) : "Take relevant actions and live through the cycle to unlock this lesson."}</p></article>`).join("")}</div>`;
    } else {
      container.innerHTML = game.badges.length ? `<div class="ledger-view award-grid">${game.badges.map((badge) => `<article class="award-card"><span class="eyebrow">${esc(badge.date)}</span><h3>${esc(badge.name)}</h3><p>${esc(badge.detail)}</p></article>`).join("")}</div>` : '<div class="empty-state"><strong>No milestones yet</strong><p>Your first prudent allocation or six-month runway will begin the record.</p></div>';
    }
  }

  function marginalRate(income) {
    const taxable = Math.max(0, income - 16100 * Math.pow(1.02, Math.max(0, game.year - 2026)));
    const thresholds = [[640600, 37], [256225, 35], [201775, 32], [105700, 24], [50400, 22], [12400, 12], [0, 10]];
    const factor = Math.pow(1.02, Math.max(0, game.year - 2026));
    return percent((thresholds.find(([threshold]) => taxable > threshold * factor) || [0, 10])[1], 0);
  }

  function renderEvent() {
    const modal = $("#event-modal");
    if (!game.pendingEvent) { modal.hidden = true; return; }
    $("#event-title").textContent = game.pendingEvent.title;
    $("#event-context").textContent = game.pendingEvent.context || `This development is entering the model in ${E.currentDate(game).label}, against the current rate and growth backdrop.`;
    $("#event-body").textContent = game.pendingEvent.body;
    $("#event-effects-list").innerHTML = eventEffectItems(game.pendingEvent).map((effect) => `<span class="effect-chip ${effect.negative ? "negative" : ""}">${esc(effect.label)}</span>`).join("");
    $("#event-financial-impact").innerHTML = eventFinancialImpacts(game.pendingEvent).map((impact, index) => `<div class="impact-line ${index === 0 ? "immediate" : ""}">${esc(impact)}</div>`).join("");
    $("#event-lesson").textContent = game.pendingEvent.lesson || "Uncertainty changes prices before it changes the historical record.";
    if (!game.pendingEvent.choices) game.pendingEvent.choices = E.buildEventChoices(game, game.pendingEvent);
    $("#event-choice-list").innerHTML = game.pendingEvent.choices.map((choice) => {
      let secondary = "No capital committed";
      if (choice.kind === "pilot") secondary = `${choice.months} months · ${Math.round(choice.successChance * 100)}% success odds`;
      else if (choice.kind === "protect") secondary = `${choice.months} months · ${Math.round(choice.strength * 100)}% downside reduction`;
      else if (choice.kind === "operate") secondary = `${choice.months} months · +${Math.round(choice.strength * 100)}% revenue`;
      return `<button class="event-choice" type="button" data-action="event-choice" data-choice="${choice.id}" ${choice.cost > game.cash ? "disabled" : ""}><span><strong>${esc(choice.label)}</strong><small>${esc(choice.description)}</small></span><span class="event-choice-meta"><b>${choice.cost ? money(choice.cost, true) : "$0"}</b><span>${esc(secondary)}</span></span></button>`;
    }).join("");
    modal.hidden = false;
    sound("event");
  }

  function eventEffectItems(event) {
    const effects = event.effects || {};
    const items = [];
    const add = (label, negative) => items.push({ label, negative });
    if (effects.rate) add(`Policy rate ${effects.rate > 0 ? "+" : ""}${Math.round(effects.rate * 100)} bps`, effects.rate > 0);
    if (effects.inflation) add(`Inflation ${effects.inflation > 0 ? "+" : ""}${effects.inflation.toFixed(2)} pts`, effects.inflation > 0);
    if (effects.growth) add(`Real growth ${effects.growth > 0 ? "+" : ""}${effects.growth.toFixed(2)} pts`, effects.growth < 0);
    if (effects.risk) add(`Risk appetite ${effects.risk > 0 ? "+" : ""}${Math.round(effects.risk * 100)} pts`, effects.risk < 0);
    [
      ["property", "Property"], ["aiTrend", "AI"], ["spaceTrend", "Space"],
      ["energyTrend", "Energy"], ["cryptoTrend", "Digital assets"], ["wageGrowth", "Wages"]
    ].forEach(([key, label]) => {
      if (effects[key]) add(`${label} trend ${effects[key] > 0 ? "+" : ""}${(effects[key] * 100).toFixed(key === "wageGrowth" ? 1 : 0)}%`, effects[key] < 0);
    });
    return items.length ? items : [{ label: "No modeled macro change", negative: false }];
  }

  function portfolioExposure(classes, ids) {
    return Object.entries(game.portfolio).reduce((sum, [id, holding]) => {
      const asset = E.getAsset(id);
      if ((classes && classes.includes(asset.class)) || (ids && ids.includes(id))) return sum + holding.units * game.prices[id];
      return sum;
    }, 0);
  }

  function eventFinancialImpacts(event) {
    const effects = event.effects || {};
    const impacts = ["No cash is added or removed when this headline appears. The displayed changes affect future months unless noted below."];
    if (effects.rate) {
      const addedMarginInterest = game.marginLoan * (effects.rate / 100) / 12;
      if (game.marginLoan > 0) impacts.push(`Your ${money(game.marginLoan, true)} margin balance changes next month's interest by about ${money(addedMarginInterest)}. Existing fixed-rate loans do not reprice.`);
      else impacts.push("New margin and business borrowing reprices immediately; existing fixed-rate mortgages and term loans do not change.");
    }
    if (effects.inflation) impacts.push(`Your current ${money(game.livingExpenses)} monthly living cost will respond gradually; labor, energy, and property expenses also feed through over later months.`);
    if (effects.risk) {
      const exposure = portfolioExposure(["Stocks", "Digital"]);
      impacts.push(exposure > 0 ? `${money(exposure, true)} of your portfolio is in stocks or digital assets exposed to the risk-sentiment shift; this is exposure, not a guaranteed gain or loss.` : "You have no stock or digital-asset exposure to this risk-sentiment change yet.");
    }
    if (effects.property) impacts.push(game.properties.length ? `${money(E.propertyEquity(game), true)} of property equity receives the ${effects.property > 0 ? "tailwind" : "headwind"}; rents, vacancy, and fixed mortgage payments remain separate.` : "You own no property, so the valuation trend has no direct balance-sheet exposure yet.");
    if (effects.aiTrend) {
      const exposure = portfolioExposure(null, ["ai"]);
      const aiBusinesses = game.businesses.filter((owned) => ["saas", "robotics", "datacenter", "biolab"].includes(owned.type)).length;
      impacts.push(`${money(exposure, true)} is directly allocated to the AI index and ${aiBusinesses} owned venture${aiBusinesses === 1 ? " is" : "s are"} strongly AI-sensitive.`);
    }
    if (effects.spaceTrend) impacts.push(`${money(portfolioExposure(null, ["space"]), true)} is allocated to public space assets; orbital ventures receive the same directional trend.`);
    if (effects.energyTrend) impacts.push(`${money(portfolioExposure(null, ["energy", "copper"]), true)} is allocated to energy/copper. Power producers benefit from scarcity while data centers face higher input costs.`);
    if (effects.cryptoTrend) impacts.push(`${money(portfolioExposure(["Digital"]), true)} of digital assets receives this directional trend and retains its normal high volatility.`);
    if (effects.growth && game.businesses.length) impacts.push(`${game.businesses.length} operating venture${game.businesses.length === 1 ? "" : "s"} will encounter the growth change through revenue and customer demand in coming months.`);
    return impacts.slice(0, 5);
  }

  function renderOutcome() {
    const modal = $("#outcome-modal");
    const outcome = game.pendingOutcome;
    if (!outcome || game.pendingEvent) { modal.hidden = true; return; }
    $("#outcome-kicker").textContent = outcome.success ? "Project success" : "Project setback";
    $("#outcome-title").textContent = outcome.title;
    $("#outcome-body").textContent = outcome.body;
    $("#outcome-profit").textContent = `${outcome.profit >= 0 ? "+" : ""}${money(outcome.profit)}`;
    $("#outcome-profit").className = outcome.profit >= 0 ? "up" : "down";
    $("#outcome-payout").textContent = `${money(outcome.stake)} committed · ${money(outcome.payout)} returned`;
    $("#outcome-lesson").textContent = outcome.lesson;
    modal.querySelector(".outcome-panel").classList.toggle("success", outcome.success);
    modal.hidden = false;
    sound(outcome.success ? "success" : "warning");
  }

  function renderEnd() {
    if (!game.finished) return;
    const result = E.score(game);
    $("#end-summary").innerHTML = `<div class="end-score"><small>Allocator score</small><strong>${result.total.toLocaleString()}</strong><span>${esc(result.rank)}</span></div><div class="end-grid"><div><small>Net worth</small><strong>${money(E.netWorth(game), true)}</strong></div><div><small>Tax paid</small><strong>${money(game.stats.taxes, true)}</strong></div><div><small>Margin calls</small><strong>${game.stats.marginCalls}</strong></div></div>`;
    $("#end-modal").hidden = false;
  }

  function render() {
    renderHeader();
    renderOverview();
    renderMarkets();
    renderBusinesses();
    renderProperties();
    renderCredit();
    renderLedger();
    renderEvent();
    renderOutcome();
    renderEnd();
  }

  function switchTab(tab) {
    if (!$("#section-" + tab)) return;
    activeTab = tab;
    $$(".game-section").forEach((section) => section.classList.toggle("active", section.id === `section-${tab}`));
    $$('[data-tab-target]').forEach((button) => button.classList.toggle("active", button.dataset.tabTarget === tab));
    window.scrollTo({ top: 0, behavior: "smooth" });
    sound("click");
    if (tab === "overview") window.requestAnimationFrame(drawWealthChart);
    if (tab === "markets") window.requestAnimationFrame(drawSparklines);
  }

  function openTrade(assetId) {
    tradeAssetId = assetId;
    tradeSide = "buy";
    const asset = E.getAsset(assetId);
    $("#trade-title").textContent = asset.name;
    $("#trade-description").textContent = asset.description;
    $("#trade-symbol").textContent = asset.symbol;
    $("#trade-price").textContent = assetId === "btc" || assetId === "eth" ? money(game.prices[assetId]) : `$${game.prices[assetId].toFixed(2)}`;
    $("#trade-amount").value = Math.min(1000, Math.max(100, Math.floor(game.cash)));
    $$("[data-trade-side]").forEach((button) => button.classList.toggle("active", button.dataset.tradeSide === "buy"));
    $("#trade-modal").hidden = false;
    sound("click");
  }

  function closeTrade() {
    $("#trade-modal").hidden = true;
    tradeAssetId = null;
  }

  function showOnboarding() {
    $("#onboarding-reserve").textContent = `Keep at least ${money(game.livingExpenses * 6)} available before taking concentrated or leveraged risk.`;
    $("#onboarding-modal").hidden = false;
  }

  function advance(months) {
    let result = null;
    for (let index = 0; index < months; index += 1) {
      result = E.advanceMonth(game);
      if (!result.ok || game.pendingEvent || game.pendingOutcome || game.finished) break;
    }
    if (result?.ok) {
      save(); render(); sound(game.pendingEvent ? "event" : "advance");
      toast(result.message);
    } else commit(result, "warning");
  }

  function exportSave() {
    const blob = new Blob([E.serialize(game)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `capital-frontier-${game.year}-${game.month + 1}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Save file exported.");
    sound("success");
  }

  document.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab-target]");
    if (tabButton) { switchTab(tabButton.dataset.tabTarget); return; }
    const scenarioButton = event.target.closest("[data-scenario]");
    if (scenarioButton) { selectedScenario = scenarioButton.dataset.scenario; renderScenarios(); sound("click"); return; }
    const ledgerButton = event.target.closest("[data-ledger-target]");
    if (ledgerButton) { activeLedger = ledgerButton.dataset.ledgerTarget; renderLedger(); sound("click"); return; }
    const sideButton = event.target.closest("[data-trade-side]");
    if (sideButton) {
      tradeSide = sideButton.dataset.tradeSide;
      $$("[data-trade-side]").forEach((button) => button.classList.toggle("active", button.dataset.tradeSide === tradeSide));
      sound("click"); return;
    }
    const quickButton = event.target.closest("[data-quick-amount]");
    if (quickButton) {
      const quick = quickButton.dataset.quickAmount;
      if (quick === "max") {
        const holding = game.portfolio[tradeAssetId];
        $("#trade-amount").value = Math.floor(tradeSide === "buy" ? Math.max(0, game.cash) : holding ? holding.units * game.prices[tradeAssetId] : 0);
      } else $("#trade-amount").value = quick;
      sound("click"); return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const { action } = actionButton.dataset;
    if (action === "advance") advance(Number(actionButton.dataset.months));
    else if (action === "open-trade") openTrade(actionButton.dataset.asset);
    else if (action === "close-trade") closeTrade();
    else if (action === "submit-trade") {
      const amount = Number($("#trade-amount").value);
      const result = tradeSide === "buy" ? E.buyAsset(game, tradeAssetId, amount) : E.sellAsset(game, tradeAssetId, amount);
      if (commit(result, "cash")) closeTrade();
    }
    else if (action === "buy-business") commit(E.buyBusiness(game, actionButton.dataset.business), "cash");
    else if (action === "upgrade-business") commit(E.upgradeBusiness(game, actionButton.dataset.id), "cash");
    else if (action === "sell-business") commit(E.sellBusiness(game, actionButton.dataset.id), "cash");
    else if (action === "buy-property") commit(E.buyProperty(game, actionButton.dataset.property), "cash");
    else if (action === "sell-property") commit(E.sellProperty(game, actionButton.dataset.id), "cash");
    else if (action === "take-loan") commit(E.takeLoan(game, Number(actionButton.dataset.amount)), "cash");
    else if (action === "repay-loan") commit(E.repayLoan(game, actionButton.dataset.id, Number(actionButton.dataset.amount)), "cash");
    else if (action === "margin-borrow") commit(E.borrowMargin(game, Number(actionButton.dataset.amount)), "cash");
    else if (action === "margin-repay") commit(E.repayMargin(game, actionButton.dataset.amount === "all" ? game.marginLoan : Number(actionButton.dataset.amount)), "cash");
    else if (action === "open-option") commit(E.openOption(game, actionButton.dataset.asset, actionButton.dataset.direction, 1000), "cash");
    else if (action === "open-future") commit(E.openFuture(game, actionButton.dataset.asset, actionButton.dataset.direction, 1000), "cash");
    else if (action === "close-derivative") commit(E.closeDerivative(game, actionButton.dataset.id), "cash");
    else if (action === "dismiss-event") { E.dismissEvent(game); save(); render(); sound("click"); }
    else if (action === "event-choice") commit(E.resolveEventChoice(game, actionButton.dataset.choice), actionButton.dataset.choice === "hold" ? "click" : "cash");
    else if (action === "take-deal") commit(E.takeDeal(game, actionButton.dataset.deal), "cash");
    else if (action === "dismiss-outcome") { E.dismissOutcome(game); save(); render(); sound("click"); }
    else if (action === "begin-plan") { $("#onboarding-modal").hidden = true; switchTab("markets"); }
    else if (action === "close-onboarding") { $("#onboarding-modal").hidden = true; sound("click"); }
    else if (action === "objective") {
      if (actionButton.dataset.guideAction === "advance") advance(1);
      else if (actionButton.dataset.guideTarget) switchTab(actionButton.dataset.guideTarget);
    }
    else if (action === "bankruptcy") {
      if (window.confirm("Liquidate nonexempt assets and discharge eligible debt? This cannot be undone.")) commit(E.fileBankruptcy(game), "warning");
    }
    else if (action === "export-save") exportSave();
    else if (action === "new-game") {
      localStorage.removeItem(SAVE_KEY);
      game = E.createGame("bootstrap", Date.now());
      selectedScenario = "bootstrap";
      $("#end-modal").hidden = true;
      $("#start-modal").hidden = false;
      renderScenarios(); render();
    }
  });

  document.addEventListener("change", (event) => {
    const control = event.target.closest('[data-action="reinvest"]');
    if (control) commit(E.setReinvestment(game, control.dataset.id, Number(control.value) / 100), "click");
  });

  $("#start-game").addEventListener("click", () => {
    game = E.createGame(selectedScenario, Date.now());
    $("#start-modal").hidden = true;
    save(); render(); sound("success");
    showOnboarding();
    toast("Your first month is open. Allocate deliberately, then advance time.");
  });

  $("#continue-game").addEventListener("click", () => {
    try {
      game = E.hydrate(localStorage.getItem(SAVE_KEY));
      $("#start-modal").hidden = true;
      render(); sound("success");
      if (game.monthsElapsed === 0 && game.actions === 0) showOnboarding();
    } catch (error) {
      toast(error.message, true);
    }
  });

  $("#sound-toggle").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    if (!soundEnabled) {
      stopMusic();
      if (audioContext && audioContext.state === "running") audioContext.suspend();
    } else {
      ensureAudio();
      startMusic();
    }
    renderHeader();
    if (soundEnabled) sound("success");
  });

  document.addEventListener("visibilitychange", () => {
    if (!audioContext) return;
    if (document.hidden && audioContext.state === "running") audioContext.suspend();
    else if (!document.hidden && soundEnabled) {
      audioContext.resume();
      startMusic();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!$("#trade-modal").hidden) closeTrade();
    }
    if (event.code === "Space" && !event.repeat && $("#start-modal").hidden && $("#trade-modal").hidden && $("#event-modal").hidden) {
      event.preventDefault(); advance(1);
    }
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (activeTab === "overview") drawWealthChart();
      if (activeTab === "markets") drawSparklines();
    }, 120);
  });

  renderScenarios();
  render();
})();
