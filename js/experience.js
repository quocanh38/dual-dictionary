import { CONSENT_NOTICE, EXPERIENCE_VERSION, OPERATIONAL_EVENTS, FEEDBACK_TOPICS, UX_SIGNALS } from './experience-config.js';

const preference = 'dd-experience-consent';
const queueKey = 'dd-experience-queue';
const endpoint = '/.netlify/functions/experience';
const version = EXPERIENCE_VERSION;
let operationalEnabled = false;

function experienceChoice() {
  try {
    const choice = JSON.parse(localStorage.getItem(preference));
    return choice?.notice === CONSENT_NOTICE && typeof choice.allowed === 'boolean' &&
      Number.isSafeInteger(choice.at) ? choice : null;
  } catch { return null; }
}
function experienceConsent() {
  const choice = experienceChoice();
  return choice?.allowed ? choice : null;
}
export function sharesExperience() {
  return experienceConsent() !== null;
}
const sessionKey = 'dd-experience-session';
const sessionIdleMs = 30 * 60 * 1000;
let session;
let sessionAt = 0;
let retryDelay = 5000;
const MAX_RETRY_DELAY = 60000;

function sessionId(at) {
  if (!session) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey));
      session = saved?.id;
      sessionAt = saved?.at || 0;
    } catch { /* Session remains in memory if storage is unavailable. */ }
  }
  if (!session || at - sessionAt >= sessionIdleMs || at < sessionAt) session = crypto.randomUUID();
  sessionAt = at;
  try { sessionStorage.setItem(sessionKey, JSON.stringify({id:session,at})); } catch {}
  return session;
}
let sending = false;
let scheduled;

function queue() {
  try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); }
  catch { return []; }
}

export async function flushExperience() {
  if (sending || !navigator.onLine) return;
  sending = true;
  try {
    for (const batch of queue()) {
      if (!queue().some(item=>item.id===batch.id)) continue;
      const consent = experienceConsent();
      if (batch.entries[0].event !== 'feedback' && (!consent || batch.consentedAt !== consent.at)) {
        localStorage.setItem(queueKey,JSON.stringify(queue().filter(item=>item.id!==batch.id)));
        continue;
      }
      const pending = queue();
      const queued = pending.find(item=>item.id===batch.id);
      if (!queued) continue;
      // Freeze the batch before sending so a lost response cannot make retry
      // reuse its id with new entries that the server would discard.
      queued.sealed = true;
      localStorage.setItem(queueKey, JSON.stringify(pending));
      const {sealed, ...body} = queued;
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!response.ok && ![400, 413].includes(response.status)) break;
      retryDelay = 5000;
      localStorage.setItem(queueKey,JSON.stringify(queue().filter(item=>item.id!==batch.id)));
    }
  } catch { /* Keep queued events for the next online attempt. */ }
  finally {
    sending = false;
    clearTimeout(scheduled);
    if (navigator.onLine && queue().length) {
      scheduled = setTimeout(flushExperience, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    }
  }
}

export function trackExperience(event, fields = {}) {
  try {
    if (operationalEnabled && OPERATIONAL_EVENTS.includes(event) && navigator.onLine) {
      void fetch(endpoint + '?operations', {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event, version}),
      }).catch(() => {});
    }
    const consent = experienceConsent();
    if (event !== 'feedback' && !consent) return false;
    const at = Date.now();
    const currentSession = sessionId(at);
    const pending = queue();
    const entry = {event,at,...fields};
    const last = pending.at(-1);
    if (!sending && event !== 'feedback' && last?.session === currentSession && last.version === version && !last.sealed && last.consentedAt === consent.at &&
        last.entries[0].event !== 'feedback' && last.entries.length < 30) {
      last.entries.push(entry);
    } else {
      if (pending.length >= 100) return false;
      pending.push({id:crypto.randomUUID(),session:currentSession,version,entries:[entry],...(event === 'feedback' ? {} : {consentNotice: consent.notice, consentedAt: consent.at})});
    }
    localStorage.setItem(queueKey,JSON.stringify(pending));
    clearTimeout(scheduled);
    scheduled = setTimeout(flushExperience,event==='feedback'?0:1200);
    return true;
  } catch { return false; }
}

const seenUxSignals = new Set();
export function trackUxSignal(signal) {
  if (!Object.hasOwn(UX_SIGNALS,signal) || !experienceConsent()) return;
  if (!seenUxSignals.has(signal) && trackExperience('ux_signal',{signal})) seenUxSignals.add(signal);
}

export function initExperience() {
  const opt = document.querySelector('#experience-opt-in');
  if (!opt) return;
  const notice = document.querySelector('#experience-choice');
  const message = document.querySelector('#experience-choice-status');
  const syncChoice = () => {
    const choice = experienceChoice();
    opt.checked = choice?.allowed === true;
    if (notice) notice.hidden = Boolean(choice);
  };
  const setChoice = (allowed) => {
    try {
      localStorage.setItem(preference,JSON.stringify({notice:CONSENT_NOTICE,allowed,at:Date.now()}));
    } catch {
      syncChoice();
      if (message) message.textContent = 'Trình duyệt chưa lưu được lựa chọn chia sẻ.';
      return;
    }
    syncChoice();
    if (message) message.textContent = allowed ? 'Đã bật chia sẻ dữ liệu trải nghiệm.' : 'Đã tắt chia sẻ dữ liệu trải nghiệm.';
    if (!allowed) {
      try {
        localStorage.removeItem('dd-experience-review-anchor');
        localStorage.setItem(queueKey,JSON.stringify(queue().filter(batch=>batch.entries[0].event==='feedback')));
      } catch { /* The sender still checks consent before sending. */ }
    }
  };
  notice?.querySelector('[data-experience-allow]')?.addEventListener('click',()=>setChoice(true));
  notice?.querySelector('[data-experience-decline]')?.addEventListener('click',()=>setChoice(false));
  window.addEventListener('storage',event=>{ if (event.key===preference || event.key===null) syncChoice(); });
  syncChoice();
  try {
    if (!opt.checked) localStorage.setItem(queueKey,JSON.stringify(queue().filter(batch=>batch.entries[0].event==='feedback')));
  } catch {}
  void fetch(endpoint + '?operations', {credentials:'omit', referrerPolicy:'no-referrer'})
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      operationalEnabled = config?.enabled === true;
      document.querySelector('#experience-operations-banner').hidden = !operationalEnabled;
      document.querySelector('#experience-operations-state').textContent = operationalEnabled
        ? 'HọcTA đang gửi số đếm tải audio theo ngày và phiên bản.'
        : 'Số liệu vận hành mặc định hiện đang tắt.';
    }).catch(() => {});
  opt.onchange = () => setChoice(opt.checked);
  const form = document.querySelector('#experience-feedback');
  form.onsubmit = (event) => {
    event.preventDefault();
    const note = form.elements.note.value.trim();
    if (!note) return;
    const topic = form.elements.topic?.value;
    const category = FEEDBACK_TOPICS.includes(topic) ? topic : undefined;
    form.querySelector('[role=status]').textContent = trackExperience('feedback',{note,category})
      ? 'Đã xếp góp ý vào hàng đợi. App sẽ gửi khi kết nối được.'
      : 'Chưa lưu được góp ý. Hãy thử lại.';
    if (form.querySelector('[role=status]').textContent.startsWith('Đã')) form.reset();
  };
  window.addEventListener('online',flushExperience);
  window.addEventListener('focus',flushExperience);
  void flushExperience();
}

// An instance represents one user-visible path. Only the fixed journey metadata
// is recorded. Starting without consent does not create a linkable ID.
export function startExperienceJourney(journey, source = 'app') {
  if (!sharesExperience()) return null;
  const started = Date.now();
  const consentAt = experienceConsent()?.at;
  const attemptId = crypto.randomUUID();
  const seen = new Set();
  const step = (name, {duration, reason} = {}) => {
    if (seen.has(name) || experienceConsent()?.at !== consentAt) return;
    if (trackExperience('journey_step', {attemptId, journey, step:name,
      ...(name === 'opened' ? {source} : {}), duration, reason})) seen.add(name);
  };
  step('opened');
  return {step, elapsed:()=>Date.now()-started, reached:name=>seen.has(name), attemptId, consentAt};
}

export function experienceAiReason(error) {
  const message = String(error?.message || '');
  if (/rate limit|quota/i.test(message)) return 'quota';
  if (/timed out/i.test(message)) return 'timeout';
  if (/could not reach|bị ngắt/i.test(message)) return 'network';
  if (/api key|rejected the key/i.test(message)) return 'setup';
  return 'other';
}
