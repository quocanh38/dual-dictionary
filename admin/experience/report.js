const endpoint = '/.netlify/functions/experience';
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const download = document.querySelector('#export');
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
function render() {
  report.replaceChildren();
  const tabs=add(report,'nav','');
  tabs.setAttribute('aria-label','Mục quản trị');
  const overview=add(report,'div','');
  const inbox=add(report,'div','');
  const sets=add(report,'div','');
  const sections=[['Tổng quan',overview],['Góp ý',inbox],['Bộ TOEIC',sets]];
  const controls=sections.map(([name],index)=>button(tabs,name,()=>show(index)));
  function show(index) {
    sections.forEach(([,panel],i)=>{panel.hidden=i!==index;controls[i].setAttribute('aria-pressed',String(i===index));});
  }
  show(0);
  const filters=add(report,'section','');
  report.insertBefore(filters,overview);
  filters.className='filters';
  const versions=Object.fromEntries([...new Set(rows.map(row=>row.version))].sort().map(v=>[v,v]));
  const version=select(filters,'Phiên bản',{'':'Tất cả',...versions});
  const from=add(add(filters,'label','Từ ngày '),'input','');
  const to=add(add(filters,'label','Đến ngày '),'input','');
  from.type=to.type='date';
  const content=add(overview,'div','');
  content.className='metrics';
  const feedback=add(inbox,'section','');
  add(feedback,'h2','Hộp thư góp ý');
  const filter=select(feedback,'Trạng thái',{'':'Tất cả',...feedbackStatuses});
  const entries=add(feedback,'div','');
  const paint=()=>{
    visible=rows.filter(row=>(!version.value || row.version===version.value) &&
      (!from.value || row.at>=new Date(from.value+'T00:00:00').getTime()) &&
      (!to.value || row.at<=new Date(to.value+'T23:59:59.999').getTime()));
    content.replaceChildren();
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
        add(section,'p',label+' · '+done+'/'+total+(total?' ('+Math.round(done*100/total)+'%)':''));
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
