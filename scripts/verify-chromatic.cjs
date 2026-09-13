/* 验证自由模式重构:模式切换可见差异、音名尺交互、armed 目标重算。 */
const { chromium } = require("playwright-core");

const EXECUTABLE = process.env.CHROMIUM_PATH;
const fail = [];

function check(name, condition, detail) {
  if (!condition) {
    fail.push(`${name} :: ${JSON.stringify(detail)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  // ===== A. 普通页:自动跟随 ↔ 自由模式 往返切换 =====
  await page.goto("http://localhost:5175/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  check("auto: modeBar", (await page.locator(".mode-bar").count()) === 1);
  check("auto: 3 mode buttons", (await page.locator(".mode-switch button").count()) === 3);
  check(
    "auto: active=自动跟随",
    (await page.locator('.mode-switch button[aria-pressed="true"]').textContent()) === "自动跟随",
  );
  check("auto: rail visible", (await page.locator(".rail").count()) === 1);
  check("auto: no ruler", (await page.locator(".chromatic-ruler").count()) === 0);
  check("auto: preset bar", (await page.locator(".preset-bar").count()) === 1);

  await page.getByRole("button", { name: "自由模式" }).click();
  await page.waitForTimeout(250);
  check(
    "chrom: active=自由模式",
    (await page.locator('.mode-switch button[aria-pressed="true"]').textContent()) === "自由模式",
  );
  check("chrom: rail hidden", (await page.locator(".rail").count()) === 0);
  check("chrom: preset hidden", (await page.locator(".preset-bar").count()) === 0);
  check("chrom: ruler visible", (await page.locator(".chromatic-ruler").count()) === 1);
  check("chrom: 12 note cells", (await page.locator(".note-ruler-cell").count()) === 12);
  check("chrom: meter kept", (await page.locator(".meter").count()) === 1);
  check("chrom: stage kept", (await page.locator(".stage").count()) === 1);
  check(
    "chrom: hint",
    (await page.locator(".ruler-hint").textContent()).includes("自动以最近的音为参照"),
  );

  // armed:A 设为目标 → chip + armed 高亮 + 八度显示;再点一次取消
  await page.locator(".note-ruler-cell", { hasText: /^A$/ }).click();
  await page.waitForTimeout(200);
  check("armed: chip", (await page.locator(".target-chip").textContent()).includes("目标 A"));
  check(
    "armed: exactly one armed cell",
    (await page.locator('.note-ruler-cell[data-armed="true"]').count()) === 1,
  );
  check(
    "armed: octave shown",
    (await page.locator(".note-ruler-octave").textContent()).trim() !== "",
  );
  await page.locator('.note-ruler-cell[data-armed="true"]').click();
  await page.waitForTimeout(200);
  check("disarm: chip gone", (await page.locator(".target-chip").count()) === 0);
  check("disarm: hint back", (await page.locator(".ruler-hint").count()) === 1);

  // 切回自动跟随:音名尺消失,弦轨回来
  await page.getByRole("button", { name: "自动跟随" }).click();
  await page.waitForTimeout(300);
  check("back: rail visible", (await page.locator(".rail").count()) === 1);
  check("back: ruler hidden", (await page.locator(".chromatic-ruler").count()) === 0);
  check(
    "back: active=自动跟随",
    (await page.locator('.mode-switch button[aria-pressed="true"]').textContent()) === "自动跟随",
  );

  // 持久化:切自由 → 刷新 → 仍是自由模式 + 音名尺在
  await page.getByRole("button", { name: "自由模式" }).click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  check(
    "persist: still chromatic",
    (await page.locator('.mode-switch button[aria-pressed="true"]').textContent()) === "自由模式",
  );
  check("persist: ruler visible", (await page.locator(".chromatic-ruler").count()) === 1);

  // ===== B. demo 夹具页:只验证展示,不提供模式切换 =====
  await page.goto("http://localhost:5175/?demo=chromatic", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  check(
    "demo: mode switch hidden",
    (await page.locator(".mode-switch").count()) === 0,
  );
  check(
    "demo: demo note shown",
    (await page.locator(".mode-bar-demo-note").textContent()).includes("demo 模式"),
  );
  check(
    "demo: detected G# highlighted",
    (await page.locator('.note-ruler-cell[data-detected="true"]').textContent()).includes("G#"),
  );
  check(
    "demo: headline 偏高到G#2",
    (await page.locator(".status-line").textContent()).includes("偏高 — 放松到 G#2"),
  );
  check(
    "demo: target label 自由参照",
    (await page.locator(".stage-data").textContent()).includes("自由"),
  );

  await page.screenshot({ path: "chromatic-mode.png", fullPage: false });
  await browser.close();

  if (fail.length > 0) {
    console.error("FAILED CHECKS:");
    for (const item of fail) console.error(" -", item);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
