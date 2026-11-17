import { UX_SIGNALS } from '../../js/experience-config.js';
import { summarizeSiteJourneys } from './site-journeys.js';
import { summarizeToeicJourney } from './toeic-journey.js';
import { systemHealth } from './system-health.js';

const endpoint = '/.netlify/functions/experience';
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const download = document.querySelector('#export');
let operationalRows = [], operationsEnabled = false;
let rows = [], key = '', catalogue = {sets:[],hidden:[]}, visible = [];
const feedbackStatuses = {new:'Mới',working:'Đang xử lý',done:'Đã xử lý'};
const categories = {other:'Khác',toeic:'TOEIC',reader:'Reader',gemini:'Gemini',offline:'Offline',lookup:'Tra từ',chat:'Chat',review:'Ôn tập'};
const reasons = {quota:'Hạn mức / 429',timeout:'Hết thời gian chờ',network:'Kết nối',other:'Lỗi khác',unknown:'Bản cũ chưa phân loại'};
function add(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
let nextFieldId = 0;
function select(parent, label, choices) {
  const group = add(parent,'div','');
  group.className='report-field';
  const fieldLabel=add(group,'label',label);
  const field = add(group,'select','');
  field.id='report-field-'+(++nextFieldId);
  fieldLabel.htmlFor=field.id;
  if (Object.hasOwn(choices,'')) field.add(new Option(choices[''],''));
  for (const [value,text] of Object.entries(choices)) if (value) field.add(new Option(text,value));
  return field;
}
function button(parent,text,action) {
  const control = add(parent,'button',text);
  control.type = 'button';
  control.onclick = async () => {
    control.disabled = true;
    try { await action(); }
    catch (error) { status.textContent = error.message; }
    finally { control.disabled = false; }
  };
  return control;
}
async function api(query = '', method = 'GET', data) {
  const response = await fetch(endpoint+query,{
    method, cache:'no-store',
    headers:{Authorization:'Bearer '+key,...(data?{'Content-Type':'application/json'}:{})},
    body:data?JSON.stringify(data):undefined,
  });
  if (!response.ok) throw Error('Yêu cầu thất bại ('+response.status+').');
  return response.json();
}
function renderManagement(parent, matchesSet, onChange) {
  parent.replaceChildren();
  const panel = add(parent,'details','');
  panel.open=true;
  add(panel,'summary','Quản lý bộ TOEIC');
  const matching=catalogue.sets.filter(matchesSet);
  if (!matching.length) add(panel,'p','Không có bộ TOEIC phù hợp.');
  for (const set of matching) {
    const group=add(panel,'details','');
    add(group,'summary',set.title+' · '+set.questions.length+' câu');
    button(group,catalogue.hidden.includes(set.id)?'Hiện lại':'Ẩn khỏi danh sách', async () => {
      const hidden=!catalogue.hidden.includes(set.id);
      await api('','PATCH',{setId:set.id,hidden});
      catalogue.hidden=hidden?[...catalogue.hidden,set.id]:catalogue.hidden.filter(id=>id!==set.id);
      group.querySelector('button').textContent=hidden?'Hiện lại':'Ẩn khỏi danh sách';
      status.textContent='Đã cập nhật danh sách TOEIC.';
      onChange();
    });
    const preview=add(group,'a','Mở bộ trong app (khi đang hiện)');
    preview.href='/?toeic='+encodeURIComponent(set.id)+'#/practice';
    for (const q of set.questions) {
      const item=add(group,'section','');
      add(item,'h3',q.prompt);
      if(q.audio) {
        const audio=add(item,'audio','');
        audio.controls=true;
        audio.preload='none';
        audio.src=new URL(q.audio,location.origin+'/').href;
      }
      for(const [index,option] of (q.options || []).entries()) add(item,'p',(index===q.answer?'✓ ':'')+option);
      add(item,'p',q.explanationVi || q.explanation || '');
    }
  }
}
const fraction=(numerator,denominator)=>denominator
  ? `${numerator}/${denominator} (${Math.round(numerator*100/denominator)}%)`
  : `${numerator}/0`;

function renderToeicJourney(parent, openMatches, openFeedback) {
  const {total,bySet}=summarizeToeicJourney(rows,openMatches);
  const panel=add(parent,'section','');
  panel.className='journey-panel';
  add(panel,'h2','Hành trình TOEIC · đã đồng ý chia sẻ');
  if (total.answered) {
    add(panel,'p',`Ghi nhận ${total.answered} lượt trả lời câu đầu, ${total.explained} lượt thấy lời giải.`);
    const samples=total.durations.sort((a,b)=>a-b);
    if (samples.length) {
      const median=(samples[Math.floor((samples.length-1)/2)]+samples[Math.floor(samples.length/2)])/2;
      add(panel,'p',`Trung vị đến câu trả lời đầu tiên: ${(median/1000).toLocaleString('vi-VN',{maximumFractionDigits:2})} giây · ${samples.length} mẫu`);
    }
  }
  if (total.sources.has('seo_toeic_part5')) add(panel,'p',`Từ bài hướng dẫn Part 5–6: ${total.sources.get('seo_toeic_part5')} lượt.`);
  add(panel,'p',`Mở bộ: ${total.opened} · Hoàn thành: ${fraction(total.completed,total.opened)} · Lưu câu sai: ${fraction(total.saved,total.completed)}`);
  if (!total.opened) add(panel,'p','Không có lượt mở phù hợp với bộ lọc.');
  else if (!total.eligible) add(panel,'p','Chưa có lượt hoàn thành và lưu đủ 7 ngày quan sát.');
  else add(panel,'p',`Quay lại ôn trong 7 ngày: ${fraction(total.reviewed,total.eligible)} · Đủ thời gian quan sát: ${total.eligible}/${total.saved}`);
  add(panel,'p','Ngày và phiên bản được tính lúc mở bộ, theo giờ Việt Nam. Báo cáo đọc tối đa 90 ngày hành trình. Các lượt cũ thiếu mã bộ được gộp vào nhóm chưa xác định.');
  button(panel,'Xem góp ý về TOEIC',openFeedback);
  if (!bySet.size) return;
  const scroll=add(panel,'div','');
  scroll.className='journey-table-scroll';
  scroll.tabIndex=0;
  scroll.setAttribute('role','region');
  scroll.setAttribute('aria-label','Bảng hành trình theo bộ TOEIC');
  const table=add(scroll,'table','');
  add(table,'caption','Kết quả theo bộ TOEIC');
  const heading=add(add(table,'thead',''),'tr','');
  for (const label of ['Bộ','Mở','Hoàn thành / mở','Lưu / hoàn thành','Đủ 7 ngày','Ôn / đủ 7 ngày']) {
    add(heading,'th',label).scope='col';
  }
  const body=add(table,'tbody','');
  const groups=[...bySet].sort(([,a],[,b])=>b.opened-a.opened);
  for (const [id,counts] of groups) {
    const item=add(body,'tr','');
    add(item,'th',catalogue.sets.find(set=>set.id===id)?.title || 'Chưa xác định bộ').scope='row';
    for (const value of [counts.opened,fraction(counts.completed,counts.opened),fraction(counts.saved,counts.completed),
      counts.eligible,counts.eligible ? fraction(counts.reviewed,counts.eligible) : 'Chưa đủ dữ liệu']) add(item,'td',value);
  }
}

const journeyLabels = {
  lookup:['Tra từ','lookup',['download_needed','download_failed','result','miss','error']],
  reader:['Reader','reader',['reading','lookup_started','download_needed','download_failed','result','continued','miss','error']],
  chat:['Chat với Gemini','chat',['setup','sent','response','completed','error','stopped','retry','retry_success','followup','saved']],
  review:['Ôn tập','review',['empty','card','result','returned']],
  tutor:['AI Tutor','gemini',['setup','sent','response','error','stopped','followup','saved']],
  toeic_ai:['Giải thích TOEIC với Gemini','toeic',['setup','sent','response','completed','error','stopped','retry','retry_success','followup','saved']],
  lesson_studio:['Lesson Studio','gemini',['setup','sent','response','error','stopped','retry','retry_success','saved']],
};
const stageLabels = {
  download_needed:'Gặp bước tải từ điển', download_failed:'Tải gói từ điển thất bại', result:'Đạt kết quả đầu tiên', miss:'Không tìm thấy nghĩa',
  error:'Gặp lỗi', reading:'Hiện đoạn đọc', lookup_started:'Bấm tra từ', empty:'Chưa có thẻ đến hạn',
  continued:'Tra thêm từ sau kết quả đầu', returned:'Ôn tiếp vào ngày khác trong 7 ngày',
  card:'Thấy thẻ', setup:'Gặp bước nhập API key', sent:'Gửi yêu cầu', response:'Thấy phản hồi đầu tiên',
  completed:'Nhận phản hồi đầy đủ', stopped:'Dừng yêu cầu', retry:'Thử lại', retry_success:'Thử lại thành công',
  followup:'Hỏi hoặc luyện tiếp', saved:'Lưu kết quả',
};
const sourceLabels = {app:'Trong app',welcome:'Chào mừng',lookup_link:'Liên kết tra từ',reader_landing:'Trang giới thiệu Reader',
  reader:'Reader',dictionary:'Từ điển',toeic:'TOEIC',review:'Ôn tập',vault:'Sổ tay',history:'Hội thoại đã lưu',practice:'Luyện tập',lesson:'Bài học',writing:'Viết',speaking:'Nói',tutor:'AI Tutor'};
const journeyReasons={...reasons,setup:'API key hoặc cấu hình'};
const stepBase={download_failed:'download_needed',reading:'opened',lookup_started:'reading',sent:'opened',response:'sent',completed:'response',
  retry:'opened',retry_success:'retry',followup:'response',saved:'response',card:'opened',continued:'result',returned:'result'};

function renderSiteJourneys(parent, matchesPeriod, openFeedback) {
  const data=summarizeSiteJourneys(rows,matchesPeriod);
  for (const [id,[title,category,stages]] of Object.entries(journeyLabels)) {
    const panel=add(parent,'section','');
    add(panel,'h2',title);
    const counts=data.get(id);
    if (!counts) {
      add(panel,'p','Chưa có lượt đã đồng ý chia sẻ trong kỳ lọc.');
    } else {
      add(panel,'p',`Mở hoặc bắt đầu: ${counts.opened}`);
      const list=add(panel,'dl','');
      list.className='journey-steps';
      for (const step of stages) {
        const base=step==='result' ? ({review:'card',reader:'lookup_started'}[id] || 'opened') : stepBase[step];
        const denominator=base && base!=='opened' ? (counts.steps.get(base)||0) : counts.opened;
        const n=counts.steps.get(step)||0;
        // A restored chat can start with follow-up before a new response.
        const eligible=step!=='returned' && n<=denominator && denominator>0;
        add(list,'dt',stageLabels[step]);
        add(list,'dd',eligible ? fraction(n,denominator) : String(n));
      }
      const samples=counts.durations;
      if (samples.length) {
        const median=(samples[Math.floor((samples.length-1)/2)]+samples[Math.floor(samples.length/2)])/2;
        add(panel,'p',`Thời gian trung vị đến ${['lookup','reader','review'].includes(id) ? 'kết quả' : 'phản hồi đầu'}: ${(median/1000).toLocaleString('vi-VN',{maximumFractionDigits:2})} giây · ${samples.length} mẫu`);
      }
      add(panel,'p','Điểm vào · '+[...counts.sources].map(([source,n])=>`${sourceLabels[source] || 'Khác'} ${n}`).join(' · '));
      if (counts.reasons.size) add(panel,'p','Lỗi · '+[...counts.reasons].map(([reason,n])=>`${journeyReasons[reason]} ${n}`).join(' · '));
    }
    button(panel,`Xem góp ý về ${title}`,()=>openFeedback(category));
  }
}

function renderUxSignals(parent, visibleRows) {
  const panel=add(parent,'section','');
  add(panel,'h2','Lỗi hiển thị và trợ giúp');
  const counts = new Map();
  for (const row of visibleRows) {
    if (row.event==='ux_signal' && Object.hasOwn(UX_SIGNALS,row.signal)) {
      counts.set(row.signal,(counts.get(row.signal)||0)+1);
    }
  }
  if (!counts.size) add(panel,'p','Chưa ghi nhận tín hiệu trong kỳ lọc.');
  else {
    const list=add(panel,'dl','');
    list.className='journey-steps';
    for (const [signal,label] of Object.entries(UX_SIGNALS)) {
      add(list,'dt',label);
      add(list,'dd',String(counts.get(signal)||0));
    }
  }
  add(panel,'p','Chỉ tính khi người học đồng ý chia sẻ. Mỗi mã được ghi tối đa một lần trong một lần mở trang.');
}

function renderSystemHealth(parent) {
  const panel=add(parent,'section','');
  panel.className='system-health';
  add(panel,'h2','Sức khỏe hệ thống');
  add(panel,'p','Function experience · số liệu Netlify Observability');
  const date=new Intl.DateTimeFormat('vi-VN',{
    dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh',
  });
  const numbers=new Intl.NumberFormat('vi-VN');
  const counts=add(panel,'dl','');
  for (const [label,value] of [
    ['Yêu cầu',numbers.format(systemHealth.requests)],
    ['Lỗi 5xx',numbers.format(systemHealth.serverErrors)],
    ['Phản hồi 429',numbers.format(systemHealth.rateLimited)],
    ['Độ trễ p95',systemHealth.p95Ms === null ? 'Chưa có dữ liệu' : numbers.format(systemHealth.p95Ms)+' ms'],
  ]) {
    const pair=add(counts,'div','');
    add(pair,'dt',label);
    add(pair,'dd',value);
  }
  add(panel,'p',`Kỳ đo ${date.format(systemHealth.from)} – ${date.format(systemHealth.to)} (giờ Việt Nam).`);
  const stale=Date.now()-systemHealth.to>=86400000;
  add(panel,'p',stale ? 'Ảnh chụp đã quá 24 giờ. Xem Netlify để lấy số liệu mới.' : 'Ảnh chụp tại cuối kỳ đo. Netlify có số liệu mới hơn.');
  const link=add(panel,'a','Mở dự án trong Netlify');
  link.href='https://app.netlify.com/projects/dualdictionary';
  add(panel,'p','Trong Netlify, mở Analytics & metrics để xem Observability và Real User Monitoring.');
}

function render() {
  report.replaceChildren();
  const tabs=add(report,'div','');
  tabs.className='report-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Mục quản trị');
  const filters=add(report,'details','');
  filters.className='filters-panel';
  filters.open=true;
  add(filters,'summary','Lọc báo cáo theo ngày, phiên bản và bộ TOEIC');
  const fields=add(filters,'div','');
  fields.className='filters';
  const overview=add(report,'div','');
  const inbox=add(report,'div','');
  const sets=add(report,'div','');
  const operations=add(report,'div','');
  operations.className='metrics';
  const sections=[['Tổng quan',overview],['Góp ý',inbox],['Bộ TOEIC',sets],['Vận hành',operations]];
  const controls=sections.map(([name,panel],index)=>{
    const control=add(tabs,'button',name);
    control.type='button';
    control.onclick=()=>show(index);
    control.id='report-tab-'+index;
    panel.id='report-panel-'+index;
    control.setAttribute('role','tab');
    control.setAttribute('aria-controls',panel.id);
    panel.setAttribute('role','tabpanel');
    panel.setAttribute('aria-labelledby',control.id);
    panel.tabIndex=0;
    control.addEventListener('keydown',event=>{
      const target={
        ArrowRight:(index+1)%sections.length,
        ArrowLeft:(index+sections.length-1)%sections.length,
        Home:0,
        End:sections.length-1,
      }[event.key];
      if(typeof target!=='number') return;
      event.preventDefault();
      show(target);
      controls[target].focus();
    });
    return control;
  });
  function show(index) {
    sections.forEach(([,panel],i)=>{
      const selected=i===index;
      panel.hidden=!selected;
      controls[i].setAttribute('aria-selected',String(selected));
      controls[i].tabIndex=selected?0:-1;
    });
  }
  show(0);
  const versions=Object.fromEntries([...new Set([...rows,...operationalRows].map(row=>row.version))].sort().map(v=>[v,v]));
  const version=select(fields,'Phiên bản',{'':'Tất cả',...versions});
  const from=add(add(fields,'label','Từ ngày '),'input','');
  const to=add(add(fields,'label','Đến ngày '),'input','');
  from.type=to.type='date';
  const setFilter=select(fields,'Bộ TOEIC',{'':'Tất cả','unknown':'Chưa xác định',...Object.fromEntries(catalogue.sets.map(set=>[set.id,set.title]))});
  const partFilter=select(fields,'Part',{'':'Tất cả',...Object.fromEntries([3,4,5,6,7].map(part=>[part,`Part ${part}`]))});
  const stateFilter=select(fields,'Trạng thái bộ',{'':'Tất cả',shown:'Đang hiện',hidden:'Đã ẩn'});
  const matchesSet=set=> (!setFilter.value || set.id===setFilter.value) &&
    (!partFilter.value || String(set.part)===partFilter.value) &&
    (!stateFilter.value || catalogue.hidden.includes(set.id)===(stateFilter.value==='hidden'));
  const content=add(overview,'div','');
  content.className='metrics';
  const feedback=add(inbox,'section','');
  add(feedback,'h2','Hộp thư góp ý');
  const filter=select(feedback,'Trạng thái góp ý',{'':'Tất cả',...feedbackStatuses});
  const categoryFilter=select(feedback,'Chủ đề góp ý',{'':'Tất cả',...categories});
  const matchesFeedback=row=>row.event==='feedback' &&
    (!filter.value || (row.moderation?.status||'new')===filter.value) &&
    (!categoryFilter.value || (row.moderation?.category||row.category||'other')===categoryFilter.value);
  const entries=add(feedback,'div','');
  const paint=()=>{
    const matchesPeriod=row=>(!version.value || row.version===version.value) &&
      (!from.value || row.at>=new Date(from.value+'T00:00:00+07:00').getTime()) &&
      (!to.value || row.at<=new Date(to.value+'T23:59:59.999+07:00').getTime());
    visible=rows.filter(matchesPeriod);
    const openMatches=row=>{
      if (!matchesPeriod(row)) return false;
      const set=catalogue.sets.find(entry=>entry.id===row.setId);
      return set ? matchesSet(set)
        : !partFilter.value && !stateFilter.value && ['', 'unknown'].includes(setFilter.value);
    };
    content.replaceChildren();
    const openFeedback=category=>{
      categoryFilter.value=category;
      filter.value='';
      paint();
      show(1);
      controls[1].focus();
    };
    renderToeicJourney(content,openMatches,()=>openFeedback('toeic'));
    renderSiteJourneys(content,matchesPeriod,openFeedback);
    renderUxSignals(content,visible);
    operations.replaceChildren();
    renderSystemHealth(operations);
    const ops=add(operations,'section','');
    add(ops,'h2','Số liệu vận hành · tải audio');
    if (!operationsEnabled) add(ops,'p','Thu mặc định đang tắt.');
    const metrics=operationalRows.filter(row=>(!version.value || row.version===version.value) &&
      (!from.value || row.day>=from.value) && (!to.value || row.day<=to.value));
    const total=event=>metrics.filter(row=>row.event===event).reduce((sum,row)=>sum+row.count,0);
    if (metrics.length) add(ops,'p',`Bắt đầu: ${total('audio_start')} · Thành công: ${total('audio_ready')} · Lỗi: ${total('audio_error')}`);
    else add(ops,'p','Chưa có số liệu vận hành trong kỳ lọc.');
    if (!visible.length) add(content,'p','Chưa có sự kiện tự nguyện trong kỳ lọc.');
    const count=(event,subset=visible)=>subset.filter(row=>row.event===event).length;
    for (const tag of [...new Set(visible.map(row=>row.version))]) {
      const subset=visible.filter(row=>row.version===tag);
      const section=add(operations,'section','');
      add(section,'h2',tag);
      for(const [label,start,end] of [
        ['Audio hoàn tất / bắt đầu','audio_start','audio_ready'],
        ['Gemini hoàn tất / gửi','gemini_start','gemini_done'],
        ['Mở nhóm ôn / lưu câu sai','mistake_saved','mistake_reviewed'],
      ]){
        const total=count(start,subset), done=count(end,subset);
        add(section,'p',label+' · '+(total?done+'/'+total+' ('+Math.round(done*100/total)+'%)':'Chưa có lượt'));
      }
      add(section,'p','Các tỷ lệ dùng tổng lượt trong kỳ lọc, không ghép từng lần thao tác.');
      add(section,'p','Gemini chủ động dừng · '+count('gemini_stopped',subset));
      for(const [reason,label] of Object.entries(reasons)) {
        add(section,'p',label+' · '+subset.filter(r=>r.event==='gemini_error'&&(r.reason||'unknown')===reason).length);
      }
    }
    entries.replaceChildren();
    if (!visible.some(matchesFeedback)) add(entries,'p','Không có góp ý phù hợp.');
    for(const row of visible.filter(matchesFeedback).sort((a,b)=>b.at-a.at)){
      const box=add(entries,'section','');
      add(box,'p',row.note);
      const state=select(box,'Trạng thái',feedbackStatuses);
      const category=select(box,'Nhóm',categories);
      const note=add(add(box,'label','Ghi chú nội bộ '),'textarea','');
      note.maxLength=500;
      state.value=row.moderation?.status||'new';
      category.value=row.moderation?.category||row.category||'other';
      note.value=row.moderation?.note||'';
      button(box,'Lưu xử lý',async()=>{
        const moderation={status:state.value,category:category.value,note:note.value};
        await api('','PATCH',{id:row.id,...moderation});
        row.moderation=moderation;
        status.textContent='Đã lưu xử lý.';
        paint();
      });
      button(box,'Xóa góp ý',async()=>{
        if(!confirm('Xóa nội dung góp ý này?'))return;
        await api('','DELETE',{id:row.id});
        rows=rows.filter(item=>item.id!==row.id);
        paint();
      });
    }
    download.hidden=!visible.length;
    renderManagement(sets,matchesSet,paint);
  };
  for(const control of [version,from,to,filter,categoryFilter,setFilter,partFilter,stateFilter]) control.onchange=paint;
  paint();
}
document.querySelector('#access').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const field=form.querySelector('#key');
  const submit=form.querySelector('button');
  key=field.value;
  field.value='';
  submit.disabled=true;
  download.hidden=true;
  report.replaceChildren();
  status.textContent='Đang tải…';
  try {
    rows=[];
    let cursor;
    do {
      const data=await api(cursor?'?cursor='+encodeURIComponent(cursor):'');
      for(const record of data.records) for(const entry of record.entries) rows.push({...entry,id:record.id,moderation:record.moderation,session:record.session,version:record.version});
      cursor=data.cursor;
    } while(cursor);
    catalogue=await api('?sets');
    operationalRows=[];
    cursor=null;
    do {
      const data=await api('?operational-report'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
      operationalRows.push(...data.rows);
      operationsEnabled=data.enabled;
      cursor=data.cursor;
    } while(cursor);
    render();
    status.textContent=rows.length+' sự kiện';
  } catch(error){key='';status.textContent='Không tải được báo cáo. '+error.message;}
  finally{submit.disabled=false;}
};
download.onclick=()=>{
  const fields=['at','event','session','version','attemptId','setId','journey','step','source','signal','reason','duration','category','note'];
  const escape=value=>{
    const cell=String(value??'');
    return '"'+(/^[\s=+@-]/.test(cell)?"'"+cell:cell).replaceAll('"','""')+'"';
  };
  const csv=[fields.join(','),...visible.map(row=>fields.map(field=>escape(row[field])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='dual-dict-experience.csv';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
