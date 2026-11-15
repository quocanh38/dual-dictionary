const endpoint = '/.netlify/functions/experience';
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const download = document.querySelector('#export');
let operationalRows = [], operationsEnabled = false;
let rows = [], key = '', catalogue = {sets:[],hidden:[]}, visible = [];
const feedbackStatuses = {new:'Mới',working:'Đang xử lý',done:'Đã xử lý'};
const categories = {other:'Khác',toeic:'TOEIC',reader:'Reader',gemini:'Gemini',offline:'Offline'};
const reasons = {quota:'Hạn mức / 429',timeout:'Hết thời gian chờ',network:'Kết nối',other:'Lỗi khác',unknown:'Bản cũ chưa phân loại'};
function add(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
function select(parent, label, choices) {
  const field = add(add(parent,'label',label+' '),'select','');
  for (const [value,text] of Object.entries(choices)) field.add(new Option(text,value));
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
function renderManagement(parent) {
  const panel = add(parent,'details','');
  panel.open=true;
  add(panel,'summary','Quản lý bộ TOEIC');
  for (const set of catalogue.sets) {
    const group=add(panel,'details','');
    add(group,'summary',set.title+' · '+set.questions.length+' câu');
    button(group,catalogue.hidden.includes(set.id)?'Hiện lại':'Ẩn khỏi danh sách', async () => {
      const hidden=!catalogue.hidden.includes(set.id);
      await api('','PATCH',{setId:set.id,hidden});
      catalogue.hidden=hidden?[...catalogue.hidden,set.id]:catalogue.hidden.filter(id=>id!==set.id);
      group.querySelector('button').textContent=hidden?'Hiện lại':'Ẩn khỏi danh sách';
      status.textContent='Đã cập nhật danh sách TOEIC.';
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
function renderToeicJourney(parent, openedRows) {
  const attempts = new Map();
  const week = 7 * 86400000;
  const now = Date.now();
  for (const row of rows) {
    if (!row.attemptId) continue;
    if (!attempts.has(row.attemptId)) attempts.set(row.attemptId, []);
    attempts.get(row.attemptId).push(row);
  }
  const opened = new Set(openedRows.filter(row=>row.event==='toeic_opened' && row.attemptId).map(row=>row.attemptId));
  let completed = 0, saved = 0, eligible = 0, reviewed = 0;
  for (const id of opened) {
    const events = attempts.get(id).sort((a,b)=>a.at-b.at);
    const start = events.find(row=>row.event==='toeic_opened');
    const finish = events.find(row=>row.event==='toeic_completed' && row.at>=start.at);
    if (!finish) continue;
    completed++;
    const save = events.find(row=>row.event==='toeic_saved' && row.at>=start.at);
    if (!save) continue;
    saved++;
    const after = Math.max(save.at,finish.at);
    if (after+week>now) continue;
    eligible++;
    if (events.some(row=>row.event==='toeic_reviewed' && row.at>=after && row.at<=after+week && row.session!==save.session)) reviewed++;
  }
  const panel=add(parent,'section','');
  add(panel,'h2','Hành trình TOEIC · đã đồng ý chia sẻ');
  add(panel,'p',`Mở bộ: ${opened.size} · Hoàn thành: ${completed} · Hoàn thành và lưu câu sai: ${saved}`);
  add(panel,'p',eligible ? `Quay lại ôn trong 7 ngày: ${reviewed}/${eligible} (${Math.round(reviewed*100/eligible)}%)` : 'Chưa có lượt đủ 7 ngày để tính tỷ lệ quay lại.');
  add(panel,'p','Bộ lọc áp dụng theo ngày và phiên bản lúc mở đề. Mỗi mã lượt được đếm một lần. Chỉ tính lượt ôn ở phiên khác sau khi hoàn thành và lưu.');
}

function render() {
  report.replaceChildren();
  const tabs=add(report,'div','');
  tabs.className='report-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Mục quản trị');
  const filters=add(report,'details','');
  filters.className='filters-panel';
  add(filters,'summary','Lọc theo ngày (giờ Việt Nam) và phiên bản');
  const fields=add(filters,'div','');
  fields.className='filters';
  const overview=add(report,'div','');
  const inbox=add(report,'div','');
  const sets=add(report,'div','');
  const sections=[['Tổng quan',overview],['Góp ý',inbox],['Bộ TOEIC',sets]];
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
  const content=add(overview,'div','');
  content.className='metrics';
  const feedback=add(inbox,'section','');
  add(feedback,'h2','Hộp thư góp ý');
  const filter=select(feedback,'Trạng thái',{'':'Tất cả',...feedbackStatuses});
  const entries=add(feedback,'div','');
  const paint=()=>{
    visible=rows.filter(row=>(!version.value || row.version===version.value) &&
      (!from.value || row.at>=new Date(from.value+'T00:00:00+07:00').getTime()) &&
      (!to.value || row.at<=new Date(to.value+'T23:59:59.999+07:00').getTime()));
    content.replaceChildren();
    renderToeicJourney(content,visible);
    const ops=add(content,'section','');
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
      const section=add(content,'section','');
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
    if (!visible.some(r=>r.event==='feedback'&&(!filter.value||(r.moderation?.status||'new')===filter.value))) add(entries,'p','Không có góp ý phù hợp.');
    for(const row of visible.filter(r=>r.event==='feedback'&&(!filter.value||(r.moderation?.status||'new')===filter.value)).sort((a,b)=>b.at-a.at)){
      const box=add(entries,'section','');
      add(box,'p',row.note);
      const state=select(box,'Trạng thái',feedbackStatuses);
      const category=select(box,'Nhóm',categories);
      const note=add(add(box,'label','Ghi chú nội bộ '),'textarea','');
      note.maxLength=500;
      state.value=row.moderation?.status||'new';
      category.value=row.moderation?.category||'other';
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
  };
  for(const control of [version,from,to,filter]) control.onchange=paint;
  paint();
  renderManagement(sets);
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
  } catch(error){key='';status.textContent=error.message;}
  finally{submit.disabled=false;}
};
download.onclick=()=>{
  const fields=['at','event','session','version','reason','duration','note'];
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
