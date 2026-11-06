#!/usr/bin/env node
/* Expand synonyms 553 -> 1103 (550 new) covering top 2k-5k */
const fs=require('fs'), path=require('path');
const REPO=path.join(__dirname,'..');
const FREQ=require(path.join(REPO,'data','freq-en.json'));
const mani=new Set(JSON.parse(fs.readFileSync(path.join(REPO,'docs','wordpages-manifest.json'),'utf8')).slugs);
const existing=new Set(require(path.join(REPO,'data','synonyms.json')).pairs.map(p=>p.word));
const rankOrder={'2k':0,'5k':1,'1k':2,'10k':3}; // priority 2k-5k first
let cands=[];
for(const w of mani){
  if(existing.has(w)) continue;
  const r=FREQ[w];
  if(!r || !rankOrder.hasOwnProperty(r)) continue; // only 1k/2k/5k/10k
  cands.push({w, rRank: rankOrder[r], rLabel:r});
}
cands.sort((a,b)=>a.rRank-b.rRank || (a.w<b.w?-1:1));
const selected=cands.slice(0,550);
console.log(`Selected 550 candidates:`, selected.slice(0,10).map(c=>c.w+'('+c.rLabel+')').join(', '));
fs.writeFileSync(path.join(REPO,'data','synonyms-expanded-candidates.json'), JSON.stringify(selected.map(c=>c.w), null,2));
console.log(`by rank:`, selected.reduce((a,c)=>{a[c.rLabel]=(a[c.rLabel]||0)+1; return a;},{}));
