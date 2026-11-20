const errorRateSteps = {
  lookup: ['download_needed', 'download_failed'],
  reader: ['download_needed', 'download_failed'],
  chat: ['sent', 'error'],
};

// Older records share a version tag across builds with different tracking coverage.
const errorRateVersions = new Set(['v202-ux-signals', 'v203-dictionary-repeat']);

export function summarizeSiteJourneys(rows, matchesOpen) {
  const attempts=new Map();
  for (const row of rows) {
    if (row.event!=='journey_step' || !row.attemptId) continue;
    const key=row.journey+':'+row.attemptId;
    if (!attempts.has(key)) attempts.set(key,[]);
    attempts.get(key).push(row);
  }
  const result=new Map();
  for (const events of attempts.values()) {
    events.sort((a,b)=>a.at-b.at);
    const start=events.find(row=>row.step==='opened');
    if (!start || !matchesOpen(start)) continue;
    if (!result.has(start.journey)) result.set(start.journey,{
      opened:0, steps:new Map(), sources:new Map(), reasons:new Map(), durations:[],
      errorRate:{eligible:0, failed:0},
    });
    const counts=result.get(start.journey);
    counts.opened++;
    const source=start.source || 'app';
    counts.sources.set(source,(counts.sources.get(source)||0)+1);
    const rateSteps=errorRateSteps[start.journey];
    if (rateSteps && errorRateVersions.has(start.version)) {
      const [baseStep, failureStep]=rateSteps;
      const eligible=events.find(row=>row.version===start.version && row.step===baseStep && row.at>=start.at);
      if (eligible) {
        counts.errorRate.eligible++;
        if (events.some(row=>row.version===start.version && row.step===failureStep && row.at>=eligible.at)) {
          counts.errorRate.failed++;
        }
      }
    }
    const seen=new Set();
    for (const row of events) {
      if (row.at<start.at || row.step==='opened' || seen.has(row.step)) continue;
      seen.add(row.step);
      counts.steps.set(row.step,(counts.steps.get(row.step)||0)+1);
      if (row.step==='error' && row.reason) counts.reasons.set(row.reason,(counts.reasons.get(row.reason)||0)+1);
      if (['response','result'].includes(row.step) && Number.isFinite(row.duration)) counts.durations.push(row.duration);
    }
  }
  for (const counts of result.values()) counts.durations.sort((a,b)=>a-b);
  return result;
}
