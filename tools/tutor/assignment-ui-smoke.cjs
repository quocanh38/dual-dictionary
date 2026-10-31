const { chromium } = require("playwright-core");
const fs = require("fs");
const http = require("http");
const path = require("path");
const assert = require("node:assert/strict");
const root = process.cwd();
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".html") ? "text/html" : "application/octet-stream");
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "domcontentloaded" });
    await page.locator("#onboarding-dialog").waitFor({ state: "visible" });
    await page.locator("#onboarding-dialog .dialog-close").click();
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    await page.locator("#offline-exam-lab > summary").click();
    await page.locator("#ielts-assignment [data-start-assignment]").waitFor();
    const initialCard = await page.locator("#ielts-assignment").innerText();
    assert.match(initialCard, /Bài tiếp theo gợi ý/);
    await page.locator("#ielts-assignment [data-start-assignment]").click();
    await page.waitForFunction(() => {
      const question = document.querySelector("#exam-question");
      return question && !question.classList.contains("hidden") ||
        document.querySelector("#writing-prompt")?.dataset.assignmentId ||
        document.querySelector("#speaking-prompt")?.dataset.assignmentId;
    });
    await page.waitForFunction(() => document.querySelector("#ielts-assignment [data-start-assignment]")?.textContent.includes("Tiếp tục bài đang làm"));
    const active = await page.evaluate(async () => {
      const dbRequest = indexedDB.open("mdx-dict");
      const db = await new Promise((resolve, reject) => { dbRequest.onsuccess = () => resolve(dbRequest.result); dbRequest.onerror = () => reject(dbRequest.error); });
      const rows = await new Promise((resolve, reject) => { const request = db.transaction("study", "readonly").objectStore("study").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const session = rows.find((row) => row.type === "exam-session" && row.assignmentId && !row.complete);
      if (session) {
        const { getStudyExercises } = await import(new URL("./js/study-content.js", location.href));
        const normal = new Set(getStudyExercises("IELTS Academic", session.pathwayStage).filter((item) => !item.diagnosticSet).map((item) => item.id));
        return { kind: "objective", idsValid: session.assignmentQuestionIds.length > 0 && session.assignmentQuestionIds.every((id) => normal.has(id)), mode: session.mode };
      }
      const writing = rows.find((row) => row.type === "writing-draft" && row.assignmentId);
      if (writing) return { kind: "writing", promptValid: !!writing.promptId && !!writing.pathwayStage };
      const speaking = rows.find((row) => row.type === "speaking-draft" && row.assignmentId);
      return { kind: "speaking", promptValid: !!speaking?.promptId && !!speaking?.pathwayStage };
    });
    if (active.kind === "objective") {
      assert.equal(active.idsValid, true, "assigned objective IDs must stay inside the non-diagnostic pathway bank");
      assert.equal(active.mode, "practice", "recommended objective work should provide answer feedback");
    } else assert.equal(active.promptValid, true, "the exact assigned productive prompt must be saved offline");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.bottom-nav a[data-nav="practice"]').click();
    await page.locator("#offline-exam-lab > summary").click();
    await page.waitForFunction(() => document.querySelector("#ielts-assignment [data-start-assignment]")?.textContent.includes("Tiếp tục bài đang làm"));
    assert.deepEqual(errors, []);
    console.log(`PASS: ${active.kind} assignment starts, stays offline and resumes after reload`);
    await context.close();

    const objectiveContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const objectivePage = await objectiveContext.newPage();
    const day = 24 * 60 * 60 * 1000;
    let rotationDay = Math.floor(Date.UTC(2026, 9, 28) / day);
    rotationDay += (4 - rotationDay % 4) % 4;
    await objectivePage.addInitScript((fixedNow) => {
      const NativeDate = Date;
      class FrozenDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixedNow])); }
        static now() { return fixedNow; }
      }
      window.Date = FrozenDate;
    }, rotationDay * day + 1000);
    objectivePage.on("pageerror", (error) => errors.push(error.message));
    await objectivePage.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "domcontentloaded" });
    await objectivePage.locator("#onboarding-dialog").waitFor({ state: "visible" });
    await objectivePage.locator("#onboarding-dialog .dialog-close").click();
    await objectivePage.locator('.bottom-nav a[data-nav="practice"]').click();
    await objectivePage.locator("#offline-exam-lab > summary").click();
    assert.match(await objectivePage.locator("#ielts-assignment").innerText(), /Listening ·/);
    await objectivePage.locator("#ielts-assignment [data-start-assignment]").click();
    await objectivePage.waitForFunction(() => {
      const question = document.querySelector("#exam-question");
      return question && !question.classList.contains("hidden");
    });
    const objectiveSession = await objectivePage.evaluate(async () => {
      const { getStudyExercises } = await import(new URL("./js/study-content.js", location.href));
      const dbRequest = indexedDB.open("mdx-dict");
      const db = await new Promise((resolve, reject) => { dbRequest.onsuccess = () => resolve(dbRequest.result); dbRequest.onerror = () => reject(dbRequest.error); });
      const rows = await new Promise((resolve, reject) => { const request = db.transaction("study", "readonly").objectStore("study").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const session = rows.find((row) => row.type === "exam-session" && row.assignmentId && !row.complete);
      const normalIds = new Set(getStudyExercises("IELTS Academic", session.pathwayStage).filter((item) => !item.diagnosticSet).map((item) => item.id));
      return { skill: session.assignmentSkill, mode: session.mode, valid: session.assignmentQuestionIds.length > 0 && session.assignmentQuestionIds.every((id) => normalIds.has(id)) };
    });
    assert.deepEqual(objectiveSession, { skill: "Listening", mode: "practice", valid: true });
    await objectivePage.reload({ waitUntil: "domcontentloaded" });
    await objectivePage.locator('.bottom-nav a[data-nav="practice"]').click();
    await objectivePage.locator("#offline-exam-lab > summary").click();
    await objectivePage.waitForFunction(() => document.querySelector("#ielts-assignment [data-start-assignment]")?.textContent.includes("Tiếp tục bài đang làm"));
    assert.deepEqual(errors, []);
    console.log("PASS: grouped objective assignment contains only pathway questions and resumes after reload");
    await objectiveContext.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); server.close(); process.exit(1); });
