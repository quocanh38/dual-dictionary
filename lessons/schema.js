// New hackathon module. Validation establishes correspondence, not linguistic truth.
export const FORMAT = 'dual-dictionary-lesson-pack';
export const MAX_BYTES = 2 * 1024 * 1024;
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const idOK = s => typeof s === 'string' && /^[a-z][a-z0-9_-]{0,79}$/i.test(s);
// Controlled inflection matching for model examples, not a grammar grader.
// Source extraction remains verbatim; only the first target verb may vary here.
const verbFamilies=['gather gathers gathered gathering','hand hands handed handing','comply complies complied complying','allocate allocates allocated allocating','meet meets met meeting','keep keeps kept keeping','take takes took taken taking','carry carries carried carrying','draw draws drew drawn drawing','make makes made making','get gets got gotten getting','set sets setting','weigh weighs weighed weighing','bear bears bore borne bearing','put puts putting','come comes came coming','account accounts accounted accounting','give gives gave given giving','follow follows followed following','run runs ran running','reach reaches reached reaching','narrow narrows narrowed narrowing','point points pointed pointing','look looks looked looking','turn turns turned turning','deal deals dealt dealing','work works worked working','pay pays paid paying','lead leads led leading','focus focuses focused focusing','build builds built building','break breaks broke broken breaking'].map(s=>s.split(' '));
const regexMeta=new Set([...'.*+?^${}()|[]',String.fromCharCode(92)]);
const escapePattern=s=>Array.from(s,c=>regexMeta.has(c)?String.fromCharCode(92)+c:c).join('');
export function containsTargetUse(text,phrase){const parts=norm(phrase).toLowerCase().split(' '),family=verbFamilies.find(f=>f.includes(parts[0]))||[parts[0]];const variants=family.map(v=>escapePattern([v,...parts.slice(1)].join(' '))).join('|');return new RegExp('(?:^|[^\\p{L}\\p{N}_])(?:'+variants+')(?=$|[^\\p{L}\\p{N}_])','u').test(norm(text).toLowerCase());}
export function sourceSentences(text) {
  return norm(text).split(/(?<=[.!?])\s+/).filter(Boolean).map((text, i) => ({ id: `s${i + 1}`, text }));
}
export function validateSelection(targets, reading) {
  const errors = [];
  if (!Array.isArray(targets) || targets.length !== 2) return ['Select exactly two targets.'];
  const seen = new Set();
  for (const t of targets) {
    if (!t || typeof t !== 'object') { errors.push('Invalid target.'); continue; }
    const allowed = ['id','phrase','meaningEn','meaningVi','sourceSentenceId'];
    if (Object.keys(t).some(k => !allowed.includes(k))) errors.push('Unexpected target field.');
    if (!idOK(t.id) || seen.has(t.id)) errors.push('Target IDs must be valid and unique.');
    seen.add(t.id);
    for (const k of ['phrase','meaningEn','meaningVi']) if (typeof t[k] !== 'string' || !t[k].trim() || t[k].length > 500) errors.push(`Invalid target ${k}.`);
    const s = reading?.sentences?.find(s => s.id === t.sourceSentenceId);
    if (!s || !norm(s.text).toLowerCase().includes(norm(t.phrase).toLowerCase())) errors.push(`Target ${t.id || '?'} is not present in its source sentence.`);
  }
  if (new Set(targets.map(t => norm(t?.phrase).toLowerCase())).size !== targets.length) errors.push('Choose two different phrases.');
  return errors;
}
export function validatePack(p, { approved = false } = {}) {
  const errors = [];
  if (/LLM_[0-9]{6,}_[A-Za-z0-9_-]{12,}/.test(JSON.stringify(p))) return {ok:false,errors:['Credential-like content must not be included in a lesson pack.']};
  const fail = s => errors.push(s);
  const obj = (o, keys, name) => { if (!o || Array.isArray(o) || typeof o !== 'object') { fail(`${name} must be an object.`); return false; } if (Object.keys(o).some(k => !keys.includes(k))) fail(`${name} contains unexpected fields.`); return true; };
  const str = (s, name, max = 1000) => { if (typeof s !== 'string' || !s.trim() || s.length > max) fail(`Invalid ${name}.`); };
  try {
    if (new TextEncoder().encode(JSON.stringify(p)).length > MAX_BYTES) return { ok: false, errors: ['Pack exceeds the 2 MB limit.'] };
    if (!obj(p, ['schemaVersion','packId','version','title','language','explanationLanguage','levelEstimate','topic','provenance','generation','lessons','review'], 'Pack')) return { ok: false, errors };
    if (p.schemaVersion !== 1 || !Number.isSafeInteger(p.version) || p.version < 1) fail('Unsupported schema or invalid version.');
    if (!idOK(p.packId)) fail('Invalid pack ID.');
    str(p.title, 'title', 180);
    if (p.language !== 'en' || p.explanationLanguage !== 'en-vi') fail('This version supports English with EN/VI explanations.');
    if (!['B1','B2'].includes(p.levelEstimate) || !['academic','workplace'].includes(p.topic)) fail('Invalid estimated level or topic.');
    if (obj(p.provenance, ['author','sourceType','rightsStatement','aiAssisted'], 'Provenance')) {
      str(p.provenance.author, 'author', 150); str(p.provenance.rightsStatement, 'rights statement', 1000);
      if (!['original','licensed'].includes(p.provenance.sourceType) || typeof p.provenance.aiAssisted !== 'boolean') fail('Invalid provenance.');
    }
    if (obj(p.generation, ['provider','model','promptVersion','generatedAt'], 'Generation')) for (const k of ['provider','model','promptVersion','generatedAt']) str(p.generation[k], k, 150);
    const lessonIDs = new Set();
    if (!Array.isArray(p.lessons) || !p.lessons.length || p.lessons.length > 10) fail('A pack needs 1–10 lessons.');
    else for (const l of p.lessons) {
      if (!obj(l, ['lessonId','title','objective','reading','targets','exercises'], 'Lesson')) continue;
      if (!idOK(l.lessonId) || lessonIDs.has(l.lessonId)) fail('Lesson IDs must be unique.'); lessonIDs.add(l.lessonId);
      str(l.title, 'lesson title', 180); str(l.objective, 'objective', 500);
      if (!obj(l.reading, ['text','sentences'], 'Reading')) continue;
      str(l.reading.text, 'reading', 12000);
      const sentences = Array.isArray(l.reading.sentences) ? l.reading.sentences : [];
      if (!sentences.length || sentences.length > 100) fail('Reading needs 1–100 sentences.');
      const sentenceIDs = new Set();
      for (const s of sentences) {
        if (!obj(s, ['id','text'], 'Sentence')) continue;
        if (!idOK(s.id) || sentenceIDs.has(s.id)) fail('Sentence IDs must be valid and unique.'); sentenceIDs.add(s.id); str(s.text,'sentence',12000);
      }
      if (norm(sentences.map(s => s.text).join(' ')) !== norm(l.reading.text)) fail('Source sentences do not reconstruct the reading.');
      errors.push(...validateSelection(l.targets, l.reading));
      const exerciseIDs = new Set(), coverage = new Map((l.targets || []).map(t => [t.id, new Set()]));
      if (!Array.isArray(l.exercises) || l.exercises.length < 5 || l.exercises.length > 12) { fail('A lesson needs 5–12 exercises.'); continue; }
      for (const e of l.exercises) {
        if (!obj(e, ['exerciseId','type','targetId','prompt','sourceSentenceIds','options','correctOptionId','explanation','sentenceWithGap','sampleAnswer','selfCheck'], 'Exercise')) continue;
        if (!idOK(e.exerciseId) || exerciseIDs.has(e.exerciseId)) fail('Exercise IDs must be unique.'); exerciseIDs.add(e.exerciseId);
        if (!['meaning','usage','cloze','transfer'].includes(e.type)) fail('Unsupported exercise type.');
        if (!coverage.has(e.targetId)) fail('Unknown exercise target.'); else coverage.get(e.targetId).add(e.type);
        str(e.prompt, 'exercise prompt', 1500); str(e.explanation, 'explanation', 2000);
        if (!Array.isArray(e.sourceSentenceIds) || !e.sourceSentenceIds.length || e.sourceSentenceIds.some(id => !sentenceIDs.has(id))) fail('Exercise has unknown source references.');
        const citedTarget=l.targets?.find(t=>t.id===e.targetId);if(citedTarget&&!e.sourceSentenceIds?.includes(citedTarget.sourceSentenceId))fail('Exercise must cite its target source sentence.');
        if (e.type === 'transfer') {
          if ('options' in e || 'correctOptionId' in e || 'sentenceWithGap' in e) fail('Free writing must not have an automatic grade.');
          str(e.sampleAnswer, 'sample answer', 1500);
          if (!Array.isArray(e.selfCheck) || e.selfCheck.length < 2 || e.selfCheck.length > 5) fail('Transfer needs 2–5 self-check items.'); else e.selfCheck.forEach(s => str(s,'self-check item',400));
          const t = l.targets?.find(t => t.id === e.targetId); if (t && !containsTargetUse(e.sampleAnswer,t.phrase)) fail('Transfer sample must use its target phrase or a supported verb inflection.');
        } else {
          if ('sampleAnswer' in e || 'selfCheck' in e) fail('Closed questions must not carry a free-writing score.');
          const opts = Array.isArray(e.options) ? e.options : [];
          if (opts.length < 3 || opts.length > 4) fail('Closed questions need 3–4 options.');
          const ids = new Set(), texts = new Set();
          for (const o of opts) { if (!obj(o, ['id','text','explanation'], 'Option')) continue; if (!idOK(o.id) || ids.has(o.id)) fail('Duplicate or invalid option ID.'); ids.add(o.id);str(o.text,'option',1000);str(o.explanation,'option explanation',1000);const text=norm(o.text).toLowerCase();if(texts.has(text))fail('Duplicate option text.');texts.add(text); }
          if (!ids.has(e.correctOptionId)) fail('Correct option ID does not exist.');
          if (e.type === 'cloze') {
            const answer=opts.find(o=>o.id===e.correctOptionId), source=sentences.find(s=>s.id===e.sourceSentenceIds?.[0]);
            if (typeof e.sentenceWithGap !== 'string' || e.sentenceWithGap.split('____').length !== 2 || !answer || !source || norm(e.sentenceWithGap.replace('____',answer.text))!==norm(source.text)) fail('Cloze must reconstruct its exact source with one gap.');
          } else if ('sentenceWithGap' in e) fail('Only a cloze may have a gap sentence.');
        }
      }
      for (const types of coverage.values()) if (!types.has('meaning') || !(types.has('usage')||types.has('cloze'))) fail('Each target needs a meaning and usage/cloze question.');
      if (!l.exercises.some(e=>e.type==='transfer')) fail('Include a self-assessed transfer task.');
    }
    if (obj(p.review, ['status','reviewerType','note','checks','findings'], 'Review')) {
      if (!['draft','reviewed','approved'].includes(p.review.status) || !['not-reviewed','ai-assisted-editor','human-editor','authored-fixture'].includes(p.review.reviewerType)) fail('Invalid review status/type.');
      if (typeof p.review.note !== 'string' || p.review.note.length > 4000) fail('Invalid review note.');
      if (!Array.isArray(p.review.findings) || p.review.findings.length > 50) fail('Invalid review findings.');
      else for(const f of p.review.findings){if(!obj(f,['severity','message','resolved'],'Finding'))continue;str(f.message,'finding',1000);if(!['minor','critical','uncertain'].includes(f.severity)||typeof f.resolved!=='boolean')fail('Invalid finding.');}
      if (!obj(p.review.checks,['rights','meaning','uniqueAnswers','explanations'],'Review checks')) { /* errors recorded */ }
      if (p.review.status !== 'draft') {
        if (p.review.reviewerType === 'not-reviewed' || !p.review.note.trim() || !['rights','meaning','uniqueAnswers','explanations'].every(k=>p.review.checks?.[k]===true)) fail('Review requires all four checks and a review note.');
        if (p.review.findings?.some(f=>!f.resolved&&['critical','uncertain'].includes(f.severity))) fail('Resolve critical and uncertain findings before review/approval.');
      }
      if (approved && p.review.status !== 'approved') fail('Only an explicitly approved pack can be exported or installed.');
    }
  } catch { fail('Malformed pack structure.'); }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function stableJSON(v) { if(Array.isArray(v))return '['+v.map(stableJSON).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableJSON(v[k])).join(',')+'}';return JSON.stringify(v); }
export async function digest(v) { const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJSON(v)));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''); }
export async function exportPack(pack) { const v=validatePack(pack,{approved:true});if(!v.ok)throw Error(v.errors.join('\n'));return { format:FORMAT,payload:pack,sha256:await digest(pack) }; }
export async function readPack(text) { if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('File exceeds 2 MB.');let e;try{e=JSON.parse(text);}catch{throw Error('File is not valid JSON.');}if(!e||Object.keys(e).some(k=>!['format','payload','sha256'].includes(k))||e.format!==FORMAT)throw Error('Not a supported lesson pack.');const v=validatePack(e.payload,{approved:true});if(!v.ok)throw Error(v.errors.join('\n'));if(e.sha256!==await digest(e.payload))throw Error('Integrity check failed. This checksum is not an author signature.');return e; }
