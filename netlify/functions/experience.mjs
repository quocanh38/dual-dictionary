import { CONSENT_NOTICE, EXPERIENCE_VERSION, OPERATIONAL_EVENTS, TOEIC_PART5_SAMPLE, TOEIC_PART5_SOURCE, JOURNEY_STEPS, JOURNEY_SOURCES, JOURNEY_REASONS, FEEDBACK_TOPICS, UX_SIGNALS } from '../../js/experience-config.js';
import { getStore } from '@netlify/blobs';
import { TOEIC_FOCUS_SETS, getStudyExercises } from '../../js/study-content.js';
import { timingSafeEqual } from 'node:crypto';

const events = new Set(['audio_start','audio_ready','audio_error','mistake_saved','mistake_reviewed','gemini_start','gemini_done','gemini_error','gemini_saved','gemini_stopped','feedback','toeic_opened','toeic_completed','toeic_answered','toeic_explanation_seen','toeic_saved','toeic_reviewed','journey_step','ux_signal']);
const previousJourneyVersion = 'v198-site-journeys';
const experienceVersions = new Set(['v195-experience', 'v196-first-lookup', 'v197-toeic-journey', previousJourneyVersion, EXPERIENCE_VERSION]);
const journeyVersions = new Set([previousJourneyVersion, EXPERIENCE_VERSION]);
const toeicSetIds = new Set(TOEIC_FOCUS_SETS.map(({id})=>id));
const journeyRetentionMs = 90 * 86400000;
const isJourney = event=>event==='journey_step' || event.startsWith('toeic_');
const hasReportWindow = event=>isJourney(event) || event==='ux_signal';

export const config = {
  path: '/.netlify/functions/experience',
  rateLimit: {windowSize:60, windowLimit:120, aggregateBy:['ip','domain']},
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default async function handler(request) {
  const secret = process.env.DD_EXPERIENCE_ADMIN_KEY;
  const url = new URL(request.url);
  const openOperations = () => getStore({name:process.env.CONTEXT === 'production' ? 'dd-experience-operations' : 'dd-experience-operations-preview',consistency:'strong'});
  const openCatalog = () => getStore({name:process.env.CONTEXT === 'production' ? 'dd-experience-catalog' : 'dd-experience-catalog-preview',consistency:'strong'});
  const operationsEnabled = !!secret && process.env.DD_EXPERIENCE_OPERATIONS === 'enabled';
  if (url.searchParams.has('operations')) {
    if (request.method === 'GET') return json({enabled:operationsEnabled});
    if (request.method !== 'POST') return json({error:'Method'},405);
    if (!operationsEnabled) return json({error:'Disabled'},403);
    if (request.headers.get('origin') !== url.origin) return json({error:'Origin'},403);
    const raw = await request.text();
    if (raw.length > 300) return json({error:'Too large'},413);
    let payload;
    try { payload = JSON.parse(raw); } catch { return json({error:'Invalid metric'},400); }
    if (!experienceVersions.has(payload?.version) || !OPERATIONAL_EVENTS.includes(payload.event) ||
        Object.keys(payload).length !== 2) return json({error:'Invalid metric'},400);
    const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short'}).format(new Date());
    const store = openOperations();
    const bucket = `${day}/${payload.version}/${payload.event}`;
    for (let attempt=0; attempt<5; attempt++) {
      const before = await store.getWithMetadata(bucket,{type:'json'});
      const write = await store.setJSON(bucket,{count:(before?.data?.count || 0)+1},
        before ? {onlyIfMatch:before.etag} : {onlyIfNew:true});
      if (write.modified) return new Response(null,{status:204});
    }
    return json({error:'Metric busy'},503);
  }
  if (request.method === 'GET' && url.searchParams.has('catalog')) {
    if (!secret) return json({hidden:[]});
    const page = await openCatalog().list();
    return json({hidden:page.blobs.map(blob=>blob.key)});
  }
  if (!secret) return json({ error: 'Disabled' }, 503);
  const openStore = () => getStore({name:process.env.CONTEXT === 'production' ? 'dd-experience' : 'dd-experience-preview',consistency:'strong'});
  if (['GET','PATCH','DELETE'].includes(request.method)) {
    const supplied = Buffer.from(request.headers.get('authorization') || '');
    const expected = Buffer.from('Bearer ' + secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return json({error:'Unauthorized'}, 401);
    const store = openStore();
    if (request.method === 'GET' && url.searchParams.has('operational-report')) {
      const operations = openOperations();
      const page = await operations.list({cursor:url.searchParams.get('cursor') || undefined});
      const rows = await Promise.all(page.blobs.map(async ({key}) => {
        const [day,version,event] = key.split('/');
        return {day,version,event,count:(await operations.get(key,{type:'json'}))?.count || 0};
      }));
      return json({rows,cursor:page.cursor || null,enabled:operationsEnabled});
    }
    if (request.method === 'GET' && url.searchParams.has('sets')) {
      const bank = new Map(getStudyExercises('TOEIC Listening & Reading').map(q=>[q.id,q]));
      const catalog = await openCatalog().list();
      return json({hidden:catalog.blobs.map(blob=>blob.key),sets:TOEIC_FOCUS_SETS.map(set=>{
        const questions=set.questionIds.map(id=>bank.get(id)).filter(Boolean);
        return {...set,part:set.part || Number(questions[0]?.part.match(/^Part (\d+)/)?.[1]) || null,questions};
      })});
    }
    if (request.method !== 'GET') {
      if (request.headers.get('origin') !== url.origin) return json({error:'Origin'},403);
      const raw = await request.text();
      if (raw.length > 4000) return json({error:'Too large'},413);
      let input;
      try { input = JSON.parse(raw); } catch { return json({error:'Invalid JSON'},400); }
      if (input?.setId) {
        if (request.method !== 'PATCH' || typeof input.hidden !== 'boolean' ||
            !TOEIC_FOCUS_SETS.some(set=>set.id===input.setId)) return json({error:'Invalid set'},400);
        const catalog = openCatalog();
        if (input.hidden) await catalog.setJSON(input.setId,{hidden:true});
        else await catalog.delete(input.setId);
        return json({ok:true});
      }
      const {id,status,category,note} = input || {};
      if (!uuid.test(id)) return json({error:'Invalid ID'},400);
      const record = await store.get(id,{type:'json'});
      if (!record?.entries?.some(entry=>entry.event==='feedback')) return json({error:'Feedback not found'},404);
      if (request.method === 'DELETE') {
        await store.setJSON(id,{deleted:true});
      } else {
        if (!['new','working','done'].includes(status) ||
            !FEEDBACK_TOPICS.includes(category) ||
            typeof note !== 'string' || note.length > 500) return json({error:'Invalid feedback status'},400);
        await store.setJSON(id,{...record,moderation:{status,category,note}});
      }
      return json({ok:true});
    }
    const batch = await store.list({cursor:new URL(request.url).searchParams.get('cursor') || undefined});
    const records = await Promise.all(batch.blobs.map(entry => store.get(entry.key,{type:'json'})));
    const earliest = Date.now() - journeyRetentionMs;
    return json({records:records.flatMap((record,index)=>{
      const entries=record?.entries?.filter(entry=>!hasReportWindow(entry.event) || entry.at>=earliest);
      return entries?.length ? [{...record,entries,id:batch.blobs[index].key}] : [];
    }),cursor:batch.cursor || null});
  }
  if (request.method !== 'POST') return json({error:'Method'}, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'Origin'}, 403);
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({error:'Too large'}, 413);
    const {id, session, version, entries, consentNotice, consentedAt} = JSON.parse(raw);
    if (!uuid.test(id) || !uuid.test(session) || !/^v[\w-]{1,60}$/.test(version) || !Array.isArray(entries) || !entries.length || entries.length > 30) return json({error:'Invalid batch'},400);
    const now = Date.now();
    const expectedNotice = version === EXPERIENCE_VERSION ? CONSENT_NOTICE : version === previousJourneyVersion ? 'experience-v4' : version === 'v197-toeic-journey' ? 'experience-v3' : 'experience-v2';
    const consentValid = consentNotice === expectedNotice && Number.isSafeInteger(consentedAt) && consentedAt > 0;
    const clean = entries.map(entry => {
      const {event, at, note, duration, reason, attemptId, setId, source, journey, step, category, signal} = entry;
      if (!events.has(event) || !Number.isSafeInteger(at)) throw Error('Invalid event');
      if (category !== undefined && (event !== 'feedback' || !FEEDBACK_TOPICS.includes(category))) throw Error('Invalid topic');
      if (event === 'feedback' && (typeof note !== 'string' || !note.trim() || note.length > 500)) throw Error('Invalid feedback');
      if (event !== 'feedback' && (!experienceVersions.has(version) || !consentValid || at < consentedAt)) throw Error('Invalid consent');
      if (event === 'ux_signal') {
        if (version !== EXPERIENCE_VERSION || at > now + 300000 ||
            !Object.hasOwn(UX_SIGNALS,signal) || Object.keys(entry).length !== 3) throw Error('Invalid UX signal');
        return {event,at,signal};
      }
      const linked = isJourney(event);
      if (linked && (!consentValid || typeof attemptId !== 'string' || !uuid.test(attemptId))) throw Error('Invalid attempt');
      if (linked && at > now + 300000) throw Error('Invalid timestamp');
      if (event === 'journey_step') {
        if (!journeyVersions.has(version) || !Object.hasOwn(JOURNEY_STEPS,journey) ||
            !JOURNEY_STEPS[journey].includes(step) ||
            (step === 'opened' ? !JOURNEY_SOURCES.includes(source) : source !== undefined) ||
            (reason !== undefined && (step !== 'error' || !JOURNEY_REASONS.includes(reason)))) throw Error('Invalid journey');
        return {event,at,attemptId,journey,step,...(source ? {source} : {}),...(reason ? {reason} : {}),
          ...(Number.isSafeInteger(duration)&&duration>=0&&duration<=86400000 ? {duration} : {})};
      }
      const reportsSet = event === 'toeic_opened' && (journeyVersions.has(version) || version === 'v197-toeic-journey');
      if (setId !== undefined && (!reportsSet || !toeicSetIds.has(setId))) throw Error('Invalid set');
      if (source !== undefined && (!reportsSet || setId !== TOEIC_PART5_SAMPLE || source !== TOEIC_PART5_SOURCE)) throw Error('Invalid source');
      return {event,at,...(linked ? {attemptId} : {}),...(setId ? {setId} : {}),...(source ? {source} : {}),...(event === "gemini_error" && ["quota","timeout","network","other"].includes(reason)?{reason}:{}),...(event === 'feedback' ? {note,...(category ? {category} : {})} : {}),...(Number.isSafeInteger(duration)&&duration>=0&&duration<=600000?{duration}:{})};
    });
    const retained = clean.filter(entry=>!hasReportWindow(entry.event) || entry.at>=now-journeyRetentionMs);
    if (retained.length) {
      await openStore().setJSON(id,{session,version,receivedAt:now,entries:retained,
        ...(consentValid ? {consentNotice,consentedAt} : {})},{onlyIfNew:true});
    }
    return json({ok:true});
  } catch (error) {
    return json({error:'Could not accept batch'},error.message.startsWith('Invalid') || error instanceof SyntaxError || error instanceof TypeError && !request.signal.aborted ? 400 : 503);
  }
}
