import { CONSENT_NOTICE, EXPERIENCE_VERSION, OPERATIONAL_EVENTS } from './experience-config.js';

const preference = 'dd-experience-consent';
const queueKey = 'dd-experience-queue';
const endpoint = '/.netlify/functions/experience';
const version = EXPERIENCE_VERSION;
let operationalEnabled = false;

function experienceConsent() {
  try {
    const consent = JSON.parse(localStorage.getItem(preference));
    return consent?.notice === CONSENT_NOTICE && Number.isSafeInteger(consent.at) ? consent : null;
  } catch { return null; }
}
export function sharesExperience() {
  return experienceConsent() !== null;
}
let session;
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
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch)});
      if (!response.ok && ![400, 413].includes(response.status)) break;
      localStorage.setItem(queueKey,JSON.stringify(queue().filter(item=>item.id!==batch.id)));
    }
  } catch { /* Keep queued events for the next online attempt. */ }
  finally { sending = false; }
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
    session ||= crypto.randomUUID();
    const pending = queue();
    const entry = {event,at:Date.now(),...fields};
    const last = pending.at(-1);
    if (!sending && event !== 'feedback' && last?.session === session && last?.consentedAt === consent.at &&
        last.entries[0].event !== 'feedback' && last.entries.length < 30) {
      last.entries.push(entry);
    } else {
      if (pending.length >= 100) return false;
      pending.push({id:crypto.randomUUID(),session,version,entries:[entry],...(event === 'feedback' ? {} : {consentNotice: consent.notice, consentedAt: consent.at})});
    }
    localStorage.setItem(queueKey,JSON.stringify(pending));
    clearTimeout(scheduled);
    scheduled = setTimeout(flushExperience,event==='feedback'?0:1200);
    return true;
  } catch { return false; }
}

export function initExperience() {
  const opt = document.querySelector('#experience-opt-in');
  if (!opt) return;
  opt.checked = sharesExperience();
  try {
    if (!opt.checked) localStorage.setItem(queueKey,JSON.stringify(queue().filter(batch=>batch.entries[0].event==='feedback')));
  } catch {}
  void fetch(endpoint + '?operations', {credentials:'omit', referrerPolicy:'no-referrer'})
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      operationalEnabled = config?.enabled === true;
      document.querySelector('#experience-operations-banner').hidden = !operationalEnabled;
      document.querySelector('#experience-operations-state').textContent = operationalEnabled
        ? 'Dual Dict đang gửi số đếm tải audio theo ngày và phiên bản.'
        : 'Số liệu vận hành mặc định hiện đang tắt.';
    }).catch(() => {});
  opt.onchange = () => {
    try {
      if (opt.checked) localStorage.setItem(preference,JSON.stringify({notice:CONSENT_NOTICE,at:Date.now()}));
      else localStorage.removeItem(preference);
      if (!opt.checked) localStorage.setItem(queueKey,JSON.stringify(queue().filter(batch=>batch.entries[0].event==='feedback')));
    } catch { opt.checked = false; }
  };
  const form = document.querySelector('#experience-feedback');
  form.onsubmit = (event) => {
    event.preventDefault();
    const note = form.elements.note.value.trim();
    if (!note) return;
    form.querySelector('[role=status]').textContent = trackExperience('feedback',{note})
      ? 'Đã xếp góp ý vào hàng đợi. App sẽ gửi khi kết nối được.'
      : 'Chưa lưu được góp ý. Hãy thử lại.';
    if (form.querySelector('[role=status]').textContent.startsWith('Đã')) form.reset();
  };
  window.addEventListener('online',flushExperience);
  window.addEventListener('focus',flushExperience);
  void flushExperience();
}
