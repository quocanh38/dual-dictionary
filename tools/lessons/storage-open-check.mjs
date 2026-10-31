// Deterministic request-lifecycle regression. No real IndexedDB or user profile.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../lessons/storage.js',import.meta.url),'utf8');
const storage=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const requests=[],connections=[];
const previous=globalThis.indexedDB;
function connection(){
 const db={closes:0,onversionchange:null,close(){this.closes++;},transaction(names,mode){
  assert.equal(mode,'readonly');const tx={objectStore(){return{getAll(){const request={};queueMicrotask(()=>{request.result=[];request.onsuccess();});return request;}};}};
  queueMicrotask(()=>queueMicrotask(()=>tx.oncomplete()));return tx;
 }};connections.push(db);return db;
}
try{
 globalThis.indexedDB={open(name,version){assert.equal(name,'dd-lesson-studio-v1');assert.equal(version,1);const r={};requests.push(r);return r;}};
 const rejected=storage.snapshotRecords();const first=requests[0];first.onblocked();
 await assert.rejects(rejected,/Close another lesson window and retry/);
 const late=connection();first.result=late;first.onsuccess();assert.equal(late.closes,1);
 assert.equal(late.onversionchange,null,'rejected open must not hand out late connection');
 const retry=storage.snapshotRecords();const next=requests[1],normal=connection();next.result=normal;next.onsuccess();
 const snapshot=await retry;assert.deepEqual(snapshot,{drafts:[],packs:[],progress:[],usage:[]});assert.equal(normal.closes,1,'normal completed snapshot closes connection');
 assert.equal(typeof normal.onversionchange,'function');normal.onversionchange();assert.equal(normal.closes,2,'versionchange handler closes connection');
 console.log('4 storage open lifecycle groups PASS (deterministic fake IndexedDB)');
}finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;}
