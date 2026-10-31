import { addItem } from "./store.js";
import { askTutor, getAiSettings, PROVIDERS } from "./ai-client.js";
import {
  allStudyRecords,
  getStudyRecord,
  putStudyRecord,
  deleteStudyRecord,
} from "./db.js";
import {
  STUDY_CONTENT_PACKS,
  STUDY_EXAM_CONFIG,
  IELTS_DIAGNOSTIC_FORM,
  IELTS_LINEAR_GUIDANCE,
  IELTS_PATHWAY_STAGES,
  getIELTSPathwayStage,
  getStudyExercises,
  getStudyPrompts,
  validateStudyContentPacks,
} from "./study-content.js";
import { recommendNextIELTSAssignment } from "./assignment-engine.js";

const $ = (s, root = document) => root.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let current = null;
let recorder = null;
let recordingChunks = [];
let writingDraftRevision = 0;
let speakingDraftRevision = 0;
const aiReviewRequests = new Map();
const SECTION_TARGETS = {
  "IELTS Academic": { Listening: { questions: 40, minutes: 30 }, Reading: { questions: 40, minutes: 60 } },
  "TOEIC Listening & Reading": { Listening: { questions: 100, minutes: 45 }, Reading: { questions: 100, minutes: 75 } },
};
const isTimedMode = (session = current) => session?.mode === "timed" || session?.mode === "diagnostic";
function getSessionExercises(session = current) {
  if (session?.mode === "diagnostic") {
    return getStudyExercises(session.exam).filter((q) =>
      q.diagnosticSet === IELTS_DIAGNOSTIC_FORM && (!session.skill || session.skill === "all" || q.skill === session.skill),
    ).sort((a, b) => (a.skill === b.skill ? a.diagnosticOrder - b.diagnosticOrder : a.skill === "Listening" ? -1 : 1));
  }
  const stage = session?.exam === "IELTS Academic" ? session.pathwayStage : null;
  const exercises = getStudyExercises(session?.exam, stage).filter((q) =>
    session?.exam !== "IELTS Academic" || !q.diagnosticSet,
  );
  if (session?.assignmentId && Array.isArray(session.questionIds)) {
    const byId = new Map(exercises.map((question) => [question.id, question]));
    return session.questionIds.map((id) => byId.get(id)).filter(Boolean);
  }
  return exercises.filter((q) => !session?.skill || session.skill === "all" || q.skill === session.skill);
}
function selectedIELTSStage() {
  return $("#ielts-pathway-stage")?.value || IELTS_PATHWAY_STAGES[0].id;
}
function sessionDurationMs(exam, skill, questionCount, mode = "timed") {
  if (mode === "diagnostic" && exam === "IELTS Academic") {
    if (!skill || skill === "all") return 90 * 60_000;
    return (SECTION_TARGETS[exam]?.[skill]?.minutes || 30) * 60_000;
  }
  if (!skill || skill === "all") return (STUDY_EXAM_CONFIG[exam]?.mockMinutes || 10) * 60_000;
  const section = SECTION_TARGETS[exam]?.[skill];
  if (!section) return 10 * 60_000;
  // Keep short starter sets proportional to the real section duration. This
  // avoids implying that a handful of items is a complete timed section.
  return Math.max(2 * 60_000, Math.round(section.minutes * 60_000 * Math.min(questionCount, section.questions) / section.questions));
}

export async function exportOfflineStudy() {
  const rows = await allStudyRecords();
  const journal = localStorage.getItem("dd-journal-draft");
  if (journal)
    try {
      rows.push({
        id: "study:journal-draft",
        type: "journal-draft",
        draft: JSON.parse(journal),
      });
    } catch {}
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      audioData: row.audio instanceof Blob ? await blobToData(row.audio) : null,
      audio: undefined,
    })),
  );
}
export async function importOfflineStudy(rows) {
  let n = 0;
  for (const row of Array.isArray(rows) ? rows.slice(0, 500) : []) {
    if (
      !row ||
      typeof row.id !== "string" ||
      row.id.length > 240 ||
      !/^study:/.test(row.id)
    )
      continue;
    if (row.type === "journal-draft") {
      if (
        !localStorage.getItem("dd-journal-draft") &&
        row.draft &&
        typeof row.draft === "object"
      )
        try {
          localStorage.setItem(
            "dd-journal-draft",
            JSON.stringify(row.draft).slice(0, 100_000),
          );
        } catch {}
      continue;
    }
    if (
      ![
        "exam-session",
        "exam-attempt",
        "writing-draft",
        "writing-attempt",
        "speaking-draft",
        "speaking-attempt",
        "speaking-recording",
        "listening-document",
        "exam-result",
      ].includes(row.type)
    )
      continue;
    if (await getStudyRecord(row.id)) continue;
    const safe = { ...row };
    delete safe.audioData;
    delete safe.audio;
    if (typeof row.audioData === "string" && row.audioData.length < 35_000_000)
      safe.audio = await dataToBlob(row.audioData).catch(() => null);
    if (
      safe.audio &&
      (safe.audio.size > 25 * 1024 * 1024 || !/^audio\//i.test(safe.audio.type))
    )
      continue;
    for (const key of [
      "text",
      "prompt",
      "transcript",
      "notes",
      "explanation",
      "response",
    ])
      if (typeof safe[key] === "string")
        safe[key] = safe[key].slice(
          0,
          key === "transcript" ? 1_000_000 : 100_000,
        );
    await putStudyRecord(safe);
    n++;
  }
  window.dispatchEvent(new Event("dd-study-updated"));
  return n;
}
function blobToData(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function dataToBlob(data) {
  if (!/^data:audio\/[^,]+;base64,[A-Za-z0-9+/=]+$/i.test(data))
    throw new Error("Invalid audio data");
  const comma = data.indexOf(",");
  const mime = data.slice(5, comma).split(";")[0];
  const binary = atob(data.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const normalizeAnswer = (value) =>
  String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:'"()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function responseIsComplete(q, response) {
  if (q.type === "audio-choice") return response != null && response !== "" && Number.isInteger(Number(response));
  if (q.type === "choice") return response != null && response !== "" && Number.isInteger(Number(response));
  if (q.type === "short-answer") return Boolean(String(response || "").trim());
  if (q.type === "gap-fill")
    return q.gaps.every((g) => String(response?.[g.id] || "").trim());
  if (q.type === "matching")
    return q.pairs.every((p) => String(response?.[p.id] || "").trim());
  return false;
}
function responseIsCorrect(q, response) {
  if (q.type === "audio-choice") return Number(response) === q.answer;
  if (q.type === "choice") return Number(response) === q.answer;
  if (q.type === "short-answer")
    return q.acceptedAnswers.some((a) => normalizeAnswer(a) === normalizeAnswer(response));
  if (q.type === "gap-fill")
    return q.gaps.every((g) => g.acceptedAnswers.some((a) => normalizeAnswer(a) === normalizeAnswer(response?.[g.id])));
  if (q.type === "matching")
    return new Set(q.pairs.map((p) => normalizeAnswer(response?.[p.id]))).size === q.pairs.length && q.pairs.every((p) => normalizeAnswer(response?.[p.id]) === normalizeAnswer(p.answer));
  return false;
}
function formatResponse(q, response, answerKey = false) {
  if (q.type === "audio-choice") return q.options[Number(answerKey ? q.answer : response)] || "No answer";
  if (q.type === "choice") return q.options[Number(answerKey ? q.answer : response)] || "No answer";
  if (q.type === "matching") return q.pairs.map((p) => `${p.label}: ${answerKey ? p.answer : response?.[p.id] || "—"}`).join("; ");
  if (q.type === "gap-fill") return q.gaps.map((g) => `${g.label}: ${answerKey ? g.acceptedAnswers[0] : response?.[g.id] || "—"}`).join("; ");
  return String(answerKey ? q.acceptedAnswers?.[0] || "" : response || "No answer");
}
function responseMarkup(q) {
  const disabled = current.checked ? "disabled" : "";
  const value = isTimedMode() ? current.responses?.[q.id] : current.response;
  const selectedAnswer = value ?? (isTimedMode() ? null : current.answerIndex);
  if (q.type === "choice")
    return `<fieldset class="exam-options"><legend class="sr-only">Choose one answer</legend>${q.options.map((v, i) => `<label><input type="radio" name="exam-answer" value="${i}" ${selectedAnswer != null && Number(selectedAnswer) === i ? "checked" : ""} ${disabled}> <span>${esc(v)}</span></label>`).join("")}</fieldset>`;
  if (q.type === "audio-choice")
    return `<fieldset class="exam-options audio-choice-options"><legend>Listen to the four statements, then choose one</legend>${q.options.map((v, i) => `<label><input type="radio" name="exam-answer" value="${i}" ${selectedAnswer != null && Number(selectedAnswer) === i ? "checked" : ""} ${disabled}> <span>${esc(v)}</span><audio controls preload="none" src="${esc(q.audioChoices[i])}" aria-label="Play ${esc(v)}"></audio></label>`).join("")}</fieldset>`;
  if (q.type === "short-answer")
    return `<label class="exam-input-label">Your answer <input class="exam-text-answer" data-answer-text value="${esc(value || "")}" autocomplete="off" ${disabled}></label>`;
  if (q.type === "gap-fill")
    return `<fieldset class="exam-gaps"><legend>Complete each gap</legend>${q.gaps.map((g) => `<label>${esc(g.label)} <input data-answer-gap="${esc(g.id)}" value="${esc(value?.[g.id] || "")}" autocomplete="off" ${disabled}></label>`).join("")}</fieldset>`;
  if (q.type === "matching")
    return `<fieldset class="exam-matches"><legend>Match each item</legend>${q.pairs.map((p) => `<label>${esc(p.label)} <select data-answer-match="${esc(p.id)}" ${disabled}><option value="">Choose…</option>${q.pairs.map((candidate) => `<option value="${esc(candidate.answer)}" ${value?.[p.id] === candidate.answer ? "selected" : ""}>${esc(candidate.answer)}</option>`).join("")}</select></label>`).join("")}</fieldset>`;
  return "";
}
function responseFromForm(q, root) {
  if (q.type === "choice") return Number(root.querySelector('[name="exam-answer"]:checked')?.value);
  if (q.type === "short-answer") return root.querySelector("[data-answer-text]")?.value || "";
  if (q.type === "gap-fill") return Object.fromEntries(q.gaps.map((g) => [g.id, root.querySelector(`[data-answer-gap="${CSS.escape(g.id)}"]`)?.value || ""]));
  if (q.type === "matching") return Object.fromEntries(q.pairs.map((p) => [p.id, root.querySelector(`[data-answer-match="${CSS.escape(p.id)}"]`)?.value || ""]));
  return null;
}
function paintQuestion() {
  const host = $("#exam-question");
  if (!host || !current) return;
  const set = getSessionExercises();
  const q = set.find((x) => x.id === current.questionId) || set[0];
  const index = set.findIndex((x) => x.id === q.id) + 1;
  const pathway = q.exam === "IELTS Academic" ? getIELTSPathwayStage(q.pathwayStage) : null;
  const method = pathway ? IELTS_LINEAR_GUIDANCE[q.skill] : null;
  const timed = isTimedMode();
  const diagnostic = current.mode === "diagnostic";
  const remaining = timed ? Math.max(0, Math.ceil((current.deadlineAt - Date.now()) / 1000)) : null;
  const listeningMaterial = !q.transcript ? "" : diagnostic
    ? `<p class="hint">Part script is hidden. Browser voice is synthetic and may differ from an IELTS recording. In this diagnostic, each Part can be played once.</p><button type="button" class="btn-secondary" data-play-section="${esc(q.diagnosticSection)}" ${current.playedSections?.[q.diagnosticSection] ? "disabled" : ""}>🔊 Play Part ${esc(q.diagnosticSection)} with browser voice</button>`
    : timed
      ? `<p class="hint">Listening script is hidden in timed mode. <button type="button" class="btn-secondary" data-speak-script>🔊 Play with browser voice</button></p>`
      : `<details class="exam-passage"><summary>Listening script · show after listening</summary><p>${esc(q.transcript)}</p><button type="button" class="btn-secondary" data-speak-script>🔊 Read script (browser voice, may need installed voice)</button></details>`;
  host.innerHTML = `<p class="hint">${esc(q.exam)} · ${esc(q.skill)} · ${esc(q.part || q.title)} · ${index}/${set.length}${timed ? ` · <strong id="exam-timer" role="timer">${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}</strong>` : ""}</p>
    ${pathway && !diagnostic ? `<aside class="ielts-learning-scaffold"><strong>${esc(pathway.label)} · Mục tiêu câu này</strong><p>${esc(q.focus)}</p><p><strong>Linear Thinking · ${esc(method.title)}:</strong> ${esc(method.steps)}</p><a href="${esc(method.blog)}" target="_blank" rel="noopener">Đọc bài phương pháp trên blog</a></aside>` : ""}
    ${q.image ? `<img class="exam-prompt-image" src="${esc(q.image)}" alt="${esc(q.imageAlt || "Practice illustration")}">` : ""}
    ${q.note ? `<p class="hint">${esc(q.note)}</p>` : ""}
    ${q.passage ? `<div class="exam-passage">${esc(q.passage)}</div>` : ""}
    ${listeningMaterial}
    <h3>${esc(q.prompt)}</h3>${responseMarkup(q)}
    <div class="exam-actions">${timed ? `<button type="button" class="btn-secondary" data-exam-prev ${index === 1 ? "disabled" : ""}>Previous</button><button type="button" class="btn-primary" data-exam-next>${index === set.length ? (diagnostic ? "Finish diagnostic" : "Finish simulation") : (responseIsComplete(q, current.responses?.[q.id]) ? "Save & next" : "Skip")}</button><button type="button" class="btn-secondary" data-exam-finish>Submit now</button>` : current.checked ? `<button type="button" class="btn-primary" data-exam-next>Next question</button>` : `<button type="button" class="btn-primary" data-exam-check ${responseIsComplete(q, current.response ?? current.answerIndex) ? "" : "disabled"}>Check answer</button>`}<button type="button" class="btn-secondary" data-exam-reset>Restart set</button></div>
    ${current.checked ? `<p class="exam-feedback ${current.correct ? "is-correct" : "is-wrong"}" role="status"><strong>${current.correct ? "Correct" : "Review this answer"}</strong> · ${esc(q.explanation)}${!current.correct ? ` Your response: ${esc(formatResponse(q, current.response ?? current.answerIndex))}. Answer: ${esc(formatResponse(q, null, true))}. Saved in Vault for review.` : ""}</p>` : ""}`;
  const updateResponse = () => {
    const response = responseFromForm(q, host);
    if (timed) current.responses = { ...(current.responses || {}), [q.id]: response };
    else current.response = response;
    if (q.type === "choice" && !timed) current.answerIndex = response;
    const check = host.querySelector("[data-exam-check]");
    if (check) check.disabled = !responseIsComplete(q, current.response);
    persistAttempt();
  };
  host.querySelectorAll('[name="exam-answer"]').forEach((e) => e.addEventListener("change", updateResponse));
  host.querySelectorAll("[data-answer-text], [data-answer-gap], [data-answer-match]").forEach((e) => e.addEventListener("input", updateResponse));
  host.querySelector("[data-exam-check]")?.addEventListener("click", checkAnswer);
  host.querySelector("[data-exam-next]")?.addEventListener("click", nextQuestion);
  host.querySelector("[data-exam-prev]")?.addEventListener("click", previousQuestion);
  host.querySelector("[data-exam-finish]")?.addEventListener("click", () => {
    if (window.confirm("Submit this simulation now? Unanswered questions will be left blank.")) finishSession(false);
  });
  host.querySelector("[data-exam-reset]")?.addEventListener("click", restartSet);
  host.querySelector("[data-play-section]")?.addEventListener("click", async (event) => {
    const section = event.currentTarget.dataset.playSection;
    if (current.playedSections?.[section]) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    current.playedSections = { ...(current.playedSections || {}), [section]: true };
    const utterance = new SpeechSynthesisUtterance(q.transcript); utterance.lang = "en-US"; speechSynthesis.speak(utterance);
    await persistAttempt(); paintQuestion();
  });
  host.querySelector("[data-speak-script]")?.addEventListener("click", () => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(q.transcript); u.lang = "en-US"; speechSynthesis.speak(u);
  });
  if (timed) startExamClock();
}
async function restartSet() {
  if (!current) return;
  const { exam, mode, skill, pathwayStage, assignmentId, assignmentKind, assignmentSkill, assignmentPromptId, assignmentQuestionIds } = current;
  await deleteStudyRecord(current.sessionId || sessionRecordId(exam, mode, skill, pathwayStage));
  await deleteStudyRecord("study:exam-session");
  const assignment = assignmentId ? { id: assignmentId, kind: assignmentKind, skill: assignmentSkill, promptId: assignmentPromptId, questionIds: assignmentQuestionIds } : null;
  await startSet(exam, mode, skill, pathwayStage, assignment);
}
async function persistAttempt() {
  if (current) await putStudyRecord({ ...current, id: current.sessionId || sessionRecordId(current.exam, current.mode, current.skill, current.pathwayStage), type: "exam-session", updatedAt: Date.now() });
}
function sessionRecordId(exam, mode, skill = "all", pathwayStage = null) {
  const stageSuffix = exam === "IELTS Academic" ? `:${pathwayStage || IELTS_PATHWAY_STAGES[0].id}` : "";
  return `study:exam-session:${exam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${mode}:${skill.toLowerCase()}${stageSuffix}`;
}
function legacySessionRecordId(exam, mode, skill = "all") {
  const base = `study:exam-session:${exam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${mode}`;
  return skill === "all" ? `${base}:all` : `${base}:${skill.toLowerCase()}`;
}
async function startSet(exam = "IELTS Academic", mode = "practice", skill = "all", pathwayStage = selectedIELTSStage(), assignment = null) {
  if (exam !== "IELTS Academic" || mode === "diagnostic") pathwayStage = null;
  const pool = mode === "diagnostic"
    ? getStudyExercises(exam).filter((q) => q.diagnosticSet === IELTS_DIAGNOSTIC_FORM && (skill === "all" || q.skill === skill)).sort((a, b) => a.skill === b.skill ? a.diagnosticOrder - b.diagnosticOrder : a.skill === "Listening" ? -1 : 1)
    : getStudyExercises(exam, pathwayStage).filter((q) => (exam !== "IELTS Academic" || !q.diagnosticSet) && (skill === "all" || q.skill === skill));
  const chosen = assignment?.kind === "objective"
    ? assignment.questionIds.map((id) => pool.find((q) => q.id === id)).filter(Boolean)
    : pool;
  if (!chosen.length) return;
  const rows = await allStudyRecords();
  const baseSid = sessionRecordId(exam, mode, skill, pathwayStage);
  const sid = assignment?.kind === "objective" ? `${baseSid}:assigned:${assignment.id}` : baseSid;
  const prev = rows.find((r) => r.id === sid && !r.complete)
    || (!assignment && exam === "IELTS Academic" && pathwayStage === IELTS_PATHWAY_STAGES[0].id && rows.find((r) => r.id === legacySessionRecordId(exam, mode, skill) && !r.complete))
    || (!assignment && rows.find((r) => r.id === "study:exam-session" && r.exam === exam && !r.complete && (r.skill || "all") === skill && (exam !== "IELTS Academic" || !r.pathwayStage && pathwayStage === IELTS_PATHWAY_STAGES[0].id)));
  current = prev || {
    id: sid, sessionId: sid, type: "exam-session", exam, mode, skill, pathwayStage,
    questionIds: chosen.map((q) => q.id), questionId: chosen[0].id,
    questionIndex: 0, answerIndex: null, response: null, responses: {}, checked: false, correct: null,
    results: [], complete: false, startedAt: Date.now(),
    deadlineAt: isTimedMode({ mode }) ? Date.now() + sessionDurationMs(exam, skill, chosen.length, mode) : null,
    playedSections: {},
    ...(assignment?.kind === "objective" ? {
      assignmentId: assignment.id,
      assignmentKind: assignment.kind,
      assignmentSkill: assignment.skill,
      assignmentQuestionIds: chosen.map((q) => q.id),
    } : {}),
  };
  current.sessionId = sid;
  current.skill ||= skill;
  current.pathwayStage = pathwayStage;
  if (assignment?.kind === "objective") {
    current.assignmentId = assignment.id;
    current.assignmentKind = assignment.kind;
    current.assignmentSkill = assignment.skill;
    current.assignmentQuestionIds = chosen.map((q) => q.id);
  }
  current.questionIds = chosen.map((q) => q.id);
  if (!chosen.some((q) => q.id === current.questionId)) {
    current.questionId = chosen[0].id;
    current.answerIndex = null; current.response = null; current.checked = false; current.correct = null;
  }
  current.results = (current.results || []).filter((result) => chosen.some((q) => q.id === result.questionId));
  $("#exam-start")?.classList.add("hidden");
  $("#exam-question")?.classList.remove("hidden");
  await persistAttempt(); paintQuestion(); await renderIELTSAssignment();
}
function startExamClock() {
  clearInterval(startExamClock.timer);
  const tick = async () => {
    if (!current || current.complete) { clearInterval(startExamClock.timer); return; }
    if (!isTimedMode()) return;
    const seconds = Math.max(0, Math.ceil((current.deadlineAt - Date.now()) / 1000));
    const el = $("#exam-timer");
    if (el) el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    if (!seconds) { clearInterval(startExamClock.timer); await finishSession(true); }
  };
  startExamClock.timer = setInterval(tick, 1000); tick();
}
async function checkAnswer() {
  if (!current || current.checked) return;
  const q = getSessionExercises().find((x) => x.id === current.questionId);
  current.correct = responseIsCorrect(q, current.response ?? current.answerIndex);
  current.checked = true;
  const response = current.response ?? current.answerIndex;
  current.results = [...(current.results || []).filter((r) => r.questionId !== q.id), { questionId: q.id, skill: q.skill, part: q.part, correct: current.correct }];
  await putStudyRecord({
    id: `study:exam-attempt:${Date.now()}:${q.id}`, type: "exam-attempt", exam: q.exam,
    skill: q.skill, part: q.part, questionId: q.id, prompt: q.prompt, pathwayStage: q.pathwayStage || null, focus: q.focus || "",
    response: formatResponse(q, response), correct: current.correct,
    explanation: q.explanation, mode: current.mode, createdAt: Date.now(),
  });
  if (!current.correct) {
    const mistake = `${q.exam} ${q.skill} ${q.part || ""}: ${q.prompt}\nMy answer: ${formatResponse(q, response)}\nAnswer: ${formatResponse(q, null, true)}\n${q.explanation}`;
    await addItem({ type: "sentence", text: mistake, context: { sourceTitle: q.title || q.part }, tags: ["exam-mistake", q.exam.startsWith("IELTS") ? "ielts" : "toeic", q.skill.toLowerCase()], status: "new" });
  }
  await persistAttempt(); paintQuestion(); renderHistory(); renderStudyStats(); renderIELTSAssignment();
}
async function finishSession(timedOut = false) {
  if (!current || current.complete) return;
  clearInterval(startExamClock.timer);
  current.complete = true; current.timedOut = timedOut; current.completedAt = Date.now();
  if (isTimedMode()) {
    const answers = current.responses || {};
    for (const q of getSessionExercises()) {
      if (!responseIsComplete(q, answers[q.id])) continue;
      const correct = responseIsCorrect(q, answers[q.id]);
      const result = { questionId: q.id, skill: q.skill, part: q.part, correct };
      current.results = [...(current.results || []).filter((r) => r.questionId !== q.id), result];
      await putStudyRecord({ id: `study:exam-attempt:${Date.now()}:${q.id}`, type: "exam-attempt", exam: q.exam, skill: q.skill, part: q.part, questionId: q.id, prompt: q.prompt, pathwayStage: q.pathwayStage || null, focus: q.focus || "", response: formatResponse(q, answers[q.id]), correct, explanation: q.explanation, mode: current.mode, createdAt: Date.now() });
      if (!correct) await addItem({ type: "sentence", text: `${q.exam} ${q.skill} ${q.part || ""}: ${q.prompt}\nMy answer: ${formatResponse(q, answers[q.id])}\nAnswer: ${formatResponse(q, null, true)}\n${q.explanation}`, context: { sourceTitle: q.title || q.part }, tags: ["exam-mistake", q.exam.startsWith("IELTS") ? "ielts" : "toeic", q.skill.toLowerCase()], status: "new" });
    }
  }
  const results = current.results || [];
  const bySkill = {};
  const set = getSessionExercises();
  for (const q of set) { const row = bySkill[q.skill] ||= { correct: 0, answered: 0, total: 0 }; row.total++; }
  for (const r of results) { const row = bySkill[r.skill] ||= { correct: 0, answered: 0, total: 0 }; row.answered++; if (r.correct) row.correct++; }
  current.result = { correct: results.filter((r) => r.correct).length, answered: results.length, unanswered: Math.max(0, set.length - results.length), total: set.length, accuracy: results.length ? Math.round(100 * results.filter((r) => r.correct).length / results.length) : 0, bySkill };
  current.elapsedMs = current.completedAt - current.startedAt;
  await persistAttempt();
  const summary = current.result;
  await putStudyRecord({ id: `study:exam-result:${current.completedAt}:${Math.random().toString(36).slice(2, 7)}`, type: "exam-result", exam: current.exam, mode: current.mode, diagnosticSet: current.mode === "diagnostic" ? IELTS_DIAGNOSTIC_FORM : null, pathwayStage: current.pathwayStage || null, assignmentId: current.assignmentId || null, timedOut, ...summary, elapsedMs: current.elapsedMs, createdAt: current.completedAt });
  const host = $("#exam-question");
  const review = isTimedMode() ? `<details class="exam-review"><summary>Review answers and explanations</summary>${set.filter((q) => responseIsComplete(q, current.responses?.[q.id])).map((q) => { const response = current.responses[q.id], ok = responseIsCorrect(q, response); return `<article class="study-history"><strong>${esc(q.skill)} · ${esc(q.part || q.title)} · ${ok ? "Correct" : "Review"}</strong><p>${esc(q.prompt)}</p><p>Your response: ${esc(formatResponse(q, response))}</p><p>Answer: ${esc(formatResponse(q, null, true))}</p><p>${esc(q.explanation)}</p></article>`; }).join("")}</details>` : "";
  const skillLabel = current.assignmentId ? `IELTS ${current.assignmentSkill || current.skill} recommended practice` : current.mode === "diagnostic" ? (current.skill === "all" ? "IELTS Listening + Reading diagnostic" : `IELTS ${current.skill} diagnostic`) : current.skill && current.skill !== "all" ? `${current.skill} timed practice` : "Timed starter simulation";
  const pathwayLabel = current.exam === "IELTS Academic" && current.pathwayStage ? ` · ${getIELTSPathwayStage(current.pathwayStage).label}` : "";
  const diagnosticReports = current.mode === "diagnostic" ? Object.entries(summary.bySkill).map(([skill, row]) => renderDiagnosticReport(skill, row)).join("") : "";
  const resultText = current.assignmentId
    ? "Bài được gợi ý đã hoàn tất. Lượt tiếp theo sẽ được chọn theo bài đến hạn, kỹ năng cần luyện và nội dung chưa làm trong chặng này."
    : current.mode === "diagnostic"
    ? `${timedOut ? "Time ended." : "Diagnostic complete."} The authored set and browser-generated Listening voice are practice material, not calibrated IELTS questions. Results estimate a next practice stage by skill; they do not produce an official or overall four-skill band.`
    : `${timedOut ? "Time ended; unanswered questions are excluded from accuracy." : "All questions completed."} This original practice set is not a full official exam and does not produce an official score.`;
  const scoreLine = current.mode === "diagnostic" ? `<strong>${summary.correct}/${summary.total}</strong> correct across ${summary.total} questions · ${summary.accuracy}% of answered questions` : `<strong>${summary.correct}/${summary.answered}</strong> answered correctly · ${summary.accuracy}% of answered questions`;
  if (host) host.innerHTML = `<section class="exam-result"><h3>${skillLabel} complete${esc(pathwayLabel)}</h3><p>${scoreLine}</p><p>${resultText}</p><ul>${Object.entries(summary.bySkill).map(([skill, row]) => `<li>${esc(skill)}: ${row.correct}/${row.total} correct · ${row.answered} answered</li>`).join("")}</ul>${diagnosticReports}${review}<button type="button" class="btn-primary" data-exam-restart>Try again</button></section>`;
  host?.querySelectorAll("[data-use-diagnostic-stage]").forEach((button) => button.addEventListener("click", () => {
    $("#ielts-pathway-stage").value = button.dataset.useDiagnosticStage;
    $("#exam-skill").value = button.dataset.diagnosticSkill;
    $("#exam-mode").value = "practice";
    $("#exam-mode").dispatchEvent(new Event("change", { bubbles: true }));
  }));
  host?.querySelector("[data-exam-restart]")?.addEventListener("click", () => {
    const assignment = current.assignmentId ? { id: current.assignmentId, kind: current.assignmentKind, skill: current.assignmentSkill, questionIds: current.assignmentQuestionIds } : null;
    startSet(current.exam, current.mode, current.skill, current.pathwayStage, assignment);
  });
  renderStudyStats();
  renderIELTSAssignment();
}
function renderDiagnosticReport(skill, row) {
  const stageByLevel = row.correct < (skill === "Listening" ? 16 : 15)
    ? "band-5"
    : row.correct < 23
      ? "band-6"
      : row.correct < 30
        ? "band-6-5"
        : "band-7";
  const stage = getIELTSPathwayStage(stageByLevel);
  if (row.total !== 40 || row.answered !== 40) {
    return `<article class="diagnostic-guidance"><h4>${esc(skill)} · ${row.correct}/${row.total} correct</h4><p>Chưa đủ 40 câu có câu trả lời để gợi ý chặng học. Hãy trả lời cả câu khó bằng dự đoán tốt nhất rồi làm lại bài chẩn đoán.</p></article>`;
  }
  const band5 = skill === "Listening" ? 16 : 15;
  const band6 = 23;
  const band7 = 30;
  const reference = row.correct < band5
    ? `Below the published average Band 5 reference (${band5}/40).`
    : row.correct < band6
      ? `Between the published average Band 5 (${band5}/40) and Band 6 (23/40) references.`
      : row.correct < band7
        ? `Between the published average Band 6 (23/40) and Band 7 (30/40) references.`
        : `At or above the published average Band 7 reference (30/40).`;
  return `<article class="diagnostic-guidance"><h4>${esc(skill)} · ${row.correct}/40 correct</h4><p><strong>Reference position:</strong> ${esc(reference)}</p><p><strong>Suggested next practice stage:</strong> ${esc(stage.label)}. This is a route recommendation from this authored set, not a predicted IELTS band.</p><button type="button" class="btn-secondary" data-use-diagnostic-stage="${esc(stageByLevel)}" data-diagnostic-skill="${esc(skill)}">Practice ${esc(stage.shortLabel)}</button><p class="hint">IELTS says raw-score boundaries vary by test version. This original question set and browser-generated Listening voice are not calibrated; use the result to choose practice, not for admissions. <a href="https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail" target="_blank" rel="noopener">Official IELTS scoring details</a></p></article>`;
}
async function nextQuestion() {
  const set = getSessionExercises(), i = set.findIndex((q) => q.id === current.questionId);
  if (isTimedMode()) {
    if (i === set.length - 1) return finishSession(false);
    current.questionIndex = i + 1;
    current.questionId = set[i + 1].id;
    await persistAttempt(); paintQuestion();
    return;
  }
  if (i === set.length - 1) return finishSession(false);
  current = { ...current, questionId: set[i + 1].id, answerIndex: null, response: null, checked: false, correct: null, complete: false };
  await persistAttempt(); paintQuestion();
}
async function previousQuestion() {
  if (!current || !isTimedMode()) return;
  const set = getSessionExercises(), i = set.findIndex((q) => q.id === current.questionId);
  if (i <= 0) return;
  current.questionIndex = i - 1;
  current.questionId = set[i - 1].id;
  await persistAttempt(); paintQuestion();
}

function writingDraftId(promptId) { return `study:writing-draft:${encodeURIComponent(promptId)}`; }
function speakingDraftId(promptId) { return `study:speaking-draft:${encodeURIComponent(promptId)}`; }
async function persistWritingDraft(promptId, text, assignmentId = "") {
  const promptItem = getStudyPrompts("writing").find((p) => p.id === promptId);
  if (!promptItem) return;
  const row = {
    type: "writing-draft", promptId, exam: promptItem.exam, prompt: promptItem.prompt,
    pathwayStage: promptItem.pathwayStage, focus: promptItem.focus || "", text,
    assignmentId: assignmentId || "", updatedAt: Date.now(),
  };
  await putStudyRecord({ ...row, id: writingDraftId(promptId) });
  await putStudyRecord({ ...row, id: "study:writing-draft" });
}
async function saveWritingDraft() {
  const promptId = $("#writing-prompt")?.value || "";
  const text = $("#writing-input")?.value || "";
  await persistWritingDraft(promptId, text, $("#writing-prompt")?.dataset.assignmentId || "");
  const state = $("#writing-save-state");
  if (state) state.textContent = "Draft saved on this device.";
}
async function setWritingPrompt(promptItem, assignmentId = "") {
  if (!promptItem) return;
  const select = $("#writing-prompt");
  const input = $("#writing-input");
  const previousId = initOfflineStudy.lastWritingPromptId || select?.value;
  if (previousId && previousId !== promptItem.id) {
    clearTimeout(initOfflineStudy.draftTimer);
    await persistWritingDraft(previousId, input?.value || "", select?.dataset.assignmentId || "");
  }
  if (select) {
    select.value = promptItem.id;
    select.dataset.assignmentId = assignmentId || "";
  }
  initOfflineStudy.lastWritingPromptId = promptItem.id;
  const revisionAtLoad = writingDraftRevision;
  const rows = await allStudyRecords();
  const draft = rows.find((row) => row.id === writingDraftId(promptItem.id))
    || rows.find((row) => row.id === "study:writing-draft" && row.promptId === promptItem.id);
  if (select?.value !== promptItem.id) return;
  if (input && revisionAtLoad === writingDraftRevision) input.value = draft?.text || "";
  const count = $("#writing-word-count");
  if (count) count.textContent = (input?.value || "").trim().split(/\s+/).filter(Boolean).length + " words";
  document.querySelectorAll("[data-writing-check]").forEach((box) => { box.checked = false; });
  renderWritingPrompt();
  await persistWritingDraft(promptItem.id, input?.value || "", assignmentId);
}
async function saveWriting() {
  const text = $("#writing-input")?.value.trim();
  if (!text) return;
  const criteria = [
    ...document.querySelectorAll("[data-writing-check]:checked"),
  ].map((e) => e.value);
  const row = {
    id: "study:writing:" + Date.now(),
    type: "writing-attempt",
    exam:
      $("#writing-prompt")?.selectedOptions[0]?.dataset.exam ||
      "Writing practice",
    task: $("#writing-prompt")?.selectedOptions[0]?.textContent || "",
    prompt: getStudyPrompts("writing").find((p) => p.id === $("#writing-prompt")?.value)?.prompt || "",
    promptId: $("#writing-prompt")?.value || "",
    pathwayStage: getStudyPrompts("writing").find((p) => p.id === $("#writing-prompt")?.value)?.pathwayStage || null,
    focus: getStudyPrompts("writing").find((p) => p.id === $("#writing-prompt")?.value)?.focus || "",
    assignmentId: $("#writing-prompt")?.dataset.assignmentId || "",
    text,
    criteria,
    createdAt: Date.now(),
  };
  await putStudyRecord(row);
  $("#writing-input").value = "";
  await persistWritingDraft($("#writing-prompt")?.value || "", "", "");
  $("#writing-save-state").textContent = "Saved to offline practice history.";
  renderHistory();
  renderStudyStats();
  renderIELTSAssignment();
}
async function chooseWritingPrompt() {
  const options = getStudyPrompts("writing", selectedIELTSStage());
  const p = options[Math.floor(Math.random() * options.length)];
  if (!p) return;
  await setWritingPrompt(p);
}
function renderWritingPrompt() {
  const selected = getStudyPrompts("writing").find((p) => p.id === $("#writing-prompt")?.value);
  const target = $("#writing-prompt-text");
  if (!target) return;
  if (!selected) { target.textContent = "Choose a prompt to begin."; return; }
  const stage = getIELTSPathwayStage(selected.pathwayStage);
  const method = IELTS_LINEAR_GUIDANCE.Writing;
  target.innerHTML = `<strong>${esc(stage.label)} · ${esc(selected.task)}</strong><p>${esc(selected.focus)}</p><p>${esc(selected.prompt)}</p>${selected.image ? `<img class="exam-prompt-image" src="${esc(selected.image)}" alt="${esc(selected.imageAlt || "IELTS Academic writing task visual")}">` : ""}<p><strong>Linear Thinking · ${esc(method.title)}:</strong> ${esc(selected.methodCue || method.steps)}</p><p class="hint">Practice target: ${selected.minimumWords ? `${selected.minimumWords}+ words` : "complete the task"}${selected.suggestedMinutes ? ` · suggested ${selected.suggestedMinutes} minutes` : ""}. This is practice guidance, not a score prediction. <a href="${esc(method.blog)}" target="_blank" rel="noopener">Đọc bài phương pháp trên blog</a></p>`;
}
async function requestAiReview(kind) {
  const isWriting = kind === "writing";
  if (aiReviewRequests.has(kind)) return;
  const text = (isWriting ? $("#writing-input")?.value : $("#speaking-notes")?.value)?.trim() || "";
  const prompt = isWriting
    ? getStudyPrompts("writing").find((p) => p.id === $("#writing-prompt")?.value)
    : getStudyPrompts("speaking").find((p) => p.id === $("#speaking-prompt")?.dataset.promptId) || { prompt: $("#speaking-prompt")?.value || "", task: $("#speaking-task-label")?.textContent || "Speaking" };
  const consent = $(isWriting ? "#writing-ai-consent" : "#speaking-ai-consent");
  const status = $(isWriting ? "#writing-ai-status" : "#speaking-ai-status");
  const output = $(isWriting ? "#writing-ai-feedback" : "#speaking-ai-feedback");
  const button = $(isWriting ? "#btn-writing-ai-review" : "#btn-speaking-ai-review");
  const cancelButton = $(isWriting ? "#btn-writing-ai-cancel" : "#btn-speaking-ai-cancel");
  if (!text) { status.textContent = isWriting ? "Write a response first." : "Add a transcript or reflection notes first. The recording itself is not sent."; return; }
  if (!consent?.checked) { status.textContent = "Review the data-sharing note and check the consent box before requesting AI feedback."; return; }
  const settings = getAiSettings();
  if (!settings.apiKey) { status.textContent = "Add your provider key in Advanced → Learning first. Offline practice remains available without it."; return; }
  try {
    if (isWriting) await saveWritingDraft();
    else await speakingDraft();
  } catch {
    status.textContent = "Could not save this draft locally, so no AI request was sent. Check browser storage and try again.";
    return;
  }
  const submittedText = text.slice(0, 6000);
  const controller = new AbortController();
  aiReviewRequests.set(kind, controller);
  if (button) button.disabled = true;
  if (cancelButton) cancelButton.hidden = false;
  // Consent applies to this outgoing request only. A retry requires a fresh review.
  consent.checked = false;
  status.textContent = `Sending the selected prompt and ${isWriting ? "written response" : "typed notes only"} (${submittedText.length} characters) to ${PROVIDERS[settings.provider]?.label || settings.provider} / ${settings.model}… token charges may apply. Cancelling may not stop processing if the provider already received it.`;
  output?.replaceChildren();
  const rubric = isWriting
    ? "Review the response for task coverage, organization/cohesion, vocabulary, and grammar. Use the supplied pathway focus and Linear Thinking cue as formative context when present. Give 2 specific strengths and up to 3 high-value improvements. For every correction, quote an exact short excerpt from the learner response; never invent a quote. If unsure, say so. Do not calculate or predict an IELTS band or official score."
    : "Review the learner's typed transcript or reflection notes for response relevance, organization, vocabulary, and grammar/clarity. Use the supplied pathway focus and Linear Thinking cue as formative context when present. Give 2 specific strengths and up to 3 high-value improvements. Quote exact short excerpts only when present; do not infer pronunciation from notes or claim to have heard audio. Do not calculate or predict an IELTS band or official score.";
  try {
    const result = await askTutor({
      signal: controller.signal,
      instructions: `You are an English practice coach. ${rubric} Return concise Vietnamese feedback as JSON: {"strengths":[""],"improvements":[{"quote":"","advice":""}],"next_step":""}. This is formative practice feedback, not an official assessment.`,
      input: JSON.stringify({ task: prompt?.task || "Writing", pathwayStage: prompt?.pathwayStage || null, focus: prompt?.focus || "", methodCue: prompt?.methodCue || "", prompt: prompt?.prompt || "", response: submittedText }),
    });
    if (!result || typeof result !== "object" || Array.isArray(result) || !Array.isArray(result.strengths) || !Array.isArray(result.improvements) || typeof result.next_step !== "string") {
      throw new Error("The provider returned feedback in an unexpected format. Retry the request.");
    }
    const strengths = result.strengths.slice(0, 3).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 500));
    const improvements = result.improvements.slice(0, 3).map((x) => {
      if (!x || typeof x !== "object" || typeof x.advice !== "string" || !x.advice.trim()) return null;
      const quote = typeof x.quote === "string" ? x.quote.trim() : "";
      if (quote && !text.includes(quote)) throw new Error("An AI feedback quote did not match your response. Retry to get verifiable feedback.");
      return `<li>${quote ? `<q>${esc(quote)}</q> — ` : ""}${esc(x.advice.trim().slice(0, 700))}</li>`;
    }).filter(Boolean).join("");
    if (!strengths.length && !improvements) throw new Error("The provider returned no usable feedback. Retry the request.");
    output.innerHTML = `<div class="ai-review-card"><strong>Live AI feedback · ${esc(settings.provider)} / ${esc(settings.model)} · not an official score</strong><h4>What works</h4><ul>${strengths.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>No strengths were returned.</li>"}</ul><h4>Try improving</h4><ul>${improvements || "<li>No specific change suggested.</li>"}</ul><p><strong>Next step:</strong> ${esc(result.next_step.trim().slice(0, 700) || "Revise one point and compare it with your prompt.")}</p></div>`;
    status.textContent = "Live feedback received. Review it critically; it is a practice suggestion, not a band or official score.";
  } catch (error) {
    const cancelled = controller.signal.aborted;
    status.textContent = `${cancelled ? "Request cancelled." : error?.message || "The AI request failed."} Your response remains saved locally; ${cancelled ? "request fresh consent before retrying." : "review the sharing note and consent again before retrying."}`;
  } finally {
    if (aiReviewRequests.get(kind) === controller) aiReviewRequests.delete(kind);
    if (button) button.disabled = false;
    if (cancelButton) cancelButton.hidden = true;
  }
}
function cancelAiReview(kind) {
  aiReviewRequests.get(kind)?.abort("cancelled");
}
async function chooseSpeakingPrompt() {
  const options = getStudyPrompts("speaking", selectedIELTSStage());
  const p = options[Math.floor(Math.random() * options.length)];
  if (!p) return;
  await setSpeakingPrompt(p);
}
async function persistSpeakingDraft(promptId, text, assignmentId = "") {
  const p = getStudyPrompts("speaking").find((item) => item.id === promptId);
  if (!p) return;
  const row = {
    type: "speaking-draft", promptId: p.id, pathwayStage: p.pathwayStage,
    focus: p.focus || "", exam: p.exam, prompt: p.prompt, text,
    assignmentId: assignmentId || "", updatedAt: Date.now(),
  };
  await putStudyRecord({ ...row, id: speakingDraftId(promptId) });
  await putStudyRecord({ ...row, id: "study:speaking-draft" });
}
async function setSpeakingPrompt(p, assignmentId = "") {
  if (!p) return;
  const promptField = $("#speaking-prompt");
  const notes = $("#speaking-notes");
  const oldId = promptField?.dataset.promptId;
  if (oldId && oldId !== p.id) await persistSpeakingDraft(oldId, notes?.value || "", promptField.dataset.assignmentId || "");
  if (promptField) {
    promptField.value = p.prompt;
    promptField.dataset.promptId = p.id;
    promptField.dataset.exam = p.exam;
    promptField.dataset.pathwayStage = p.pathwayStage;
    promptField.dataset.focus = p.focus || "";
    promptField.dataset.assignmentId = assignmentId || "";
  }
  const revisionAtLoad = speakingDraftRevision;
  const label = $("#speaking-task-label");
  if (label) label.textContent = `${getIELTSPathwayStage(p.pathwayStage).label} · ${p.task} · ${p.focus}`;
  const guidance = $("#speaking-method-guidance");
  const method = IELTS_LINEAR_GUIDANCE.Speaking;
  if (guidance) guidance.innerHTML = `<strong>Linear Thinking · ${esc(method.title)}:</strong> ${esc(p.methodCue || method.steps)} <a href="${esc(method.blog)}" target="_blank" rel="noopener">Đọc bài phương pháp trên blog</a>`;
  const rows = await allStudyRecords();
  const draft = rows.find((row) => row.id === speakingDraftId(p.id))
    || rows.find((row) => row.id === "study:speaking-draft" && row.promptId === p.id);
  if (promptField?.dataset.promptId !== p.id) return;
  if (notes && revisionAtLoad === speakingDraftRevision) notes.value = draft?.text || "";
  document.querySelectorAll("[data-speaking-check]").forEach((box) => { box.checked = false; });
  await persistSpeakingDraft(p.id, notes?.value || "", assignmentId);
}
async function speakingDraft() {
  const promptId = $("#speaking-prompt")?.dataset.promptId || "";
  await persistSpeakingDraft(promptId, $("#speaking-notes")?.value || "", $("#speaking-prompt")?.dataset.assignmentId || "");
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $("#speaking-status").textContent =
      "Audio recording is not supported here. You can still use the prompt and self-review notes.";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    recordingChunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) recordingChunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recordingChunks, {
        type: recorder.mimeType || "audio/webm",
      });
      if (blob.size > 25 * 1024 * 1024) {
        $("#speaking-status").textContent =
          "Recording exceeds the 25 MB local limit.";
        return;
      }
      const id = "study:speaking-audio:" + Date.now();
      await putStudyRecord({
        id,
        type: "speaking-recording",
        exam: $("#speaking-prompt").dataset.exam || "Speaking practice",
        promptId: $("#speaking-prompt").dataset.promptId || "",
        assignmentId: $("#speaking-prompt").dataset.assignmentId || "",
        pathwayStage: $("#speaking-prompt").dataset.pathwayStage || null,
        focus: $("#speaking-prompt").dataset.focus || "",
        prompt: $("#speaking-prompt").value,
        notes: $("#speaking-notes").value,
        criteria: [
          ...document.querySelectorAll("[data-speaking-check]:checked"),
        ].map((e) => e.value),
        audio: blob,
        mime: blob.type,
        createdAt: Date.now(),
      });
      $("#speaking-prompt").dataset.assignmentId = "";
      await speakingDraft();
      $("#speaking-status").textContent = "Recording saved on this device.";
      renderHistory();
      renderStudyStats();
      renderIELTSAssignment();
    };
    recorder.start();
    $("#btn-record-speaking").disabled = true;
    $("#btn-stop-speaking").disabled = false;
    $("#speaking-status").textContent = "Recording locally…";
  } catch {
    $("#speaking-status").textContent =
      "Microphone permission was not granted. You can still save notes and self-review.";
  }
}
function stopRecording() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  $("#btn-record-speaking").disabled = false;
  $("#btn-stop-speaking").disabled = true;
}
async function saveSpeakingNotes() {
  const text = $("#speaking-notes")?.value.trim();
  if (!text) return;
  await putStudyRecord({
    id: "study:speaking:" + Date.now(),
    type: "speaking-attempt",
    exam: $("#speaking-prompt").dataset.exam || "Speaking practice",
    promptId: $("#speaking-prompt")?.dataset.promptId || "",
    pathwayStage: $("#speaking-prompt")?.dataset.pathwayStage || null,
    focus: $("#speaking-prompt")?.dataset.focus || "",
    prompt: $("#speaking-prompt")?.value || "",
    assignmentId: $("#speaking-prompt")?.dataset.assignmentId || "",
    text,
    criteria: [
      ...document.querySelectorAll("[data-speaking-check]:checked"),
    ].map((e) => e.value),
    createdAt: Date.now(),
  });
  $("#speaking-prompt").dataset.assignmentId = "";
  await speakingDraft();
  $("#speaking-status").textContent =
    "Notes and self-review saved on this device.";
  renderHistory();
  renderStudyStats();
  renderIELTSAssignment();
}
function renderHistory() {
  allStudyRecords().then((rows) => {
    const h = $("#offline-study-history");
    if (!h) return;
    const history = rows
      .filter((r) =>
        [
          "exam-attempt",
          "writing-attempt",
          "speaking-attempt",
          "speaking-recording",
        ].includes(r.type),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12);
    h.innerHTML = history.length
      ? "<h3>Recent offline practice</h3>" +
        history
          .map(
            (r) =>
              `<article class="study-history"><strong>${esc(r.exam)}${r.skill ? " · " + esc(r.skill) : ""}${r.type === "exam-attempt" ? " · " + (r.correct ? "Correct" : "Review again") : ""}</strong><p>${esc(r.prompt || "Practice recording")}</p>${r.text || r.notes ? `<p>${esc((r.text || r.notes).slice(0, 260))}${(r.text || r.notes).length > 260 ? "…" : ""}</p>` : ""}${Array.isArray(r.criteria) && r.criteria.length ? `<p class="hint">Self-review: ${esc(r.criteria.join(" · "))}</p>` : ""}<small>${new Date(r.createdAt).toLocaleString()}</small>${r.audio ? `<audio controls preload="none" src="${URL.createObjectURL(r.audio)}"></audio><button type="button" class="btn-secondary" data-delete-study="${esc(r.id)}">Delete recording</button>` : ""}</article>`,
          )
          .join("")
      : '<p class="hint">Saved exercise attempts, writing, speaking notes and recordings appear here.</p>';
    h.querySelectorAll("[data-delete-study]").forEach(
      (b) =>
        (b.onclick = async () => {
          await deleteStudyRecord(b.dataset.deleteStudy);
          renderHistory();
        }),
    );
  });
}

async function renderStudyStats() {
  const host = $("#offline-study-stats");
  if (!host) return;
  const rows = await allStudyRecords();
  const attempts = rows.filter((r) => r.type === "exam-attempt");
  const results = rows.filter((r) => r.type === "exam-result").sort((a, b) => b.createdAt - a.createdAt);
  const writingCount = rows.filter((r) => r.type === "writing-attempt").length;
  const speakingCount = rows.filter((r) => ["speaking-attempt", "speaking-recording"].includes(r.type)).length;
  if (!attempts.length && !results.length && !writingCount && !speakingCount) {
    host.innerHTML = '<p class="hint">Answer a few questions to see your local progress. Statistics stay on this device.</p>';
    return;
  }
  const bySkill = {};
  for (const row of attempts) {
    const stage = row.exam === "IELTS Academic" && row.pathwayStage ? ` · ${getIELTSPathwayStage(row.pathwayStage).shortLabel}` : "";
    const key = `${row.exam} · ${row.skill}${stage}`;
    const group = bySkill[key] ||= { correct: 0, total: 0 };
    group.total++;
    if (row.correct) group.correct++;
  }
  const recent = results.slice(0, 5).map((r) => `<li><strong>${esc(r.exam)}</strong>${r.exam === "IELTS Academic" && r.pathwayStage ? ` · ${esc(getIELTSPathwayStage(r.pathwayStage).shortLabel)}` : ""} · ${r.correct}/${r.answered} correct${r.mode === "timed" ? " · timed" : ""} · ${new Date(r.createdAt).toLocaleDateString()}</li>`).join("");
  host.innerHTML = `<p><strong>${attempts.length}</strong> objective questions answered · <strong>${results.length}</strong> sets completed · <strong>${writingCount}</strong> Writing attempts · <strong>${speakingCount}</strong> Speaking attempts/recordings</p><h4>Accuracy by objective skill</h4><ul>${Object.entries(bySkill).map(([name, row]) => `<li>${esc(name)}: ${row.correct}/${row.total} (${Math.round(100 * row.correct / row.total)}%)</li>`).join("") || "<li>No objective attempts yet</li>"}</ul><h4>Recent completed sets</h4><ul>${recent || "<li>No completed sets yet</li>"}</ul><p class="hint">Practice statistics are local counts, not predicted IELTS bands or TOEIC scaled scores.</p>`;
}

async function renderListenLibrary() {
  const host = $("#listen-library");
  if (!host) return;
  const rows = (await allStudyRecords())
    .filter((r) => r.type === "listening-document")
    .sort((a, b) => b.updatedAt - a.updatedAt);
  host.innerHTML =
    "<h3>Saved listening materials</h3>" +
    (rows.length
      ? rows
          .map((r) => {
            const transcript = String(r.transcript || "");
            return `<article class="study-history"><strong>${esc(r.title || "Listening material")}</strong><p>${esc(transcript.slice(0, 300))}${transcript.length > 300 ? "…" : ""}</p>${r.audio instanceof Blob ? `<audio controls preload="none" src="${URL.createObjectURL(r.audio)}"></audio>` : ""}<div><button type="button" class="btn-secondary" data-listen-open="${esc(r.id)}">Open in Reader</button><button type="button" class="btn-secondary" data-listen-delete="${esc(r.id)}">Delete</button></div></article>`;
          })
          .join("")
      : '<p class="hint">Save audio and transcript together to keep them available offline.</p>');
  host.querySelectorAll("[data-listen-open]").forEach(
    (b) =>
      (b.onclick = async () => {
        const r = rows.find((x) => x.id === b.dataset.listenOpen);
        if (!r) return;
        const f =
          r.audio instanceof Blob
            ? new File([r.audio], r.fileName || "listening-audio", {
                type: r.audio.type || "audio/mpeg",
              })
            : null;
        window.DD_START_LISTENING?.(f, String(r.transcript || ""));
        $("#listen-dialog")?.close();
      }),
  );
  host.querySelectorAll("[data-listen-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        await deleteStudyRecord(b.dataset.listenDelete);
        renderListenLibrary();
      }),
  );
}

function renderIELTSStageGuidance() {
  const host = $("#ielts-stage-guidance");
  if (!host) return;
  const exam = $("#exam-select")?.value || "IELTS Academic";
  const isIELTS = exam === "IELTS Academic";
  const diagnostic = $("#exam-mode")?.value === "diagnostic";
  document.querySelectorAll(".ielts-pathway-only").forEach((node) => { node.hidden = !isIELTS; });
  const stageControl = $("#ielts-pathway-stage");
  const stageLabel = document.querySelector('label[for="ielts-pathway-stage"]');
  if (stageControl) stageControl.hidden = !isIELTS || diagnostic;
  if (stageLabel) stageLabel.hidden = !isIELTS || diagnostic;
  if (!isIELTS) { host.replaceChildren(); return; }
  const stage = getIELTSPathwayStage(selectedIELTSStage());
  const skill = $("#exam-skill")?.value || "all";
  const skills = skill === "all" ? ["Reading", "Listening"] : [skill];
  host.innerHTML = `${diagnostic ? `<p><strong>40-question objective diagnostic:</strong> 40 Listening + 40 Academic Reading questions. The selected pathway is ignored; results compare raw scores with published reference marks and suggest a next practice stage for each skill separately. This is not a calibrated IELTS mock.</p>` : `<p><strong>${esc(stage.label)}</strong> · ${esc(stage.description)} Nhãn này phân loại mục tiêu luyện tập, không phải band được chấm hay dự đoán.</p>`}${skills.map((name) => { const method = IELTS_LINEAR_GUIDANCE[name]; return `<p><strong>Linear Thinking · ${esc(name)}:</strong> ${esc(method.steps)} <a href="${esc(method.blog)}" target="_blank" rel="noopener">Bài phương pháp trên blog</a></p>`; }).join("")}`;
}

function activeIELTSAssignment(rows, stage) {
  const active = rows.filter((row) => row?.assignmentId && !row.complete && (row.pathwayStage || row.assignmentPathwayStage) === stage && ["exam-session", "writing-draft", "speaking-draft"].includes(row.type))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const row = active[0];
  if (!row) return null;
  if (row.type === "exam-session") {
    const questionIds = row.assignmentQuestionIds || row.questionIds || [];
    const first = getStudyExercises("IELTS Academic", stage).find((item) => item.id === (row.questionId || questionIds[0]));
    return { id: row.assignmentId, kind: "objective", skill: row.assignmentSkill || row.skill, pathwayStage: stage, title: first?.title || first?.part || `${row.assignmentSkill || row.skill} practice`, questionIds, count: questionIds.length, reason: "resume", active: true };
  }
  const kind = row.type === "writing-draft" ? "writing" : "speaking";
  const prompt = getStudyPrompts(kind, stage).find((item) => item.id === row.promptId);
  if (!prompt) return null;
  return { id: row.assignmentId, kind, skill: kind === "writing" ? "Writing" : "Speaking", pathwayStage: stage, title: prompt.task || prompt.title || `${kind} practice`, promptId: prompt.id, count: 1, reason: "resume", active: true };
}

async function renderIELTSAssignment() {
  const host = $("#ielts-assignment");
  if (!host) return;
  const stage = selectedIELTSStage();
  const visible = $("#exam-select")?.value === "IELTS Academic" && $("#exam-mode")?.value !== "diagnostic";
  host.hidden = !visible;
  if (!visible) return;
  const rows = await allStudyRecords();
  const candidate = activeIELTSAssignment(rows, stage) || recommendNextIELTSAssignment({
    stage,
    exercises: getStudyExercises("IELTS Academic", stage),
    writingPrompts: getStudyPrompts("writing", stage),
    speakingPrompts: getStudyPrompts("speaking", stage),
    records: rows,
  });
  if (!candidate) {
    host.innerHTML = "<h3>Bài tiếp theo gợi ý</h3><p class=\"hint\">Chặng này chưa có bài luyện. Hãy chọn chặng khác.</p>";
    return;
  }
  const reason = candidate.reason === "resume"
    ? "Bạn có một lượt đang làm dở; có thể tiếp tục tại đây."
    : candidate.reason === "due"
      ? "Bài này đến hạn ôn dựa trên lịch sử làm bài trên thiết bị."
      : candidate.reason === "new"
        ? "Ưu tiên nội dung chưa làm, có cân nhắc kỹ năng cần luyện thêm và mức độ cân bằng giữa các kỹ năng."
        : "Các bài mới trong chặng này đã hoàn thành; đây là lượt ôn thêm theo thứ tự lâu chưa luyện.";
  const kindLabel = candidate.kind === "objective" ? "Listening/Reading" : candidate.kind === "writing" ? "Writing" : "Speaking";
  const unit = candidate.kind === "objective" ? `${candidate.count} câu trong cùng bài đọc/audio` : "1 đề bài";
  const evidence = candidate.skillPracticeCount >= 3 && candidate.skillAccuracy !== null
    ? `<p class=\"hint\">Ưu tiên ${esc(candidate.skill)} dựa trên ${candidate.skillPracticeCount} lượt gần đây trong chặng này; đây là gợi ý luyện tập, không phải dự đoán band.</p>`
    : "";
  host.innerHTML = `<h3>Bài tiếp theo gợi ý · ${esc(getIELTSPathwayStage(stage).shortLabel)}</h3><p><strong>${esc(candidate.skill)} · ${esc(candidate.title)}</strong> <span class=\"hint\">${esc(kindLabel)} · ${esc(unit)}</span></p><p>${esc(reason)}</p>${evidence}<button type=\"button\" class=\"btn-primary\" data-start-assignment>${candidate.active ? "Tiếp tục bài đang làm" : "Bắt đầu bài được gợi ý"}</button><p class=\"hint\">Lịch, kết quả và bản nháp được lưu trên thiết bị để dùng offline. Bộ chẩn đoán 40 câu mỗi kỹ năng được giữ riêng.</p>`;
  host.querySelector("[data-start-assignment]")?.addEventListener("click", () => startIELTSAssignment(candidate));
}

async function startIELTSAssignment(assignment) {
  const stageSelect = $("#ielts-pathway-stage");
  if (stageSelect) stageSelect.value = assignment.pathwayStage;
  const examSelect = $("#exam-select");
  if (examSelect) examSelect.value = "IELTS Academic";
  if (assignment.kind === "objective") {
    const modeSelect = $("#exam-mode");
    const skillSelect = $("#exam-skill");
    if (modeSelect) modeSelect.value = "practice";
    if (skillSelect) skillSelect.value = assignment.skill;
    current = null;
    clearInterval(startExamClock.timer);
    $("#exam-question")?.classList.add("hidden");
    $("#exam-start")?.classList.remove("hidden");
    renderIELTSStageGuidance();
    examSelect?.dispatchEvent(new Event("change", { bubbles: true }));
    await startSet("IELTS Academic", "practice", assignment.skill, assignment.pathwayStage, assignment);
    return;
  }
  const modeSelect = $("#exam-mode");
  if (modeSelect) {
    modeSelect.value = "practice";
    modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  renderIELTSStageGuidance();
  const panel = assignment.kind === "writing" ? $(".offline-writing") : $(".offline-speaking");
  if (panel) panel.open = true;
  if (assignment.kind === "writing") {
    const prompt = getStudyPrompts("writing", assignment.pathwayStage).find((item) => item.id === assignment.promptId);
    if (prompt) await setWritingPrompt(prompt, assignment.id);
    $("#writing-input")?.focus();
    $("#writing-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    const prompt = getStudyPrompts("speaking", assignment.pathwayStage).find((item) => item.id === assignment.promptId);
    if (prompt) await setSpeakingPrompt(prompt, assignment.id);
    $("#speaking-notes")?.focus();
    $("#speaking-notes")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  await renderIELTSAssignment();
}

export function initOfflineStudy() {
  const quiz = $("#exam-question");
  if (!quiz) return;
  const validation = validateStudyContentPacks();
  const pack = STUDY_CONTENT_PACKS[0];
  const status = $("#study-pack-status");
  const renderSectionStatus = () => {
    if (!status) return;
    if (!validation.valid) { status.textContent = `Content pack validation failed: ${validation.issues.join(" ")}`; return; }
    const exam = $("#exam-select")?.value || "IELTS Academic";
    const skill = $("#exam-skill")?.value || "all";
    const mode = $("#exam-mode")?.value || "practice";
    if (mode === "diagnostic") {
      if (exam !== "IELTS Academic") { status.textContent = "The 40-question band diagnostic is available for IELTS Academic Listening and Reading."; return; }
      const count = getStudyExercises("IELTS Academic").filter((q) => q.diagnosticSet === IELTS_DIAGNOSTIC_FORM && (skill === "all" || q.skill === skill)).length;
      status.textContent = `${pack.title} · v${pack.version} · 40-question-per-skill diagnostic practice: ${skill === "all" ? "80 objective questions" : `${count} ${skill} questions`}. ${getStudyPrompts("writing").length} Writing prompts · ${getStudyPrompts("speaking").length} Speaking prompts. Skill-specific practice recommendation only; no overall or official band. ${pack.license}.`;
      return;
    }
    const pathwayStage = exam === "IELTS Academic" ? selectedIELTSStage() : null;
    const count = getStudyExercises(exam, pathwayStage).filter((q) => (exam !== "IELTS Academic" || !q.diagnosticSet) && (skill === "all" || q.skill === skill)).length;
    const target = SECTION_TARGETS[exam]?.[skill];
    const allQuestions = getStudyExercises(exam).filter((q) => exam === "IELTS Academic" ? q.diagnosticSet === IELTS_DIAGNOSTIC_FORM && (skill === "all" || q.skill === skill) : skill === "all" || q.skill === skill).length;
    const stageName = exam === "IELTS Academic" ? `${getIELTSPathwayStage(pathwayStage).label}: ${count} practice questions in this stage. ` : "";
    const coverage = target ? exam === "IELTS Academic"
      ? `${stageName}${allQuestions}/40 ${skill.toLowerCase()} diagnostic questions. Timed pathway practice scales to the selected stage set.`
      : `${count}/${target.questions} ${skill.toLowerCase()} questions authored. Timed mode is a short starter set.`
      : `${stageName}${count} questions across both skills. Timed mode is practice, not a full exam.`;
    status.textContent = `${pack.title} · v${pack.version} · ${pack.exercises.length} objective questions · ${getStudyPrompts("writing").length} Writing prompts · ${getStudyPrompts("speaking").length} Speaking prompts. ${coverage} No band score is estimated. ${pack.license}.`;
  };
  renderIELTSStageGuidance();
  renderIELTSAssignment();
  renderSectionStatus();
  if (!validation.valid) $("#btn-exam-begin").disabled = true;
  const writing = $("#writing-prompt");
  if (writing) writing.innerHTML = IELTS_PATHWAY_STAGES.map((stage) => `<optgroup label="${esc(stage.label)}">${getStudyPrompts("writing", stage.id).map((p) => `<option value="${esc(p.id)}" data-exam="${esc(p.exam)}" data-stage="${esc(p.pathwayStage)}" data-task="${esc(p.task)}">${esc(p.task)}</option>`).join("")}</optgroup>`).join("");
  initOfflineStudy.lastWritingPromptId = writing?.value || "";
  renderWritingPrompt();
  $("#btn-exam-begin")?.addEventListener("click", () => {
    const exam = $("#exam-select")?.value || "IELTS Academic";
    const mode = $("#exam-mode")?.value || "practice";
    if (mode === "diagnostic" && exam !== "IELTS Academic") {
      status.textContent = "Band diagnostic is available for IELTS Academic Listening and Reading.";
      return;
    }
    startSet(exam, mode, $("#exam-skill")?.value || "all", selectedIELTSStage());
  });
  const updateResume = async () => {
    const r = await allStudyRecords();
    const s = r.find(
      (x) =>
        x.type === "exam-session" &&
        !x.assignmentId &&
        x.exam === $("#exam-select").value &&
        (x.skill || "all") === ($( "#exam-skill")?.value || "all") &&
        (x.mode || "practice") === $("#exam-mode").value &&
        (x.exam !== "IELTS Academic" || x.mode === "diagnostic" || (x.pathwayStage || IELTS_PATHWAY_STAGES[0].id) === selectedIELTSStage()) &&
        !x.complete,
    );
    $("#exam-resume").hidden = !s;
  };
  const selectionChanged = () => {
    const diagnosticOption = $("#exam-mode option[value='diagnostic']");
    if (diagnosticOption) diagnosticOption.disabled = $("#exam-select").value !== "IELTS Academic";
    if (diagnosticOption?.disabled && $("#exam-mode").value === "diagnostic") $("#exam-mode").value = "timed";
    if (current && (current.exam !== $("#exam-select").value || current.mode !== $("#exam-mode").value || (current.skill || "all") !== ($( "#exam-skill")?.value || "all") || current.exam === "IELTS Academic" && current.mode !== "diagnostic" && (current.pathwayStage || IELTS_PATHWAY_STAGES[0].id) !== selectedIELTSStage())) {
      current = null;
      clearInterval(startExamClock.timer);
      $("#exam-question").classList.add("hidden");
      $("#exam-start").classList.remove("hidden");
    }
    renderIELTSStageGuidance();
    renderSectionStatus();
    renderIELTSAssignment();
    updateResume();
  };
  $("#exam-select")?.addEventListener("change", selectionChanged);
  $("#ielts-pathway-stage")?.addEventListener("change", selectionChanged);
  $("#exam-mode")?.addEventListener("change", selectionChanged);
  $("#exam-skill")?.addEventListener("change", selectionChanged);
  $("#exam-resume")?.addEventListener("click", async () => {
    const r = await allStudyRecords();
    current = r.find(
      (x) =>
        x.type === "exam-session" &&
        !x.assignmentId &&
        x.exam === $("#exam-select").value &&
        (x.skill || "all") === ($( "#exam-skill")?.value || "all") &&
        (x.mode || "practice") === $("#exam-mode").value &&
        (x.exam !== "IELTS Academic" || x.mode === "diagnostic" || (x.pathwayStage || IELTS_PATHWAY_STAGES[0].id) === selectedIELTSStage()) &&
        !x.complete,
    );
    if (current) {
      if (current.mode === "diagnostic") current.pathwayStage = null;
      else current.pathwayStage ||= current.exam === "IELTS Academic" ? selectedIELTSStage() : null;
      const available = getSessionExercises(current);
      current.questionIds = available.map((q) => q.id);
      if (!available.some((q) => q.id === current.questionId)) {
        current.questionId = available[0]?.id;
        current.answerIndex = null; current.response = null; current.checked = false; current.correct = null;
        current.results = (current.results || []).filter((result) => current.questionIds.includes(result.questionId));
      }
      $("#exam-start").classList.add("hidden");
      $("#exam-question").classList.remove("hidden");
      await persistAttempt();
      paintQuestion();
      if (isTimedMode()) startExamClock();
    }
  });
  $("#writing-prompt")?.addEventListener("change", async () => {
    const prompt = getStudyPrompts("writing").find((item) => item.id === $("#writing-prompt")?.value);
    if (prompt) await setWritingPrompt(prompt);
  });
  $("#writing-input")?.addEventListener("input", () => {
    writingDraftRevision++;
    clearTimeout(initOfflineStudy.draftTimer);
    initOfflineStudy.draftTimer = setTimeout(saveWritingDraft, 350);
    $("#writing-word-count").textContent =
      $("#writing-input").value.trim().split(/\s+/).filter(Boolean).length +
      " words";
  });
  $("#btn-writing-prompt")?.addEventListener("click", chooseWritingPrompt);
  $("#btn-writing-save")?.addEventListener("click", saveWriting);
  $("#btn-writing-ai-review")?.addEventListener("click", () => requestAiReview("writing"));
  $("#btn-writing-ai-cancel")?.addEventListener("click", () => cancelAiReview("writing"));
  $("#btn-record-speaking")?.addEventListener("click", startRecording);
  $("#btn-stop-speaking")?.addEventListener("click", stopRecording);
  $("#btn-speaking-save")?.addEventListener("click", saveSpeakingNotes);
  $("#btn-speaking-ai-review")?.addEventListener("click", () => requestAiReview("speaking"));
  $("#btn-speaking-ai-cancel")?.addEventListener("click", () => cancelAiReview("speaking"));
  $("#btn-speaking-prompt")?.addEventListener("click", chooseSpeakingPrompt);
  $("#speaking-notes")?.addEventListener("input", () => {
    speakingDraftRevision++;
    speakingDraft();
  });
  $("#btn-listen-save")?.addEventListener("click", async () => {
    const file = $("#listen-audio-file")?.files?.[0];
    const transcript = $("#listen-transcript")?.value.trim();
    if (!file && !transcript) {
      $("#listen-save-status").textContent =
        "Choose audio or add a transcript first.";
      return;
    }
    if (file && file.size > 25 * 1024 * 1024) {
      $("#listen-save-status").textContent =
        "Audio exceeds the 25 MB local limit.";
      return;
    }
    const id = "study:listening:" + Date.now();
    await putStudyRecord({
      id,
      type: "listening-document",
      title:
        $("#listen-material-title")?.value.trim() ||
        file?.name ||
        "Listening transcript",
      fileName: file?.name || "",
      transcript,
      audio: file || null,
      updatedAt: Date.now(),
    });
    $("#listen-save-status").textContent =
      "Saved for offline use on this device.";
    renderListenLibrary();
  });
  $("#btn-listening")?.addEventListener("click", renderListenLibrary);
  window.addEventListener("dd-study-updated", () => {
    renderHistory();
    renderStudyStats();
    renderListenLibrary();
    updateOfflineStorage();
  });
  $("#btn-offline-storage")?.addEventListener("click", async () => {
    if (!navigator.storage?.persist) {
      $("#offline-data-status").textContent =
        "This browser does not offer persistent storage controls. Export a backup regularly.";
      return;
    }
    const ok = await navigator.storage.persist();
    $("#offline-data-status").textContent = ok
      ? "The browser will protect this site’s data from routine storage cleanup. Device/browser settings can still remove it."
      : "The browser declined persistent storage. Export a backup regularly.";
  });
  $("#btn-offline-dictionaries")?.addEventListener("click", () => {
    $("#btn-advanced")?.click();
    $("#adv-tab-dicts")?.click();
  });
  renderHistory();
  renderStudyStats();
  updateOfflineStorage();
  allStudyRecords().then(async (rows) => {
    const oldWritingDraft = rows.find((r) => r.id === "study:writing-draft");
    const writingId = oldWritingDraft?.promptId || writing?.value || "";
    const d = rows.find((r) => r.id === writingDraftId(writingId))
      || rows.find((r) => r.id === "study:writing-draft" && r.promptId === writingId)
      || oldWritingDraft;
    if (d) {
      if (writing && getStudyPrompts("writing").some((item) => item.id === writingId)) writing.value = writingId;
      if (writing) writing.dataset.assignmentId = d.assignmentId || "";
      initOfflineStudy.lastWritingPromptId = writingId || writing?.value || "";
      if ($("#writing-input")) $("#writing-input").value = d.text || "";
      renderWritingPrompt();
      $("#writing-word-count").textContent =
        (d.text || "").trim().split(/\s+/).filter(Boolean).length + " words";
    }
    const assigned = rows.filter((r) => r.assignmentId && !r.complete && ["exam-session", "writing-draft", "speaking-draft"].includes(r.type))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (assigned?.pathwayStage && getIELTSPathwayStage(assigned.pathwayStage)) {
      $("#exam-select").value = "IELTS Academic";
      $("#ielts-pathway-stage").value = assigned.pathwayStage;
      if (assigned.type === "exam-session") {
        $("#exam-mode").value = "practice";
        $("#exam-skill").value = assigned.assignmentSkill || assigned.skill || "all";
      }
    }
    const s = rows.find((r) => r.type === "exam-session" && !r.assignmentId && !r.complete);
    if (s && !assigned) {
      $("#exam-select").value = s.exam;
      $("#exam-skill").value = s.skill || "all";
      $("#exam-mode").value = s.mode || "practice";
      s.mode ||= "practice";
      if (s.exam === "IELTS Academic") $("#ielts-pathway-stage").value = s.pathwayStage || IELTS_PATHWAY_STAGES[0].id;
      renderIELTSStageGuidance();
      renderSectionStatus();
      $("#exam-resume").hidden = false;
    }
    const oldSpeakingDraft = rows.find((r) => r.id === "study:speaking-draft");
    const sp = rows.find((r) => r.id === speakingDraftId(oldSpeakingDraft?.promptId || "")) || oldSpeakingDraft;
    if (sp) {
      const p = getStudyPrompts("speaking").find((item) => item.id === sp.promptId) || getStudyPrompts("speaking").find((item) => item.prompt === sp.prompt);
      if (p) {
        await setSpeakingPrompt(p, sp.assignmentId || "");
      }
      $("#speaking-notes").value = sp.text || "";
    } else await chooseSpeakingPrompt();
    renderIELTSStageGuidance();
    renderSectionStatus();
    renderIELTSAssignment();
  });
}

async function updateOfflineStorage() {
  const el = $("#offline-data-status");
  if (!el) return;
  const rows = await allStudyRecords();
  const savedAudio = rows.filter((r) => r.audio instanceof Blob);
  const media = savedAudio.reduce((n, r) => n + r.audio.size, 0);
  const docs = rows.filter((r) => r.type === "listening-document").length;
  const drafts =
    rows.filter((r) => r.type.endsWith("-draft")).length +
    (localStorage.getItem("dd-journal-draft") ? 1 : 0);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const used = estimate?.usage;
  const quota = estimate?.quota;
  const fmt = (n) =>
    n < 1024 * 1024
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`;
  el.textContent = `${docs} saved listening item${docs === 1 ? "" : "s"} · ${savedAudio.length} local recording${savedAudio.length === 1 ? "" : "s"} (${fmt(media)}) · ${drafts} draft${drafts === 1 ? "" : "s"}${used && quota ? ` · browser storage ${fmt(used)} of ${fmt(quota)}` : ""}.`;
}
