// Deterministic, offline IELTS assignment recommendations.
// This module has no browser or storage dependencies so its scheduling rules
// can be exercised directly in Node and used while the app is offline.
const DAY = 24 * 60 * 60 * 1000;
const SKILLS = ["Listening", "Reading", "Writing", "Speaking"];

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeContext(value) {
  return String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function isDiagnostic(row) {
  return row?.mode === "diagnostic" || Boolean(row?.diagnosticSet);
}

function eligibleAttempts(records, predicate) {
  return records.filter((row) => row && !isDiagnostic(row) && predicate(row))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function reviewDueAt(attempts, kind) {
  const latest = attempts.at(-1);
  if (!latest) return null;
  let days;
  if (kind === "objective") {
    if (!latest.correct) days = 1;
    else {
      let streak = 0;
      for (let i = attempts.length - 1; i >= 0 && attempts[i].correct; i--) streak++;
      days = [3, 7, 14, 30][Math.min(streak - 1, 3)];
    }
  } else {
    // Self-check boxes are formative reflection, not an AI grade or IELTS band.
    const checked = Array.isArray(latest.criteria) ? latest.criteria.length : 0;
    days = checked <= 1 ? 1 : checked <= 2 ? 3 : 7;
  }
  return (latest.createdAt || 0) + days * DAY;
}

function groupedObjectives(exercises) {
  const groups = new Map();
  for (const item of exercises) {
    const context = normalizeContext(item.passage || item.transcript || (Array.isArray(item.audioChoices) ? item.audioChoices.join("|") : item.image));
    const contextKey = context || `item:${item.id}`;
    const key = [item.skill, item.pathwayStage, stableHash(contextKey)].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

function buildSkillStats(records, stage, exercises, writingPrompts, speakingPrompts) {
  const itemIds = new Set(exercises.map((item) => item.id));
  const promptIds = new Set([...writingPrompts, ...speakingPrompts].map((item) => item.id));
  const measures = [];
  for (const row of records) {
    if (!row || isDiagnostic(row) || row.exam && row.exam !== "IELTS Academic") continue;
    if (row.pathwayStage && row.pathwayStage !== stage) continue;
    if (row.type === "exam-attempt" && itemIds.has(row.questionId)) {
      measures.push({ skill: row.skill, score: row.correct ? 1 : 0, createdAt: row.createdAt || 0 });
    } else if (row.type === "writing-attempt" && promptIds.has(row.promptId) && (!row.pathwayStage || row.pathwayStage === stage)) {
      const criteria = Array.isArray(row.criteria) ? row.criteria.length : 0;
      measures.push({ skill: "Writing", score: criteria / 4, createdAt: row.createdAt || 0 });
    } else if (["speaking-attempt", "speaking-recording"].includes(row.type) && promptIds.has(row.promptId) && (!row.pathwayStage || row.pathwayStage === stage)) {
      const criteria = Array.isArray(row.criteria) ? row.criteria.length : 0;
      measures.push({ skill: "Speaking", score: criteria / 4, createdAt: row.createdAt || 0 });
    }
  }
  const stats = Object.fromEntries(SKILLS.map((skill) => [skill, { count: 0, accuracy: null, priority: 0 }]));
  for (const skill of SKILLS) {
    const recent = measures.filter((row) => row.skill === skill).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    const row = stats[skill];
    row.count = recent.length;
    if (recent.length) {
      row.accuracy = recent.reduce((sum, attempt) => sum + attempt.score, 0) / recent.length;
      const confidence = Math.min(1, recent.length / 6);
      const estimatedWeakness = 0.5 + confidence * (0.5 - row.accuracy);
      row.priority = estimatedWeakness + 0.18 / Math.sqrt(recent.length + 1);
    } else {
      row.priority = 0.5 + 0.18;
    }
  }
  return stats;
}

function skillRotation(now) {
  const offset = Math.floor(now / DAY) % SKILLS.length;
  return [...SKILLS.slice(offset), ...SKILLS.slice(0, offset)];
}

/**
 * Return one stable, personalized IELTS task for the selected pathway stage.
 * Due work outranks unseen work; unseen work outranks optional repeats. Within
 * each group, recent skill evidence and the least-practiced skill guide choice.
 */
export function recommendNextIELTSAssignment({
  stage,
  exercises = [],
  writingPrompts = [],
  speakingPrompts = [],
  records = [],
  now = Date.now(),
} = {}) {
  if (!stage) return null;
  const objectiveItems = exercises.filter((item) => item?.exam === "IELTS Academic" && item.pathwayStage === stage && !item.diagnosticSet);
  const writings = writingPrompts.filter((item) => item?.pathwayStage === stage);
  const speakings = speakingPrompts.filter((item) => item?.pathwayStage === stage);
  const itemIds = new Set(objectiveItems.map((item) => item.id));
  const attemptRows = eligibleAttempts(records, (row) => row.type === "exam-attempt" && row.exam === "IELTS Academic" && itemIds.has(row.questionId));
  const attemptsByQuestion = new Map();
  for (const row of attemptRows) {
    const list = attemptsByQuestion.get(row.questionId) || [];
    list.push(row);
    attemptsByQuestion.set(row.questionId, list);
  }

  const candidates = [];
  for (const group of groupedObjectives(objectiveItems)) {
    const items = group.items;
    const dueIds = [];
    const unseenIds = [];
    const dueTimes = [];
    for (const item of items) {
      const attempts = attemptsByQuestion.get(item.id) || [];
      if (!attempts.length) unseenIds.push(item.id);
      else {
        const dueAt = reviewDueAt(attempts, "objective");
        if (dueAt <= now) { dueIds.push(item.id); dueTimes.push(dueAt); }
      }
    }
    const questionIds = [...dueIds, ...unseenIds];
    const first = items[0];
    candidates.push({
      id: `objective:${stage}:${first.skill}:${stableHash(group.key)}`,
      kind: "objective",
      skill: first.skill,
      pathwayStage: stage,
      title: first.title || first.part || first.skill,
      questionIds,
      count: questionIds.length,
      priority: dueIds.length ? 0 : questionIds.length ? 1 : 2,
      dueAt: dueTimes.length ? Math.min(...dueTimes) : null,
      reason: dueIds.length ? "due" : unseenIds.length ? "new" : "all-reviewed",
    });
  }

  const promptAttempts = eligibleAttempts(records, (row) =>
    (row.type === "writing-attempt" && writings.some((item) => item.id === row.promptId)) ||
    (["speaking-attempt", "speaking-recording"].includes(row.type) && speakings.some((item) => item.id === row.promptId)),
  );
  const attemptsByPrompt = new Map();
  for (const row of promptAttempts) {
    const list = attemptsByPrompt.get(row.promptId) || [];
    list.push(row);
    attemptsByPrompt.set(row.promptId, list);
  }
  for (const [kind, prompts, skill] of [["writing", writings, "Writing"], ["speaking", speakings, "Speaking"]]) {
    for (const prompt of prompts) {
      const attempts = attemptsByPrompt.get(prompt.id) || [];
      const dueAt = attempts.length ? reviewDueAt(attempts, "production") : null;
      const due = dueAt !== null && dueAt <= now;
      candidates.push({
        id: `${kind}:${stage}:${prompt.id}`,
        kind,
        skill,
        pathwayStage: stage,
        title: prompt.task || prompt.title || `${skill} practice`,
        promptId: prompt.id,
        count: 1,
        priority: due ? 0 : attempts.length ? 2 : 1,
        dueAt,
        reason: due ? "due" : attempts.length ? "all-reviewed" : "new",
      });
    }
  }
  if (!candidates.length) return null;

  const stats = buildSkillStats(records, stage, objectiveItems, writings, speakings);
  const rotation = skillRotation(now);
  candidates.sort((a, b) =>
    a.priority - b.priority ||
    stats[b.skill].priority - stats[a.skill].priority ||
    (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) ||
    rotation.indexOf(a.skill) - rotation.indexOf(b.skill) ||
    a.id.localeCompare(b.id),
  );
  const selected = candidates[0];
  return {
    ...selected,
    reason: selected.reason === "due" ? "due" : selected.reason === "new" ? "new" : "all-reviewed",
    skillPracticeCount: stats[selected.skill].count,
    skillAccuracy: stats[selected.skill].accuracy,
  };
}
