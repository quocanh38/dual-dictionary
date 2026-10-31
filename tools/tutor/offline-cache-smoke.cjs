// Run from the repository root with playwright-core on NODE_PATH. This uses
// system Chrome and a temporary localhost server; it drops network after caching.
const { chromium } = require("playwright-core");
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert/strict");
const root = process.cwd();
const s = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory())
    f = path.join(f, "index.html");
  if (!fs.existsSync(f)) return res.writeHead(404).end();
  res.setHeader(
    "Content-Type",
    f.endsWith(".js")
      ? "text/javascript"
      : f.endsWith(".css")
        ? "text/css"
        : f.endsWith(".html")
          ? "text/html"
        : f.endsWith(".svg")
          ? "image/svg+xml"
          : "application/octet-stream",
  );
  res.end(fs.readFileSync(f));
});
(async () => {
  const { getStudyExercises } = await import(path.join(root, "js/study-content.js"));
  const firstIELTSQuestion = getStudyExercises("IELTS Academic", "band-5").find((question) => !question.diagnosticSet);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + s.address().port;
  const b = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [1280, 390]) {
      const c = await b.newContext({ viewport: { width, height: 900 } }),
        p = await c.newPage();
      p.setDefaultTimeout(20000);
      let errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base, { waitUntil: "domcontentloaded" });
      await p.locator("#onboarding-dialog").waitFor({ state: "visible" });
      await p.locator("#onboarding-dialog .dialog-close").click();
      await p.evaluate(async () => await navigator.serviceWorker.ready);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => !!navigator.serviceWorker.controller);
      const cachedAssets = await p.evaluate(async () =>
        Promise.all([
          "./js/offline-study.js",
          "./js/assignment-engine.js",
          "./js/study-content.js",
          "./js/ielts-meta-practice.js",
          "./assets/study/toeic-office-desk.svg",
          "./assets/study/ielts-compost-process.svg",
          "./assets/study/ielts-campus-maps.svg",
          "./assets/study/ielts-transport-line-graph.svg",
        ].map(async (asset) => !!(await caches.match(new URL(asset, location.href).href)))),
      );
      assert.deepEqual(cachedAssets, [true, true, true, true, true, true, true, true]);
      await c.setOffline(true);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForFunction(
        () => !!document.querySelector("#offline-exam-lab"),
      );
      await p
        .locator('.bottom-nav a[data-nav="practice"]')
        .click()
        .catch(async () =>
          p.locator('.app-nav a[data-nav="practice"]').click(),
        );
      await p.locator("#offline-exam-lab > summary").click();
      await p.locator("#btn-exam-begin").click();
      await p.locator("#exam-question").waitFor({ state: "visible" });
      await p.locator(`input[name="exam-answer"][value="${firstIELTSQuestion.answer}"]`).check();
      await p.locator("[data-exam-check]").click();
      await p.getByText("Correct", { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await p.screenshot({
        path: `/tmp/offline-practice-${width}.png`,
        fullPage: true,
      });
      console.log(
        `PASS ${width}px app shell and first offline question after network loss; question/content modules and original illustration cached; zero page errors`,
      );
      await c.close();
    }
  } finally {
    await b.close();
    s.close();
  }
})().catch((e) => {
  console.error(e);
  s.close();
  process.exit(1);
});
