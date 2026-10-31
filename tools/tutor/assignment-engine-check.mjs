import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source = await fs.readFile("js/assignment-engine.js", "utf8");
const { recommendNextIELTSAssignment } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 28, 0, 0, 0);
const stage = "band-6";
const exercises = [
  { id: "r1", exam: "IELTS Academic", skill: "Reading", pathwayStage: stage, title: "Passage A", passage: "Shared academic text", part: "Passage 1" },
  { id: "r2", exam: "IELTS Academic", skill: "Reading", pathwayStage: stage, title: "Passage A, question 2", passage: "Shared academic text", part: "Passage 1" },
  { id: "l1", exam: "IELTS Academic", skill: "Listening", pathwayStage: stage, title: "Audio B", transcript: "Shared listening script" },
  { id: "diag", exam: "IELTS Academic", skill: "Reading", pathwayStage: stage, diagnosticSet: "form", title: "Diagnostic" },
  { id: "other-stage", exam: "IELTS Academic", skill: "Reading", pathwayStage: "band-7", title: "Other stage" },
];
const writingPrompts = [{ id: "w1", pathwayStage: stage, task: "Task 1" }];
const speakingPrompts = [{ id: "s1", pathwayStage: stage, task: "Part 2" }];
const recommend = (records = [], at = now) => recommendNextIELTSAssignment({ stage, exercises, writingPrompts, speakingPrompts, records, now: at });

let result = recommend();
assert.ok(result);
assert.equal(result.reason, "new");
assert.ok(result.kind === "objective" || result.kind === "writing" || result.kind === "speaking");
assert.equal(recommend([], now).id, recommend([], now).id, "recommendations must be deterministic at a fixed time");
assert.ok(!["diag", "other-stage"].includes(result.questionIds?.[0]), "diagnostic and other-stage content must never enter the recommendation");

// A shared context is one assignment and its unseen questions stay grouped.
result = recommendNextIELTSAssignment({ stage, exercises: exercises.filter((item) => item.skill === "Reading"), records: [{ type: "exam-attempt", exam: "IELTS Academic", skill: "Reading", questionId: "r1", pathwayStage: stage, correct: true, mode: "practice", createdAt: now - day }], now });
assert.equal(result.kind, "objective");
assert.equal(result.title, "Passage A");
assert.deepEqual(new Set(result.questionIds), new Set(["r2"]), "the already-practiced question is skipped while unseen context siblings remain grouped");
const grouped = recommend([
  { type: "exam-attempt", exam: "IELTS Academic", skill: "Reading", questionId: "r1", pathwayStage: stage, correct: true, mode: "practice", createdAt: now - 10 * day },
  { type: "exam-attempt", exam: "IELTS Academic", skill: "Reading", questionId: "r2", pathwayStage: stage, correct: true, mode: "practice", createdAt: now - 10 * day },
], now);
assert.ok(grouped.reason === "due", "an overdue objective review must outrank unseen material");
assert.equal(grouped.skill, "Reading");
assert.deepEqual(new Set(grouped.questionIds), new Set(["r1", "r2"]));

// Diagnostic attempts do not create repetitions or influence scheduling.
const diagnosticOnly = recommend([{ type: "exam-attempt", exam: "IELTS Academic", skill: "Reading", questionId: "r1", pathwayStage: stage, correct: false, mode: "diagnostic", createdAt: now - 3 * day }]);
assert.notEqual(diagnosticOnly.reason, "due");
assert.ok(diagnosticOnly.kind !== "objective" || !diagnosticOnly.questionIds.includes("diag"));

// A wrong answer becomes due after one day; recent correct work stays unseen-first.
const wrong = recommend([{ type: "exam-attempt", exam: "IELTS Academic", skill: "Listening", questionId: "l1", pathwayStage: stage, correct: false, mode: "practice", createdAt: now - 2 * day }]);
assert.equal(wrong.reason, "due");
assert.equal(wrong.skill, "Listening");
const notYetDue = recommend([{ type: "exam-attempt", exam: "IELTS Academic", skill: "Listening", questionId: "l1", pathwayStage: stage, correct: true, mode: "practice", createdAt: now - day }]);
assert.notEqual(notYetDue.reason, "due");

// Production tasks participate in the same due/unseen order.
const writingDue = recommend([
  { type: "writing-attempt", exam: "IELTS Academic", promptId: "w1", pathwayStage: stage, criteria: [], createdAt: now - 2 * day },
  ...exercises.filter((item) => item.id !== "diag").map((item) => ({ type: "exam-attempt", exam: "IELTS Academic", skill: item.skill, questionId: item.id, pathwayStage: stage, correct: true, mode: "practice", createdAt: now - day })),
], now);
assert.equal(writingDue.kind, "writing");
assert.equal(writingDue.reason, "due");

// When every task has history and none is due, provide a deterministic optional review.
const allAttempts = [
  ...exercises.filter((item) => item.id !== "diag" && item.pathwayStage === stage).map((item) => ({ type: "exam-attempt", exam: "IELTS Academic", skill: item.skill, questionId: item.id, pathwayStage: stage, correct: true, mode: "practice", createdAt: now - day })),
  { type: "writing-attempt", exam: "IELTS Academic", promptId: "w1", pathwayStage: stage, criteria: ["Task", "Coherence", "Vocabulary", "Grammar"], createdAt: now - day },
  { type: "speaking-attempt", exam: "IELTS Academic", promptId: "s1", pathwayStage: stage, criteria: ["Fluency", "Vocabulary", "Grammar", "Pronunciation"], createdAt: now - day },
];
const optionalReview = recommend(allAttempts, now);
assert.equal(optionalReview.reason, "all-reviewed");
console.log("PASS: deterministic offline assignment ranking, stage and diagnostic isolation, passage grouping, due reviews, production tasks and optional fallback");
