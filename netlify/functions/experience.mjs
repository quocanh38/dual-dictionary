import { getStore } from '@netlify/blobs';
import { TOEIC_FOCUS_SETS, getStudyExercises } from '../../js/study-content.js';
import { timingSafeEqual } from 'node:crypto';

const events = new Set(['audio_start','audio_ready','audio_error','mistake_saved','mistake_reviewed','gemini_start','gemini_done','gemini_error','gemini_saved','gemini_stopped','feedback']);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default async function handler(request) {
  const secret = process.env.DD_EXPERIENCE_ADMIN_KEY;
  const url = new URL(request.url);
  const openCatalog = () => getStore({name:process.env.CONTEXT === 'production' ? 'dd-experience-catalog' : 'dd-experience-catalog-preview',consistency:'strong'});
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
    if (request.method === 'GET' && url.searchParams.has('sets')) {
      const bank = new Map(getStudyExercises('TOEIC Listening & Reading').map(q=>[q.id,q]));
      const catalog = await openCatalog().list();
      return json({hidden:catalog.blobs.map(blob=>blob.key),sets:TOEIC_FOCUS_SETS.map(set=>({
        ...set, questions:set.questionIds.map(id=>bank.get(id)).filter(Boolean),
      }))});
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
            !['other','toeic','reader','gemini','offline'].includes(category) ||
            typeof note !== 'string' || note.length > 500) return json({error:'Invalid feedback status'},400);
        await store.setJSON(id,{...record,moderation:{status,category,note}});
      }
      return json({ok:true});
    }
    const batch = await store.list({cursor:new URL(request.url).searchParams.get('cursor') || undefined});
    const records = await Promise.all(batch.blobs.map(entry => store.get(entry.key,{type:'json'})));
    return json({records:records.flatMap((record,index)=>record?.entries ? [{...record,id:batch.blobs[index].key}] : []),cursor:batch.cursor || null});
  }
  if (request.method !== 'POST') return json({error:'Method'}, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({error:'Origin'}, 403);
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({error:'Too large'}, 413);
    const {id, session, version, entries} = JSON.parse(raw);
    if (!uuid.test(id) || !uuid.test(session) || !/^v[\w-]{1,60}$/.test(version) || !Array.isArray(entries) || !entries.length || entries.length > 30) return json({error:'Invalid batch'},400);
    const clean = entries.map(({event, at, note, duration, reason}) => {
      if (!events.has(event) || !Number.isSafeInteger(at)) throw Error('Invalid event');
      if (event === 'feedback' && (typeof note !== 'string' || !note.trim() || note.length > 500)) throw Error('Invalid feedback');
      return {event,at,...(event === "gemini_error" && ["quota","timeout","network","other"].includes(reason)?{reason}:{}),...(event === 'feedback' ? {note} : {}),...(Number.isSafeInteger(duration)&&duration>=0&&duration<=600000?{duration}:{})};
    });
    const store = openStore();
    await store.setJSON(id,{session,version,receivedAt:Date.now(),entries:clean},{onlyIfNew:true});
    return json({ok:true});
  } catch (error) {
    return json({error:'Could not accept batch'},error.message.startsWith('Invalid') || error instanceof SyntaxError || error instanceof TypeError && !request.signal.aborted ? 400 : 503);
  }
}
