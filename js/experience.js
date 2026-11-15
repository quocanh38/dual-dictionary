const preference = 'dd-experience-consent';
const queueKey = 'dd-experience-queue';
const endpoint = '/.netlify/functions/experience';
const version = 'v193-admin-experience';
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
      const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch)});
      if (!response.ok) break;
      localStorage.setItem(queueKey,JSON.stringify(queue().filter(item=>item.id!==batch.id)));
    }
  } catch { /* Keep queued events for the next online attempt. */ }
  finally { sending = false; }
}

export function trackExperience(event, fields = {}) {
  try {
    if (event !== 'feedback' && localStorage.getItem(preference) !== 'yes') return false;
    session ||= crypto.randomUUID();
    const pending = queue();
    const entry = {event,at:Date.now(),...fields};
    const last = pending.at(-1);
    if (!sending && event !== 'feedback' && last?.session === session &&
        last.entries[0].event !== 'feedback' && last.entries.length < 30) {
      last.entries.push(entry);
    } else {
      if (pending.length >= 100) return false;
      pending.push({id:crypto.randomUUID(),session,version,entries:[entry]});
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
  try { opt.checked = localStorage.getItem(preference) === 'yes'; } catch {}
  opt.onchange = () => {
    try {
      localStorage.setItem(preference,opt.checked?'yes':'no');
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
