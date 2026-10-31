/** Small, versioned local cache for phrase extraction results. Cache contents stay in this browser and are labelled at use time. */
const KEY='dd-tutor-cache-v1';
const VERSION='phrases-v1';
function hash(value) { let h=2166136261; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0).toString(16); }
function readAll() { try { const data=JSON.parse(localStorage.getItem(KEY)||'{}'); return data.version===VERSION&&data.entries&&typeof data.entries==='object'?data.entries:{}; } catch { return {}; } }
export function getTutorCache({provider,model,task,input,promptVersion}) { const key=hash([VERSION,provider,model,task,promptVersion,input].join('\u001f')); return readAll()[key]||null; }
export function setTutorCache({provider,model,task,input,promptVersion},value) {
  const entries=readAll(), key=hash([VERSION,provider,model,task,promptVersion,input].join('\u001f'));
  entries[key]={value,createdAt:Date.now()};
  const newest=Object.entries(entries).sort((a,b)=>b[1].createdAt-a[1].createdAt).slice(0,20);
  try { localStorage.setItem(KEY,JSON.stringify({version:VERSION,entries:Object.fromEntries(newest)})); } catch { /* cache is optional when quota is full */ }
}
export function clearTutorCache() { localStorage.removeItem(KEY); }
