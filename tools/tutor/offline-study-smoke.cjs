const { chromium } = require("playwright-core");
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert/strict");
const root = process.cwd();
const server = http.createServer((req, res) => {
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
function wav() {
  const n = 8000,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}
(async () => {
  const { getStudyExercises, STUDY_CONTENT_PACKS, IELTS_DIAGNOSTIC_FORM } = await import(path.join(root, 'js/study-content.js'));
  const ieltsQuestions = getStudyExercises('IELTS Academic', 'band-5').filter((q) => !q.diagnosticSet);
  const advancedReading = getStudyExercises('IELTS Academic', 'band-6-5').filter((q) => q.skill === 'Reading' && !q.diagnosticSet);
  const ieltsDiagnostic = getStudyExercises('IELTS Academic').filter((q) => q.diagnosticSet === IELTS_DIAGNOSTIC_FORM).sort((a, b) => a.skill === b.skill ? a.diagnosticOrder - b.diagnosticOrder : a.skill === 'Listening' ? -1 : 1);
  const toeicQuestions = getStudyExercises('TOEIC Listening & Reading');
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true,
      permissions: ["microphone"],
    });
    const page = await ctx.newPage(),
      errors = [];
    await page.addInitScript(() => {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: function (text) { this.text = text; }, configurable: true });
      Object.defineProperty(window, 'speechSynthesis', { value: { speak() {}, cancel() {} }, configurable: true });
    });
    page.setDefaultTimeout(15000);
    page.on(
      "console",
      (m) => m.type() === "error" && console.log("CONSOLE", m.text()),
    );
    page.on("pageerror", (e) => errors.push(e.message));
    console.log("open");
    await page.goto(base, { waitUntil: "domcontentloaded" });
    console.log("loaded");
    await page.locator("#onboarding-dialog").waitFor({ state: "visible" });
    await page.locator("#onboarding-dialog .dialog-close").click();
    console.log("onboard");
    await page.locator('.bottom-nav a[data-nav="vault"]').click();
    await page.locator("#vault-view.vault-is-empty").waitFor();
    assert.equal(
      await page.locator('#vault-tabs button[data-tab="journal"]').isVisible(),
      true,
    );
    await page.locator('#vault-tabs button[data-tab="journal"]').click();
    assert.equal(await page.locator("#journal-panel").isVisible(), true);
    await page.locator("#journal-input").fill("A recoverable journal draft.");
    await page.locator("#btn-journal-timer").click();
    const timerDeadline = await page.evaluate(
      () => JSON.parse(localStorage.getItem("dd-journal-draft")).deadline,
    );
    await page.reload();
    await page.locator('.bottom-nav a[data-nav="vault"]').click();
    await page.locator('#vault-tabs button[data-tab="journal"]').click();
    assert.equal(
      await page.locator("#journal-input").inputValue(),
      "A recoverable journal draft.",
    );
    assert.ok(
      (await page.evaluate(
        () => JSON.parse(localStorage.getItem("dd-journal-draft")).deadline,
      )) > 0,
    );
    assert.equal(await page.locator("#journal-timer").isVisible(), true);
    console.log("PASS empty Vault Journal entry, draft and countdown recovery");
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    await page.locator("#offline-exam-lab > summary").click();
    console.log("practice");
    await page.locator("#btn-exam-begin").click();
    await page.locator("#exam-question").waitFor({ state: "visible" });
    await page.locator(`input[name="exam-answer"][value="${ieltsQuestions[0].answer === 0 ? 1 : 0}"]`).check();
    await page.locator("[data-exam-check]").click();
    await page.getByText("Review this answer", { exact: false }).waitFor();
    await page.reload();
    await page.locator("#offline-exam-lab > summary").click();
    await page.locator("#exam-resume").click();
    await page.getByText("Review this answer", { exact: false }).waitFor();
    assert.match(
      await page.locator("#exam-question").innerText(),
      /Review this answer/,
    );
    const vaultHasReviewItem = await page.evaluate(async () => {
      const request = indexedDB.open("mdx-dict");
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const read = db
          .transaction("items", "readonly")
          .objectStore("items")
          .getAll();
        read.onsuccess = () =>
          resolve(
            read.result.some(
              (item) =>
                item.userData?.tags?.includes("exam-mistake") &&
                item.userData.status !== "known",
            ),
          );
        read.onerror = () => reject(read.error);
      });
    });
    assert.equal(vaultHasReviewItem, true);
    console.log("PASS wrong-answer feedback and exam session resume");
    console.log("PASS incorrect answer was saved as a Vault review item");
    assert.ok((await page.locator("#study-pack-status").innerText()).includes(`v${STUDY_CONTENT_PACKS[0].version}`));
    const answerQuestion = async (q) => {
      if (q.type === "choice" || q.type === "audio-choice") await page.locator(`input[name="exam-answer"][value="${q.answer}"]`).check();
      else if (q.type === "short-answer") await page.locator("[data-answer-text]").fill(q.acceptedAnswers?.[0] || "test response");
      else if (q.type === "gap-fill") for (const gap of q.gaps) await page.locator(`[data-answer-gap="${gap.id}"]`).fill(gap.acceptedAnswers?.[0] || "test response");
      else if (q.type === "matching") for (const pair of q.pairs) await page.locator(`[data-answer-match="${pair.id}"]`).selectOption(pair.answer);
      await page.locator("[data-exam-check]").click();
      await page.locator("#exam-question .exam-feedback").waitFor();
    };
    for (const [i, q] of ieltsQuestions.slice(1).entries()) {
      await page.locator("[data-exam-next]").click();
      await page.waitForFunction(([n, total]) => document.querySelector('#exam-question .hint')?.textContent.includes(`${n}/${total}`), [i + 2, ieltsQuestions.length]);
      await answerQuestion(q);
    }
    await page.locator("[data-exam-next]").click();
    await page.locator(".exam-result").waitFor();
    await page.locator(".offline-study-stats > summary").click();
    await page.getByText("sets completed", { exact: false }).waitFor();
    assert.match(await page.locator("#offline-study-stats").innerText(), /IELTS Academic · Listening/);
    console.log("PASS choice, short answer, gap-fill and matching; offline skill statistics");
    await page.locator("#ielts-pathway-stage").selectOption("band-6");
    await page.waitForFunction((count) => document.querySelector("#study-pack-status")?.textContent.includes(`${count} practice questions in this stage`), getStudyExercises("IELTS Academic", "band-6").filter((q) => !q.diagnosticSet).length);
    assert.match(await page.locator("#ielts-stage-guidance").innerText(), /Linear Thinking/);
    await page.locator("#exam-skill").selectOption("Reading");
    await page.waitForFunction(() => document.querySelector("#study-pack-status")?.textContent.includes("40/40 reading diagnostic questions"));
    await page.locator("#ielts-pathway-stage").selectOption("band-6-5");
    await page.waitForFunction((count) => document.querySelector("#study-pack-status")?.textContent.includes(`${count} practice questions in this stage`) && document.querySelector("#study-pack-status")?.textContent.includes("40/40 reading diagnostic questions"), advancedReading.length);
    await page.locator("#btn-exam-begin").click();
    await page.waitForFunction((count) => document.querySelector("#exam-question .hint")?.textContent.includes(`1/${count}`), advancedReading.length);
    assert.match(await page.locator("#exam-question .ielts-learning-scaffold").innerText(), /6\.0 → 6\.5.*Linear Thinking/s);
    assert.ok((await page.locator("#exam-question").innerText()).includes(advancedReading[0].prompt));
    for (const [i, q] of advancedReading.entries()) {
      if (i) await page.locator("[data-exam-next]").click();
      await page.waitForFunction(([n, count]) => document.querySelector("#exam-question .hint")?.textContent.includes(`${n}/${count}`), [i + 1, advancedReading.length]);
      if (q.type === "choice") await page.locator(`input[name="exam-answer"][value="${q.answer}"]`).check();
      else if (q.type === "short-answer") await page.locator("[data-answer-text]").fill("gentle slopes");
      await page.waitForFunction(() => !document.querySelector("[data-exam-check]") || !document.querySelector("[data-exam-check]").disabled);
      if (!(await page.locator("[data-exam-check]").isEnabled())) throw new Error(`No complete response for ${q.id}; active prompt: ${(await page.locator("#exam-question").innerText()).slice(0, 120)}`);
      await page.locator("[data-exam-check]").click();
      await page.locator("#exam-question .exam-feedback").waitFor();
      assert.match(await page.locator("#exam-question .exam-feedback").innerText(), /Correct/);
    }
    await page.locator("[data-exam-next]").click();
    await page.locator(".exam-result").waitFor();
    assert.match(await page.locator(".exam-result").innerText(), new RegExp(`${advancedReading.length}\\/${advancedReading.length} answered correctly`));
    console.log("PASS staged IELTS filtering, per-item Linear Thinking scaffold, and advanced Reading keys");
    assert.equal(ieltsDiagnostic.filter((q) => q.skill === "Listening").length, 40);
    assert.equal(ieltsDiagnostic.filter((q) => q.skill === "Reading").length, 40);
    await page.locator("#exam-mode").selectOption("diagnostic");
    await page.locator("#exam-skill").selectOption("all");
    assert.equal(await page.locator("#ielts-pathway-stage").isVisible(), false);
    await page.locator("#btn-exam-begin").click();
    await page.waitForFunction(() => document.querySelector("#exam-question .hint")?.textContent.includes("1/80"));
    assert.equal(await page.locator("#exam-question .ielts-learning-scaffold").count(), 0);
    assert.match(await page.locator("#exam-timer").innerText(), /90:00/);
    await page.locator("[data-play-section]").click();
    await page.waitForFunction(() => document.querySelector("[data-play-section]")?.disabled === true);
    assert.equal(await page.locator("[data-play-section]").isDisabled(), true);
    for (const [i, q] of ieltsDiagnostic.entries()) {
      await page.waitForFunction((n) => document.querySelector("#exam-question .hint")?.textContent.includes(`${n}/80`), i + 1);
      if (q.type === "choice" || q.type === "audio-choice") await page.locator(`input[name="exam-answer"][value="${q.answer}"]`).check();
      else if (q.type === "short-answer") await page.locator("[data-answer-text]").fill(q.acceptedAnswers[0]);
      else if (q.type === "gap-fill") for (const gap of q.gaps) await page.locator(`[data-answer-gap="${gap.id}"]`).fill(gap.acceptedAnswers[0]);
      else if (q.type === "matching") for (const pair of q.pairs) await page.locator(`[data-answer-match="${pair.id}"]`).selectOption(pair.answer);
      await page.waitForFunction(() => !document.querySelector("[data-exam-check]") || !document.querySelector("[data-exam-check]").disabled);
      await page.locator("[data-exam-next]").click();
    }
    await page.locator(".exam-result").waitFor();
    const diagnosticResult = await page.locator(".exam-result").innerText();
    assert.match(diagnosticResult, /Listening: 40\/40 correct/);
    assert.match(diagnosticResult, /Reading: 40\/40 correct/);
    assert.match(diagnosticResult, /Suggested next practice stage: Chặng 3 · 6\.5 → 7\.0/);
    assert.match(diagnosticResult, /do not produce an official or overall four-skill band/);
    await page.locator('[data-use-diagnostic-stage="band-7"][data-diagnostic-skill="Reading"]').click();
    assert.equal(await page.locator("#exam-mode").inputValue(), "practice");
    assert.equal(await page.locator("#exam-skill").inputValue(), "Reading");
    assert.equal(await page.locator("#ielts-pathway-stage").inputValue(), "band-7");
    console.log("PASS 40-question per-skill diagnostics, one-play-per-Part voice, independent stage suggestions and stage shortcut");
    await page.locator("#exam-select").selectOption("TOEIC Listening & Reading");
    await page.locator("#exam-skill").selectOption("all");
    await page.locator("#exam-mode").selectOption("timed");
    assert.equal(await page.locator("#ielts-pathway-stage").isVisible(), false);
    await page.locator("#btn-exam-begin").click();
    await page.locator("#exam-timer").waitFor();
    const initialDeadline = await page.evaluate(async () => {
      const q = indexedDB.open("mdx-dict");
      const db = await new Promise((ok, no) => { q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
      return await new Promise((ok, no) => { const r = db.transaction("study").objectStore("study").getAll(); r.onsuccess = () => ok(r.result.find((x) => x.type === "exam-session" && x.exam.includes("TOEIC") && x.mode === "timed").deadlineAt); r.onerror = () => no(r.error); });
    });
    assert.ok(initialDeadline > Date.now());
    await page.reload();
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    await page.locator("#offline-exam-lab > summary").click();
    await page.locator("#exam-resume").click();
    await page.locator("#exam-timer").waitFor();
    await page.screenshot({ path: "/tmp/offline-timed-390.png", fullPage: true });
    const toeicAnswers = [2, 1, 1, 0, 1, 1, 1, 0, ...toeicQuestions.slice(8).map(() => 0)];
    for (let i = 0; i < toeicAnswers.length; i++) {
      await page.waitForFunction(([n, total]) => document.querySelector("#exam-question .hint")?.textContent.includes(`${n}/${total}`), [i + 1, toeicQuestions.length]);
      await page.locator(`input[name="exam-answer"][value="${toeicAnswers[i]}"]`).check();
      if (i === 0) assert.equal(await page.locator("#exam-question .exam-feedback").count(), 0);
      await page.locator("[data-exam-next]").click();
      if (i === 0) {
        await page.locator("[data-exam-prev]").click();
        await page.waitForFunction((total) => document.querySelector("#exam-question .hint")?.textContent.includes(`1/${total}`), toeicQuestions.length);
        assert.equal(await page.locator('input[name="exam-answer"]:checked').inputValue(), "2");
        await page.locator("[data-exam-next]").click();
        await page.waitForFunction((total) => document.querySelector("#exam-question .hint")?.textContent.includes(`2/${total}`), toeicQuestions.length);
      }
    }
    await page.waitForSelector(".exam-result", { timeout: 5000 });
    assert.match(await page.locator(".exam-result").innerText(), /not a full official exam/);
    await page.locator(".exam-review > summary").click();
    assert.match(await page.locator(".exam-review").innerText(), /Answer:/);
    console.log("PASS timed starter simulation resumes after reload and records local result");
    await page.locator(".offline-study-stats > summary").click().catch(() => {});
    assert.match(await page.locator("#offline-study-stats").innerText(), /TOEIC Listening & Reading/);
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    if ((await page.locator("#offline-exam-lab").getAttribute("open")) === null)
      await page.locator("#offline-exam-lab > summary").click();
    if ((await page.locator(".offline-writing").getAttribute("open")) === null)
      await page.locator(".offline-writing > summary").click();
    for (const [promptId, visual] of [["ia-w3", "ielts-compost-process.svg"], ["ia-w5", "ielts-transport-line-graph.svg"], ["ia-w7", "ielts-campus-maps.svg"]]) {
      await page.locator("#writing-prompt").selectOption(promptId);
      const image = page.locator("#writing-prompt-text img.exam-prompt-image");
      await image.waitFor();
      await page.waitForFunction((expected) => document.querySelector("#writing-prompt-text img.exam-prompt-image")?.getAttribute("src")?.includes(expected), visual);
      assert.ok((await image.getAttribute("src")).includes(visual));
      await page.waitForFunction(() => { const node = document.querySelector("#writing-prompt-text img.exam-prompt-image"); return node?.complete && node.naturalWidth > 0; });
      assert.equal(await image.evaluate((node) => node.complete && node.naturalWidth > 0), true);
    }
    await page.locator("#writing-prompt").selectOption("ia-w1");
    await page
      .locator("#writing-input")
      .fill("A recoverable IELTS writing draft with a clear argument.");
    await page.waitForTimeout(600);
    await page.reload();
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    if ((await page.locator("#offline-exam-lab").getAttribute("open")) === null)
      await page.locator("#offline-exam-lab > summary").click();
    if ((await page.locator(".offline-writing").getAttribute("open")) === null)
      await page.locator(".offline-writing > summary").click();
    assert.match(
      await page.locator("#writing-input").inputValue(),
      /recoverable IELTS writing draft/,
    );
    await page.locator("#btn-writing-save").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#writing-save-state")
        .textContent.includes("Saved to offline practice history"),
    );
    await page.locator(".offline-history > summary").click();
    await page.waitForFunction(() =>
      /IELTS/.test(document.querySelector("#offline-study-history").innerText),
    );
    assert.match(
      await page.locator("#offline-study-history").innerText(),
      /IELTS/,
    );
    await page.locator(".offline-speaking > summary").click();
    await page.locator("#speaking-prompt").waitFor();
    await page
      .locator("#speaking-notes")
      .fill("I will add one example and finish with a short conclusion.");
    await page.locator("#btn-record-speaking").click();
    await page.waitForTimeout(900);
    await page.locator("#btn-stop-speaking").click();
    await page.getByText("Recording saved on this device.").waitFor();
    console.log(
      "PASS Writing draft, history, and locally saved speaking recording",
    );
    await page.locator('.bottom-nav a[data-nav="reader"]').click();
    await page
      .locator("#reader-input")
      .fill("A short article for offline listening practice.");
    await page.locator("#btn-reader-start").click();
    await page.locator("#reader-text:not(.hidden)").waitFor();
    await page.locator("#btn-reader-start").click();
    await page.locator(".reader-source-options summary").click();
    await page.locator("#btn-listening").click();
    await page.locator("#listen-audio-file").setInputFiles({
      name: "short.wav",
      mimeType: "audio/wav",
      buffer: wav(),
    });
    await page
      .locator("#listen-transcript")
      .fill("00:00:00,000 --> 00:00:01,000\nThe train leaves at nine.\n");
    await page.locator("#listen-material-title").fill("Offline sample");
    await page.locator("#btn-listen-save").click();
    await page.getByText("Saved for offline use on this device.").waitFor();
    await page.reload();
    await page.locator('.bottom-nav a[data-nav="reader"]').click();
    await page
      .locator("#reader-input")
      .fill("A short article for offline listening practice.");
    await page.locator("#btn-reader-start").click();
    await page.locator("#reader-text:not(.hidden)").waitFor();
    await page.locator("#btn-reader-start").click();
    await page.locator(".reader-source-options summary").click();
    await page.locator("#btn-listening").click();
    await page.locator("#listen-library").getByText("Offline sample").waitFor();
    await page
      .locator("#listen-library")
      .getByRole("button", { name: "Open in Reader" })
      .click();
    await page
      .locator("#reader-text")
      .getByText("The train leaves at nine.")
      .waitFor();
    console.log("PASS listening audio/transcript storage and reopen");
    const data = await page.evaluate(async () => {
      const req = indexedDB.open("mdx-dict");
      const db = await new Promise((ok, no) => {
        req.onsuccess = () => ok(req.result);
        req.onerror = () => no(req.error);
      });
      return await new Promise((ok, no) => {
        const r = db.transaction("study").objectStore("study").getAll();
        r.onsuccess = () =>
          ok(
            r.result.map((x) => ({
              type: x.type,
              id: x.id,
              hasAudio: x.audio instanceof Blob,
            })),
          );
        r.onerror = () => no(r.error);
      });
    });
    assert.ok(data.some((x) => x.type === "writing-attempt"));
    assert.ok(data.some((x) => x.type === "listening-document" && x.hasAudio));
    assert.ok(data.some((x) => x.type === "exam-session"));
    assert.ok(data.some((x) => x.type === "speaking-recording" && x.hasAudio));
    assert.deepEqual(errors, []);
    console.log("PASS local IndexedDB records; zero page errors");
    await page.locator("#btn-more").click();
    await page.locator("#more-advanced").click();
    await page.locator("#adv-tab-data").click();
    await page
      .locator("#adv-panel-data details.adv-section summary")
      .first()
      .click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#btn-export-full-backup").click(),
    ]);
    const filePath = await download.path();
    const backup = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.ok(
      backup.study.some(
        (x) =>
          x.type === "listening-document" &&
          x.audioData?.startsWith("data:audio/"),
      ),
    );
    assert.ok(
      backup.study.some(
        (x) =>
          x.type === "speaking-recording" &&
          x.audioData?.startsWith("data:audio/"),
      ),
    );
    assert.ok(
      backup.study.some(
        (x) =>
          x.type === "journal-draft" &&
          x.draft?.text === "A recoverable journal draft.",
      ),
    );
    console.log(
      "PASS complete JSON backup serializes listening and speaking audio",
    );
    const clean = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      restore = await clean.newPage();
    restore.setDefaultTimeout(15000);
    restore.on("pageerror", (e) => errors.push(e.message));
    await restore.goto(base, { waitUntil: "domcontentloaded" });
    await restore.locator("#onboarding-dialog").waitFor({ state: "visible" });
    await restore.locator("#onboarding-dialog .dialog-close").click();
    await restore.locator("#btn-more").click();
    await restore.locator("#more-advanced").click();
    await restore.locator("#adv-tab-data").click();
    await restore
      .locator("#adv-panel-data details.adv-section summary")
      .first()
      .click();
    await restore.locator("#import-file").setInputFiles({
      name: "complete.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await restore.waitForFunction(async () => {
      const q = indexedDB.open("mdx-dict");
      const db = await new Promise((ok) => (q.onsuccess = () => ok(q.result)));
      return await new Promise((ok) => {
        const r = db.transaction("study").objectStore("study").getAll();
        r.onsuccess = () =>
          ok(
            r.result.some(
              (x) => x.type === "listening-document" && x.audio instanceof Blob,
            ) &&
              r.result.some(
                (x) =>
                  x.type === "speaking-recording" && x.audio instanceof Blob,
              ),
          );
      });
    });
    console.log(
      "PASS complete JSON import restores both audio libraries into a clean profile",
    );
    await clean.close();
    await page.locator("#btn-export-encrypted").click();
    await page.locator("#crypto-dialog[open]").waitFor();
    await page.locator("#crypto-pass").fill("correct horse offline");
    const [encrypted] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#crypto-confirm").click(),
    ]);
    const encryptedPath = await encrypted.path();
    const cleanEncrypted = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      restoreEncrypted = await cleanEncrypted.newPage();
    restoreEncrypted.setDefaultTimeout(20000);
    restoreEncrypted.on("pageerror", (e) => errors.push(e.message));
    await restoreEncrypted.goto(base, { waitUntil: "domcontentloaded" });
    await restoreEncrypted
      .locator("#onboarding-dialog")
      .waitFor({ state: "visible" });
    await restoreEncrypted.locator("#onboarding-dialog .dialog-close").click();
    await restoreEncrypted.locator("#btn-more").click();
    await restoreEncrypted.locator("#more-advanced").click();
    await restoreEncrypted.locator("#adv-tab-data").click();
    await restoreEncrypted
      .locator("#adv-panel-data details.adv-section summary")
      .first()
      .click();
    await restoreEncrypted
      .locator("#import-encrypted")
      .setInputFiles(encryptedPath);
    await restoreEncrypted.locator("#crypto-dialog[open]").waitFor();
    await restoreEncrypted
      .locator("#crypto-pass")
      .fill("correct horse offline");
    await restoreEncrypted.locator("#crypto-confirm").click();
    await restoreEncrypted.waitForFunction(async () => {
      const q = indexedDB.open("mdx-dict");
      const db = await new Promise((ok) => (q.onsuccess = () => ok(q.result)));
      return await new Promise((ok) => {
        const r = db.transaction("study").objectStore("study").getAll();
        r.onsuccess = () =>
          ok(
            r.result.some(
              (x) => x.type === "listening-document" && x.audio instanceof Blob,
            ) &&
              r.result.some(
                (x) =>
                  x.type === "speaking-recording" && x.audio instanceof Blob,
              ),
          );
      });
    });
    console.log(
      "PASS encrypted complete backup round-trip restores saved audio",
    );
    assert.deepEqual(errors, []);
    await cleanEncrypted.close();
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
