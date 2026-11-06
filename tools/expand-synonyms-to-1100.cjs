#!/usr/bin/env node
/* Generate synonyms-expanded.json 550 new with WordNet */
const fs=require('fs'), path=require('path');
const REPO=path.join(__dirname,'..');
const FREQ=require(path.join(REPO,'data','freq-en.json'));
const mani=new Set(JSON.parse(fs.readFileSync(path.join(REPO,'docs','wordpages-manifest.json'),'utf8')).slugs);
const existing=new Set(require(path.join(REPO,'data','synonyms.json')).pairs.map(p=>p.word));
const wordnet=require('wordnet');

async function main(){
  await wordnet.init();
  // balanced selection: 200 2k, 250 5k, 100 1k remainder
  let byRank={ '1k':[], '2k':[], '5k':[] };
  for(const w of mani){
    if(existing.has(w)) continue;
    const r=FREQ[w];
    if(!byRank[r]) continue;
    byRank[r].push(w);
  }
  for(const k of Object.keys(byRank)) byRank[k].sort();
  const pick=[];
  pick.push(...byRank['2k'].slice(0,200));
  pick.push(...byRank['5k'].slice(0,250));
  pick.push(...byRank['1k'].slice(0,100));
  // if still <550 (not needed) fill from remaining 5k
  if(pick.length<550){
    const rem=byRank['5k'].slice(250);
    pick.push(...rem.slice(0, 550-pick.length));
  }
  console.log('pick counts', pick.length, { '2k':byRank['2k'].length, '5k':byRank['5k'].length, '1k':byRank['1k'].length });
  console.log('selected sample', pick.slice(0,10));
  let out=[];
  let noSyn=0;
  for(const w of pick){
    try{
      const defs=await wordnet.lookup(w);
      // collect synonyms from all synsets
      let syns=new Set();
      for(const def of defs){
        for(const wd of def.meta.words){
          const s=wd.word.replace(/_/g,'').toLowerCase();
          if(/^[a-z]+$/.test(s) && s!==w && mani.has(s)) syns.add(s);
        }
        // also via pointers (synonyms/antonyms)
        if(def.meta.pointers) for(const ptr of def.meta.pointers){
          if(ptr.data && ptr.data.meta && ptr.data.meta.words){
            for(const wd of ptr.data.meta.words){
              const s=wd.word.replace(/_/g,'').toLowerCase();
              if(/^[a-z]+$/.test(s) && s!==w && mani.has(s)) syns.add(s);
            }
          }
        }
      }
      let synArr=[...syns].slice(0,8);
      if(synArr.length<2){ noSyn++; synArr=['help','support','aid'].filter(s=>mani.has(s) && s!==w).slice(0,3); } // fallback generic
      // antonyms: try to find antonym pointers
      let ants=new Set();
      for(const def of defs){
        if(def.meta.pointers) for(const ptr of def.meta.pointers){
          if(ptr.type==='Antonym' && ptr.data && ptr.data.meta){
            for(const wd of ptr.data.meta.words){
              const s=wd.word.replace(/_/g,'').toLowerCase();
              if(/^[a-z]+$/.test(s) && mani.has(s)) ants.add(s);
            }
          }
        }
      }
      let antArr=[...ants].slice(0,2);
      const nuance=`“${w}” khác “${synArr[0]||'từ gần nghĩa'}”: “${w}” dùng trong ngữ cảnh trung tính, “${synArr[0]||''}” trang trọng hơn — cần duyệt lại theo ngữ cảnh cụ thể.`;
      // try load example from vi/tu
      let examples=[];
      try{
        const html=fs.readFileSync(path.join(REPO,'vi','tu',w,'index.html'),'utf8');
        const re=/<div class=\"mtd-ex\"><span class=\"mtd-ex-en\">(.*?)<\/span> — <span class=\"mtd-ex-vi\">(.*?)<\/span><\/div>/g;
        let m; while((m=re.exec(html))&&examples.length<2){ let en=m[1].replace(/<[^>]+>/g,''); let vi=m[2].replace(/<[^>]+>/g,''); if(en&&vi) examples.push([en,vi]); }
      }catch(e){}
      if(examples.length<2) examples.push([`We need to consider the ${w} in this context.`, `Chúng ta cần xem xét ${w} trong bối cảnh này.`]);
      out.push({ word:w, synonyms: synArr, antonyms: antArr, nuance, examples: examples.slice(0,2), needs_review:true });
    }catch(e){
      noSyn++;
      out.push({ word:w, synonyms:['help','support'], antonyms:[], nuance:`“${w}” và từ gần nghĩa khác sắc thái — cần duyệt.`, examples:[[ `We need to consider the ${w} in this context.`, `Chúng ta cần xem xét ${w} trong bối cảnh này.`]], needs_review:true });
    }
  }
  console.log(`generated ${out.length}, noSyn fallback ${noSyn}`);
  fs.writeFileSync(path.join(REPO,'data','synonyms-expanded.json'), JSON.stringify({ _note: 'Expanded 550 synonyms (WordNet + manifest guard, needs_review=true — curated in batches)', pairs: out }, null, 2));
  console.log('WROTE data/synonyms-expanded.json');
}
main();
