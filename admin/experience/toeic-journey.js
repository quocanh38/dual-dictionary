const WEEK = 7 * 86400000;

export function summarizeToeicJourney(rows, openMatches, now = Date.now()) {
  const attempts = new Map();
  for (const row of rows) {
    if (!row.attemptId || !row.event.startsWith('toeic_')) continue;
    if (!attempts.has(row.attemptId)) attempts.set(row.attemptId, []);
    attempts.get(row.attemptId).push(row);
  }
  const zero = () => ({opened:0,answered:0,explained:0,completed:0,saved:0,eligible:0,reviewed:0,durations:[],sources:new Map()});
  const total = zero();
  const bySet = new Map();
  for (const events of attempts.values()) {
    events.sort((a,b)=>a.at-b.at);
    const start = events.find(row=>row.event==='toeic_opened');
    if (!start || !openMatches(start)) continue;
    const firstAnswer = events.find(row=>row.event==='toeic_answered' && row.at>=start.at);
    const explanation = events.some(row=>row.event==='toeic_explanation_seen' && row.at>=start.at);
    const finish = events.find(row=>row.event==='toeic_completed' && row.at>=start.at);
    const save = finish && events.find(row=>row.event==='toeic_saved' && row.at>=start.at);
    const after = save ? Math.max(save.at,finish.at) : 0;
    const eligible = !!save && after+WEEK<=now;
    const reviewed = eligible && events.some(row=>row.event==='toeic_reviewed' &&
      row.at>=after && row.at<=after+WEEK && row.session!==save.session);
    const id = start.setId || '';
    const group = bySet.get(id) || zero();
    for (const counts of [total,group]) {
      counts.opened++;
      counts.answered+=Number(!!firstAnswer);
      counts.explained+=Number(explanation);
      if (Number.isFinite(firstAnswer?.duration)) counts.durations.push(firstAnswer.duration);
      const source=start.source || 'other';
      counts.sources.set(source,(counts.sources.get(source)||0)+1);
      counts.completed+=Number(!!finish);
      counts.saved+=Number(!!save);
      counts.eligible+=Number(eligible);
      counts.reviewed+=Number(reviewed);
    }
    bySet.set(id,group);
  }
  return {total,bySet};
}
