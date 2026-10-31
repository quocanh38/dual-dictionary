import {readPack} from './schema.js';
const fields=['packId','version','title','topic','levelEstimate','file','sha256'];
export function readLibraryIndex(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>512*1024)throw Error('Invalid library index size.');
 const index=JSON.parse(raw);
 if(index?.format!=='dual-dictionary-lesson-library'||index.schemaVersion!==1||!Array.isArray(index.packs)||index.packs.length>200)throw Error('Unsupported library index.');
 const ids=new Set(),files=new Set();
 for(const p of index.packs){
  if(!p||Object.keys(p).length!==fields.length||fields.some(k=>!(k in p))||typeof p.packId!=='string'||!/^[-a-z0-9_]{1,160}$/i.test(p.packId)||!Number.isSafeInteger(p.version)||p.version<1||typeof p.title!=='string'||!p.title.trim()||p.title.length>180||!['academic','workplace'].includes(p.topic)||!['B1','B2'].includes(p.levelEstimate)||typeof p.file!=='string'||!/^[-a-z0-9_]+\.json$/i.test(p.file)||!/^([a-f0-9]{64})$/.test(p.sha256))throw Error('Invalid library entry.');
  const id=p.packId+'@'+p.version;if(ids.has(id)||files.has(p.file))throw Error('Duplicate library entry.');ids.add(id);files.add(p.file);
 }
 return index;
}
export async function readLibraryPack(raw,entry){
 // Revalidate the entry even if a caller bypasses index parsing.
 readLibraryIndex(JSON.stringify({format:'dual-dictionary-lesson-library',schemaVersion:1,packs:[entry]}));
 const envelope=await readPack(raw),p=envelope.payload;
 if(envelope.sha256!==entry.sha256||['packId','version','title','topic','levelEstimate'].some(k=>p[k]!==entry[k]))throw Error('Library pack does not match the reviewed index. Nothing installed.');
 return envelope;
}
export async function fetchLibraryIndex(fetcher=fetch){
 const response=await fetcher(new URL('./library/index.json',import.meta.url));if(!response.ok)throw Error('Lesson library is unavailable. Retry when online.');return readLibraryIndex(await response.text());
}
export async function fetchLibraryPack(entry,fetcher=fetch){
 readLibraryIndex(JSON.stringify({format:'dual-dictionary-lesson-library',schemaVersion:1,packs:[entry]}));
 const response=await fetcher(new URL('./library/'+entry.file,import.meta.url));if(!response.ok)throw Error('This lesson is unavailable. Retry when online.');return readLibraryPack(await response.text(),entry);
}
