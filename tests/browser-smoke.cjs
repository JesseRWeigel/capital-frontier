"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

let browser;

(async () => {
  const outputDir = path.join(__dirname, "screenshots");
  fs.mkdirSync(outputDir, { recursive: true });
  browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Capital Frontier", exact: true }).last().waitFor();
  await page.locator('[data-scenario="technologist"]').click();
  await page.getByRole("button", { name: "Begin in July 2026" }).click();
  await page.locator("#start-modal").waitFor({ state: "hidden" });
  await page.locator("#onboarding-modal").waitFor({ state: "visible" });
  if (await page.locator(".onboarding-steps li").count() !== 3) errors.push("onboarding does not show three concrete first steps");
  await page.locator('[data-action="begin-plan"]').click();
  await page.locator("#onboarding-modal").waitFor({ state: "hidden" });

  await page.locator('[data-action="open-trade"][data-asset="vti"]').click();
  await page.locator("#trade-amount").fill("1000");
  await page.locator('[data-action="submit-trade"]').click();
  await page.locator("#holdings-list .position-row b", { hasText: "VTI" }).waitFor();
  if (!await page.locator("#header-cash").isVisible()) errors.push("desktop cash header is not visible on Markets");
  if (await page.locator("#sound-toggle").getAttribute("aria-pressed") !== "true") errors.push("audio is not enabled by default");

  await page.locator('.section-tabs [data-tab-target="businesses"]').click();
  if (!await page.locator("#header-cash").isVisible()) errors.push("desktop cash header is not visible on Ventures");
  await page.locator('[data-action="buy-business"][data-business="detailing"]').click();
  await page.getByText("Operating company").waitFor();
  await page.locator('[data-action="advance"][data-months="3"]').click();
  if (await page.locator("#event-modal").isVisible()) await page.locator('[data-action="event-choice"][data-choice="hold"]').click();
  await page.locator('.section-tabs [data-tab-target="overview"]').click();
  if (!await page.locator("#objective-list").isVisible()) errors.push("dynamic objective list is not visible on Overview");

  let eventAudited = false;
  for (let index = 0; index < 7 && !eventAudited; index += 1) {
    await page.locator('[data-action="advance"][data-months="1"]').click();
    if (await page.locator("#event-modal").isVisible()) {
      if (!await page.locator("#event-context").textContent()) errors.push("event has no economic context");
      if (await page.locator("#event-effects-list .effect-chip").count() < 1) errors.push("event has no quantified effect chips");
      if (await page.locator("#event-financial-impact .impact-line").count() < 1) errors.push("event has no player-specific financial impact");
      const eventBox = await page.locator("#event-modal .event-panel").boundingBox();
      if (eventBox && eventBox.height > 970) errors.push(`event dialog exceeds desktop viewport (${eventBox.height}px)`);
      await page.screenshot({ path: path.join(outputDir, "event.png"), fullPage: false });
      eventAudited = true;
      await page.locator('[data-action="event-choice"][data-choice="pilot"]').click();
      if (!await page.locator("#project-panel").isVisible()) errors.push("funded event project is not visible on Overview");
    }
  }
  if (!eventAudited) errors.push("no event appeared by the scheduled March 2027 milestone");

  let outcomeAudited = false;
  for (let index = 0; index < 10 && !outcomeAudited; index += 1) {
    if (await page.locator("#outcome-modal").isVisible()) {
      if (!await page.locator("#outcome-profit").textContent()) errors.push("project outcome has no net result");
      await page.screenshot({ path: path.join(outputDir, "outcome.png"), fullPage: false });
      outcomeAudited = true;
      await page.locator('[data-action="dismiss-outcome"]').click();
      break;
    }
    if (await page.locator("#event-modal").isVisible()) {
      await page.locator('[data-action="event-choice"][data-choice="hold"]').click();
    } else {
      await page.locator('[data-action="advance"][data-months="1"]').click();
    }
  }
  if (!outcomeAudited) errors.push("funded event project did not produce a visible outcome");
  if (await page.locator("#deal-grid .deal-card").count() !== 3) errors.push("quarterly Deal Board does not show three opportunities");
  const availableDeal = page.locator('#deal-grid [data-action="take-deal"]:not([disabled])').first();
  if (await availableDeal.count()) {
    await availableDeal.click();
    if (!await page.locator("#project-panel").isVisible()) errors.push("accepted Deal Board project is not visible in active projects");
  } else {
    errors.push("Deal Board has no affordable opportunity during smoke scenario");
  }

  const canvasPixels = await page.locator("#wealth-chart").evaluate((canvas) => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 16) if (pixels[i + 3] > 0) colored += 1;
    return colored;
  });
  if (canvasPixels < 100) errors.push(`wealth canvas is nearly blank (${canvasPixels} sampled pixels)`);
  const desktopOverflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (desktopOverflow.scroll > desktopOverflow.client + 1) errors.push(`desktop horizontal overflow ${desktopOverflow.scroll}/${desktopOverflow.client}`);
  await page.screenshot({ path: path.join(outputDir, "desktop.png"), fullPage: true });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  mobile.on("pageerror", (error) => errors.push(`mobile pageerror: ${error.message}`));
  await mobile.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Continue saved game" }).click();
  await mobile.locator("#start-modal").waitFor({ state: "hidden" });
  await mobile.locator('.mobile-nav [data-tab-target="markets"]').click();
  await mobile.locator("#asset-table").waitFor();
  if (!await mobile.locator("#header-cash").isVisible()) errors.push("mobile cash header is not visible on Markets");
  if (!await mobile.locator("#mission-strip").isVisible()) errors.push("mobile current objective is not visible on Markets");
  const mobileOverflow = await mobile.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  if (mobileOverflow.scroll > mobileOverflow.client + 1) errors.push(`mobile horizontal overflow ${mobileOverflow.scroll}/${mobileOverflow.client}`);
  await mobile.screenshot({ path: path.join(outputDir, "mobile.png"), fullPage: true });

  await browser.close();
  browser = null;
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, canvasPixels, desktopOverflow, mobileOverflow, screenshots: outputDir }, null, 2));
  }
})().catch(async (error) => {
  if (browser) await browser.close();
  console.error(error);
  process.exitCode = 1;
});
