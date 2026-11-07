
var WORDS=[];
fetch('/vi/tu/sitemap/words-001.xml').catch(function(){});
(function(){
 var w=document.getElementById('sh-word'),ip=document.getElementById('sh-ipa'),
     au=document.getElementById('sh-aud'),msg=document.getElementById('sh-msg'),
     mine=document.getElementById('sh-mine'),mr=null,chunks=[];
 var list=['abandon','ability','benefit','deadline','opportunity','efficient','develop','sustain','evidence','journey','challenge','improve','achieve','decide','depend','experience','knowledge','language','method','result'];
 function pick(){var x=list[Math.floor(Math.random()*list.length)];w.textContent=x;ip.innerHTML='<a href="/vi/tu/'+x+'/">Tra “'+x+'” →</a> · <a href="/vi/phat-am/'+x+'/">Phát âm →</a>';au.src='/audio/us/'+x+'.m4a';au.load();msg.textContent='';mine.style.display='none';}
 document.getElementById('sh-next').addEventListener('click',pick);
 document.getElementById('sh-play').addEventListener('click',function(){au.play();});
 var rec=document.getElementById('sh-rec');
 rec.addEventListener('click',function(){
  if(mr&&mr.state==='recording'){mr.stop();rec.classList.remove('rec');rec.textContent='🎙️ Ghi âm giọng mình';return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){msg.textContent='Trình duyệt không hỗ trợ ghi âm — hãy luyện đọc đuổi theo mẫu.';return;}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){
   mr=new MediaRecorder(s);chunks=[];
   mr.ondataavailable=function(e){chunks.push(e.data);};
   mr.onstop=function(){var b=new Blob(chunks,{type:'audio/webm'});mine.src=URL.createObjectURL(b);mine.style.display='block';msg.textContent='Nghe lại giọng mình, so với mẫu ở trên.';};
   mr.start();rec.classList.add('rec');rec.textContent='⏹️ Dừng ghi âm';msg.textContent='Đang ghi — đọc đuổi theo từ mẫu…';
  }).catch(function(){msg.textContent='Không truy cập được micro — hãy luyện đọc đuổi theo mẫu.';});
 });
 pick();
})();
