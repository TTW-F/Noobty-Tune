/* M3 自定义调弦:编辑器打开/转轮改音/保存/持久化/删除/同频警示 全流程验证 */
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto("http://localhost:5175/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // 1) 打开编辑器:6 行转轮
  await page.locator(".preset-chip-add").click();
  await page.waitForTimeout(200);
  check("open: dialog visible", (await page.locator(".editor-card").count()) === 1);
  check("open: 6 rows", (await page.locator(".editor-row").count()) === 6);
  check("open: 6 drums", (await page.locator(".note-drum").count()) === 6);

  // 2) 转轮改 6 弦:E2 → ArrowUp ×2 → F#2
  const drum6 = page.locator('.editor-row').first().locator(".note-drum");
  await drum6.press("ArrowUp");
  await drum6.press("ArrowUp");
  await page.waitForTimeout(150);
  const selectedLabel = await drum6.getAttribute("aria-label");
  const selectedOption = await page
    .locator(".editor-row")
    .first()
    .locator('.note-drum-item[data-selected="true"]')
    .textContent();
  check("drum: label", selectedLabel === "6 弦音高", selectedLabel);
  check("drum: E2 +2 semitones = F#2", selectedOption === "F#2", selectedOption);

  // 3) 同频警示:5 弦(A2)降到 F#2 需 3 次 ArrowDown → 与 6 弦同频,两行标记
  const drum5 = page.locator(".editor-row").nth(1).locator(".note-drum");
  for (let i = 0; i < 3; i += 1) {
    await drum5.press("ArrowDown");
  }
  await page.waitForTimeout(150);
  check(
    "dup: two rows flagged",
    (await page.locator('.editor-row[data-dup="true"]').count()) === 2,
    await page.locator(".editor-row[data-dup]").count(),
  );

  // 4) 恢复 5 弦后保存:命名 + chip 出现并激活,轨道 6 弦变 F#2
  for (let i = 0; i < 3; i += 1) {
    await drum5.press("ArrowUp");
  }
  await page.waitForTimeout(120);
  check("dup: cleared", (await page.locator('.editor-row[data-dup="true"]').count()) === 0);
  await page.locator(".editor-name").fill("测试调弦");
  await page.locator(".editor-save").click();
  await page.waitForTimeout(250);
  check("save: editor closed", (await page.locator(".editor-card").count()) === 0);
  check("save: chip exists", (await page.locator(".preset-chip-custom").count()) === 1);
  check(
    "save: chip pressed",
    (await page.locator(".preset-chip-custom").getAttribute("aria-pressed")) === "true",
  );
  check(
    "save: rail 6弦 = F#2",
    (await page.locator('.string-cell').first().textContent()).includes("F#2"),
  );
  const storedSel = await page.evaluate(() => window.localStorage.getItem("noobty-tuner:selection"));
  check("save: selection persisted custom", storedSel.includes("custom:"), storedSel);
  const storedCustom = await page.evaluate(() =>
    window.localStorage.getItem("noobty-tuner:custom-tunings"),
  );
  check("save: custom persisted", storedCustom.includes("测试调弦"), storedCustom?.slice(0, 80));

  // 5) 刷新:chip 仍在且激活,轨道保持 F#2
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  check("reload: chip persists", (await page.locator(".preset-chip-custom").count()) === 1);
  check(
    "reload: chip pressed",
    (await page.locator(".preset-chip-custom").getAttribute("aria-pressed")) === "true",
  );
  check(
    "reload: rail 6弦 = F#2",
    (await page.locator(".string-cell").first().textContent()).includes("F#2"),
  );

  // 6) 删除自定义调弦(确认弹窗)→ 回落标准 E
  page.on("dialog", (dialog) => void dialog.accept());
  await page.locator(".preset-chip-delete").click();
  await page.waitForTimeout(300);
  check("delete: chip gone", (await page.locator(".preset-chip-custom").count()) === 0);
  check(
    "delete: fallback 标准 E pressed",
    (await page
      .locator('.preset-chip[aria-pressed="true"]')
      .first()
      .textContent()) === "标准 E",
  );
  check(
    "delete: rail back to E2",
    (await page.locator(".string-cell").first().textContent()).includes("E2"),
  );

  // 7) 增减弦:开编辑器 → 加到 7 根 → 移除回 6
  await page.locator(".preset-chip-add").click();
  await page.waitForTimeout(200);
  await page.locator(".editor-strings-button").first().click();
  await page.waitForTimeout(150);
  check("strings: add → 7 rows", (await page.locator(".editor-row").count()) === 7);
  await page.locator(".editor-strings-button").nth(1).click();
  await page.waitForTimeout(150);
  check("strings: remove → 6 rows", (await page.locator(".editor-row").count()) === 6);
  await page.locator(".editor-cancel").click();
  await page.waitForTimeout(150);
  check("cancel: editor closed", (await page.locator(".editor-card").count()) === 0);

  await page.screenshot({ path: "custom-editor.png" });
  await browser.close();

  if (fail.length > 0) {
    console.error("FAILED CHECKS:");
    for (const item of fail) console.error(" -", item);
    process.exit(1);
  }
  console.log("ALL CUSTOM TUNING CHECKS PASSED");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
