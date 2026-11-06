#!/usr/bin/env node
/* Cover QA: test hình trắng/bể như người dùng thật */
const fs=require('fs'), path=require('path'), sharp=require('sharp');
const REPO=path.join(__dirname,'..');
const covers = fs.readdirSync(path.join(REPO,'vi/blog/images'), {withFileTypes:true}).flatMap(cat=>{
  if(!cat.isDirectory()) return [];
  const catPath=path.join(REPO,'vi/blog/images',cat.name);
  return fs.readdirSync(catPath,{withFileTypes:true}).filter(d=>d.isDirectory()).map(sub=>path.join(cat.name, sub.name));
});
// also top-level collocations-ielts
try{ if(fs.existsSync(path.join(REPO,'vi/blog/images/collocations-ielts/og-1200x630-v2.jpg'))) covers.push('collocations-ielts'); }catch(e){}
let fails=[];
(async()=>{
  for(const slug of covers){
    const jpgPath=path.join(REPO,'vi/blog/images',slug,'og-1200x630-v2.jpg');
    if(!fs.existsSync(jpgPath)) continue;
    const stat=fs.statSync(jpgPath);
    if(stat.size < 20000){ fails.push(`${slug}: file too small ${stat.size} (<20KB) likely white/empty`); continue; }
    const {data, info}=await sharp(jpgPath).resize(100, 52).raw().toBuffer({resolveWithObject:true});
    // count near-white pixels (#fafafa ~ 250,250,250)
    let white=0, total=info.width*info.height;
    for(let i=0;i<data.length;i+=3){ if(data[i]>240 && data[i+1]>240 && data[i+2]>240) white++; }
    const pct=white/total;
    if(pct>0.85) fails.push(`${slug}: ${(pct*100).toFixed(1)}% white (>${85}%) — likely blank`);
    // check alt in HTML
    const htmlPath=path.join(REPO,'vi/blog',slug,'index.html');
    if(fs.existsSync(htmlPath)){
      const html=fs.readFileSync(htmlPath,'utf8');
      if(!html.includes('og-1200x630-v2.jpg')) fails.push(`${slug}: HTML missing cover figure`);
      if(html.includes('Cover 1200×630 — WebP 320w for mobile')) fails.push(`${slug}: meaningless figcaption still present`);
    }
  }
  if(fails.length){
    console.error('COVER-QA FAIL:');
    fails.forEach(f=>console.error(' -',f));
    process.exit(1);
  } else {
    console.log(`COVER-QA PASS: ${covers.length} covers checked, no white/blank, all HTML OK`);
  }
})();
