'use strict';
const KEY='atif-ai-office-v1';
const DEFAULT_ENDPOINT='https://atif-ai-office.vercel.app/api/chat';
const agents=[
 {id:'khulood',name:'خلود',letter:'خ',role:'الموارد البشرية والامتثال',long:'عمليات الموظفين والعقود والإجراءات والسياسات',color:'#b9a7ff',hello:'أنا خلود، مختصة بالموارد البشرية والامتثال. أستطيع مساعدتك في التخطيط والمراجعة وإعداد الوثائق، وأحتاج إلى ربط خادم آمن لإنتاج ردود ذكاء اصطناعي حقيقية.'},
 {id:'diala',name:'ديالا',letter:'د',role:'المساعد التنفيذي',long:'البريد والمواعيد والمتابعة والتنظيم',color:'#7ee2c8',hello:'أنا ديالا، مختصة بالتنسيق التنفيذي والمراسلات. يمكننا تنظيم مهامك هنا، أما قراءة البريد أو جدولة الاجتماعات فتحتاج إلى اتصال مصرح به.'},
 {id:'joanna',name:'جوانا',letter:'ج',role:'البيانات وذكاء الأعمال',long:'مؤشرات الأداء والتقارير والتحليلات',color:'#f5c68e',hello:'أنا جوانا، مختصة بالتحليل والتقارير. بإمكانك تسجيل المهام هنا، ولتحليل البيانات فعليًا نحتاج إلى محرك AI وأدوات معالجة موصولة.'},
 {id:'anas',name:'أنس',letter:'أ',role:'البرمجة والأتمتة',long:'التطوير والاختبارات والربط التقني',color:'#81b7f3',hello:'أنا أنس، مختص بالبرمجة والأتمتة. يمكنني المساعدة في التطوير بعد ربط محرك AI، وأي نشر أو تعديل مؤثر يحتاج اعتمادك.'}
];
const $=(sel,base=document)=>base.querySelector(sel);
const $$=(sel,base=document)=>[...base.querySelectorAll(sel)];
const emptyState={tasks:[],chats:{khulood:[],diala:[],joanna:[],anas:[]},endpoint:DEFAULT_ENDPOINT,endpointCleared:false};
let db=load(), activeAgent='khulood', currentRoute='dashboard', deferredInstall=null;
let verifiedSession=false, pendingAction=null;
const runningTasks=new Set();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(!d||typeof d!=='object')return structuredClone(emptyState);return {tasks:Array.isArray(d.tasks)?d.tasks:[],chats:{...emptyState.chats,...(d.chats||{})},endpoint:(typeof d.endpoint==='string'&&d.endpoint.trim()?d.endpoint:(d.endpointCleared?'':DEFAULT_ENDPOINT)),endpointCleared:!!d.endpointCleared};}catch{return structuredClone(emptyState)}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch{toast('تعذر الحفظ المحلي. تحقق من مساحة الجهاز.');}}
function safe(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function agent(id){return agents.find(a=>a.id===id)||agents[0]}
function status(s){return ({pending:['جديدة','pending'],progress:['قيد العمل','progress'],review:['بانتظار الاعتماد','review'],done:['مكتملة','done']})[s]||['جديدة','pending']}
function time(t){return new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'short'}).format(new Date(t))}
function toast(t){let el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3300)}
function renderNav(){const count=db.tasks.filter(t=>t.status==='review').length;$('#nav-approval-count').textContent=count;$$('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===currentRoute));}
function route(view){currentRoute=view;$$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));$('#page-title').textContent=({dashboard:'نظرة عامة',chat:'غرفة المحادثات',tasks:'إدارة المهام',approvals:'الاعتمادات',settings:'الإعدادات'})[view]||view;render();if(view==='settings')diagnoseAI();window.scrollTo({top:0,behavior:'smooth'});}
function renderAgents(){const mini=$('#mini-agents');mini.innerHTML=agents.map(a=>'<button class="mini-agent" data-agent="'+a.id+'"><span class="mini-avatar" style="background:'+a.color+'25;color:'+a.color+'">'+a.letter+'</span><div><strong>'+a.name+'</strong><small>'+a.role+'</small></div></button>').join('');$('#agent-grid').innerHTML=agents.map(a=>'<article class="agent-card" style="--agent:'+a.color+'"><div class="agent-head"><span class="agent-avatar">'+a.letter+'</span><span class="agent-online">● جاهز للتكليف</span></div><h3>'+a.name+'</h3><p class="agent-role">'+a.long+'</p><div class="agent-foot"><small>وكيل متخصص</small><button class="text-btn" data-agent="'+a.id+'">فتح المحادثة ←</button></div></article>').join('');$('#chat-agents').innerHTML=agents.map(a=>'<button class="chat-agent" data-agent="'+a.id+'"><span class="mini-avatar" style="background:'+a.color+'25;color:'+a.color+'">'+a.letter+'</span><div><strong>'+a.name+'</strong><small>'+a.role+'</small></div></button>').join('');}
function renderStats(){const vals=[['إجمالي المهام',db.tasks.length,'▦'],['قيد المتابعة',db.tasks.filter(t=>t.status==='progress').length,'◷'],['تحتاج اعتمادك',db.tasks.filter(t=>t.status==='review').length,'◎'],['مكتملة',db.tasks.filter(t=>t.status==='done').length,'✓']];$('#stats').innerHTML=vals.map(v=>'<div class="stat"><i>'+v[2]+'</i><small>'+v[0]+'</small><b>'+v[1]+'</b></div>').join('');}
function taskRow(t,edit){
 const a=agent(t.agent),s=status(t.status);
 const note=t.note?' • '+safe(t.note.slice(0,80)):'';
 const result=t.result?'<details class="task-result"><summary>عرض مخرجات '+a.name+'</summary><div>'+safe(t.result)+'</div><small>هذه مسودة ذكاء اصطناعي للمراجعة، ولم تنفذ أي إجراءات خارجية.</small></details>':'';
 const error=t.error?'<div class="task-error">فشل تنفيذ النموذج: '+safe(t.error)+'</div>':'';
 const tools=edit?'<div class="task-controls">'+(t.status!=='done'?'<button class="btn btn-run" data-run-task="'+safe(t.id)+'" '+(runningTasks.has(t.id)?'disabled':'')+'>'+(runningTasks.has(t.id)?'جارٍ التنفيذ...':t.result?'إعادة المعالجة':'تشغيل الوكيل')+'</button>':'')+(t.status==='review'&&t.result?'<button class="btn btn-approve" data-approve-task="'+safe(t.id)+'">اعتماد المسودة</button>':'')+'<button class="trash" data-delete-task="'+safe(t.id)+'" aria-label="حذف">✕</button></div>':'';
 return '<article class="task-row task-row-extended"><span class="task-icon" style="color:'+a.color+'">'+a.letter+'</span><div class="task-summary"><strong>'+safe(t.title)+'</strong><small>'+a.name+' • '+safe(time(t.createdAt))+note+'</small></div><span class="status status-'+s[1]+'">'+s[0]+'</span>'+tools+(result||error?'<div class="task-details">'+error+result+'</div>':'')+'</article>';
}
function renderTasks(){let q=$('#task-search').value.trim().toLowerCase(),f=$('#task-filter').value,who=$('#agent-filter').value;let a=[...db.tasks].sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));$('#recent-tasks').innerHTML=a.length?a.slice(0,5).map(t=>taskRow(t,false)).join(''):empty('لا توجد مهام بعد','ابدأ بتكليف أحد أعضاء فريقك');let list=a.filter(t=>(f==='all'||t.status===f)&&(who==='all'||t.agent===who)&&(!q||(t.title+' '+t.note).toLowerCase().includes(q)));$('#tasks-list').innerHTML=list.length?list.map(t=>taskRow(t,true)).join(''):empty('لا توجد مهام مطابقة','أنشئ مهمة جديدة أو غيّر عوامل التصفية');let review=a.filter(t=>t.status==='review');$('#approvals-list').innerHTML=review.length?review.map(t=>taskRow(t,true)).join(''):empty('لا توجد اعتمادات معلقة','ستظهر هنا المهام التي تحوّلها إلى بانتظار الاعتماد');}
function empty(title,desc){return '<div class="empty"><b>◇</b><strong>'+title+'</strong><span>'+desc+'</span></div>'}
function renderChat(){const a=agent(activeAgent);$$('.chat-agent').forEach(el=>el.classList.toggle('active',el.dataset.agent===activeAgent));$('#chat-avatar').textContent=a.letter;$('#chat-avatar').style.background=a.color+'30';$('#chat-avatar').style.color=a.color;$('#chat-agent-name').textContent=a.name;$('#chat-agent-role').textContent=a.role;const hasCode=!!sessionStorage.getItem('atif-office-code');
$('#chat-connection-status').textContent=!db.endpoint?'الخادم غير مضبوط':!hasCode?'بانتظار رمز الدخول':verifiedSession?'متصل — GPT-OSS مجاني':'رمز محفوظ — تحقق من الدخول';
$('#connect-from-chat').hidden=hasCode&&verifiedSession;
$('#chat-auth-notice').textContent=hasCode&&verifiedSession?'تم تفعيل الوكلاء الأربعة. يمكنك إرسال الرسائل والمهام إلى نموذج GPT-OSS المجاني، دون صلاحيات للأنظمة الخارجية.':'للتحدث إلى خلود وديالا وجوانا وأنس أدخل رمز دخول المكتب مرة واحدة في هذه الجلسة.';let entries=db.chats[activeAgent]||[];let feed=$('#chat-messages');feed.innerHTML='<div class="bubble agent"><div class="message-label">'+a.name+'</div>'+safe(a.hello)+'</div>'+entries.map(m=>'<div class="bubble '+(m.role==='user'?'me':'agent')+'"><div class="message-label">'+(m.role==='user'?'أنت':a.name)+'</div>'+safe(m.text)+'</div>').join('');feed.scrollTop=feed.scrollHeight;}
function render(){renderNav();renderStats();renderTasks();renderChat();if(currentRoute==='settings'){$('#api-endpoint').value=db.endpoint;}}
function addTask(title,who,note){
 const t={id:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title,agent:who,note,status:'pending',createdAt:new Date().toISOString(),result:'',error:''};
 db.tasks.push(t);save();render();
 if(db.endpoint&&sessionStorage.getItem('atif-office-code'))runTask(t.id);
 else if(db.endpoint)showConnection({type:'task',id:t.id});
 else toast('المهمة محفوظة. فعّل الخادم من الإعدادات.');
 return t;
}
async function runTask(id){
 const t=db.tasks.find(x=>x.id===id);
 if(!t||runningTasks.has(id)||t.status==='done')return;
 if(!db.endpoint){toast('لم يتم ربط النموذج اللغوي. افتح الإعدادات.');route('settings');return;}
 const access=sessionStorage.getItem('atif-office-code')||'';
 if(!access){showConnection({type:'task',id});return;}
 runningTasks.add(id);t.status='progress';t.error='';save();render();
 try{
  const resp=await fetch(db.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+access},body:JSON.stringify({action:'execute_task',agent:t.agent,task:{id:t.id,title:t.title,note:t.note}})});
  let data={};try{data=await resp.json()}catch{}
  if(!resp.ok)throw Error(data.error||'HTTP '+resp.status);
  if(typeof data.reply!=='string'||!data.reply.trim())throw Error('استجابة فارغة من النموذج');
  t.result=data.reply.slice(0,30000);t.status='review';t.error='';t.completedAt=new Date().toISOString();runningTasks.delete(id);save();render();
  toast('أنجز النموذج مسودة المهمة، راجع النتيجة.');
 }catch(e){t.status='pending';t.error=String(e.message||'فشل الاتصال').slice(0,240);runningTasks.delete(id);save();render();toast('تعذر تشغيل المهمة، تحقق من الخطأ.');}
}
function chatAdd(a,role,text){if(!db.chats[a])db.chats[a]=[];db.chats[a].push({role,text,createdAt:new Date().toISOString()});db.chats[a]=db.chats[a].slice(-80);save();renderChat();}
function showConnection(nextAction=null){
 pendingAction=nextAction;
 $('#connect-error').textContent='';
 $('#connect-code').value='';
 $('#connect-backdrop').hidden=false;
 setTimeout(()=>$('#connect-code').focus(),40);
}
function hideConnection(){
 $('#connect-backdrop').hidden=true;
 $('#connect-code').value='';
 pendingAction=null;
}
async function verifyConnectionCode(code){
 const endpoint=db.endpoint||DEFAULT_ENDPOINT;
 const url=new URL('/api/auth',new URL(endpoint).origin);
 const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+code},body:'{}',cache:'no-store'});
 let data={};try{data=await response.json()}catch{}
 if(!response.ok)throw new Error(data.error||'تعذر التحقق من رمز الدخول ('+response.status+')');
 if(data.valid!==true)throw new Error('لم يؤكد الخادم صحة رمز الدخول');
 return true;
}
async function submitConnection(event){
 event.preventDefault();
 const code=$('#connect-code').value.trim();
 if(!code)return;
 const button=$('#verify-connect');
 button.disabled=true;button.textContent='جارٍ التحقق من رمز الدخول...';
 $('#connect-error').textContent='';
 try{
  await verifyConnectionCode(code);
  sessionStorage.setItem('atif-office-code',code);
  verifiedSession=true;
  const todo=pendingAction;
  hideConnection();
  renderChat();
  toast('تم الاتصال بنجاح. الوكلاء جاهزون للمحادثة.');
  if(todo?.type==='chat'){
    activeAgent=todo.agent;route('chat');await sendChat(todo.text);
  }else if(todo?.type==='task'){
    route('tasks');await runTask(todo.id);
  }
 }catch(error){
  $('#connect-error').textContent=error.message||'فشل التحقق من رمز الدخول';
 }finally{button.disabled=false;button.textContent='تحقق واتصل بالوكلاء'}
}

async function sendChat(text){
 const id=activeAgent;
 if(!db.endpoint){toast('عنوان الخادم غير مضبوط. افتح الإعدادات.');route('settings');return;}
 const access=sessionStorage.getItem('atif-office-code')||'';
 if(!access){showConnection({type:'chat',agent:id,text});return;}
 chatAdd(id,'user',text);
 const btn=$('#chat-form button');btn.disabled=true;
 try{
  const resp=await fetch(db.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+access},body:JSON.stringify({action:'chat',agent:id,message:text,messages:(db.chats[id]||[]).slice(-12).map(x=>({role:x.role==='user'?'user':'assistant',content:x.text}))})});
  let data={};try{data=await resp.json()}catch{}
  if(!resp.ok)throw Error(data.error||'HTTP '+resp.status);
  if(!data.reply||typeof data.reply!=='string')throw Error('استجابة فارغة');
  chatAdd(id,'assistant',data.reply);
 }catch(e){chatAdd(id,'assistant','تعذر التواصل مع النموذج: '+e.message)}
 finally{btn.disabled=false}
}
async function diagnoseAI(){
 const status=$('#diagnostic-status');
 const raw=$('#api-endpoint').value.trim()||db.endpoint;
 if(!raw){status.textContent='لم يتم إدخال عنوان الخادم بعد.';return}
 status.textContent='جارٍ فحص الخادم...';
 let u;try{u=new URL(raw);if(u.protocol!=='https:')throw Error('HTTPS required')}
 catch{status.textContent='عنوان الخادم غير صالح. استخدم HTTPS.';return}
 const check=new URL('/api/status',u.origin);
 try{
  const response=await fetch(check.href,{method:'GET',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'HTTP '+response.status);
  if(data.ready===true){
    status.textContent='خادم GPT-OSS المجاني جاهز للتجربة. '+(sessionStorage.getItem('atif-office-code')?'جرّب تشغيل المهمة الآن.':'أدخل رمز دخول التطبيق واضغط حفظ، ثم شغّل المهمة.');
  }else{
    const missing=Array.isArray(data.missing)?data.missing.join('، '):'إعدادات النموذج';
    status.textContent='الخادم متاح لكنه يحتاج إعدادًا: '+missing+'. لا يلزم مفتاح نموذج مدفوع.';
  }
 }catch(err){
  status.textContent='تعذر فحص الخادم ('+String(err.message).slice(0,120)+'). تحقق من العنوان والنشر واتصال الإنترنت.';
 }
}

function modal(open){$('#modal-backdrop').hidden=!open;if(open)setTimeout(()=>$('#task-title').focus(),40);else $('#task-form').reset()}
function downloadJSON(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),...db},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='atif-ai-office-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function wire(){
$('#connect-from-chat').addEventListener('click',()=>showConnection());
$('#close-connect').addEventListener('click',hideConnection);
$('#connect-backdrop').addEventListener('click',e=>{if(e.target.id==='connect-backdrop')hideConnection()});
$('#connect-form').addEventListener('submit',submitConnection);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#connect-backdrop').hidden)hideConnection()});
document.addEventListener('click',e=>{const go=e.target.closest('[data-route]');if(go){route(go.dataset.route);return}const ag=e.target.closest('[data-agent]');if(ag){activeAgent=ag.dataset.agent;route('chat');return}if(e.target.closest('[data-action="new-task"]')){modal(true);return}const run=e.target.closest('[data-run-task]');if(run){runTask(run.dataset.runTask);return}const approve=e.target.closest('[data-approve-task]');if(approve){const t=db.tasks.find(x=>x.id===approve.dataset.approveTask);if(t&&t.result&&t.status==='review'){t.status='done';save();render();toast('تم اعتماد المسودة محليًا دون تنفيذ خارجي.')}return}const del=e.target.closest('[data-delete-task]');if(del){const task=db.tasks.find(t=>t.id===del.dataset.deleteTask);if(task&&confirm('حذف المهمة: '+task.title+'؟')){db.tasks=db.tasks.filter(t=>t.id!==task.id);save();render()}return}});
$('#close-modal').addEventListener('click',()=>modal(false));$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')modal(false)});$('#task-form').addEventListener('submit',e=>{e.preventDefault();addTask($('#task-title').value.trim(),$('#task-agent').value,$('#task-note').value.trim());modal(false);route('tasks')});document.addEventListener('change',e=>{const sel=e.target.closest('[data-task-status]');if(sel){const t=db.tasks.find(t=>t.id===sel.dataset.taskStatus);if(t){t.status=sel.value;save();render();toast('تم تحديث حالة المهمة محليًا')}}});['task-search','task-filter','agent-filter'].forEach(id=>$('#'+id).addEventListener(id==='task-search'?'input':'change',renderTasks));$('#chat-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('#chat-input'),v=input.value.trim();if(!v)return;input.value='';await sendChat(v)});$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-form').requestSubmit()}});$('#save-api').addEventListener('click',()=>{const url=$('#api-endpoint').value.trim();let parsed;try{parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('https required');}catch{toast('أدخل عنوان HTTPS صحيحًا للخادم');return}if(parsed.href!==db.endpoint){verifiedSession=false;sessionStorage.removeItem('atif-office-code');}db.endpoint=parsed.href;db.endpointCleared=false;const code=$('#access-code').value.trim();if(code){sessionStorage.setItem('atif-office-code',code);verifiedSession=false;$('#access-code').value='';}save();renderChat();toast(sessionStorage.getItem('atif-office-code')?'تم حفظ العنوان والرمز للجلسة. يجري فحص الخادم.':'حُفظ العنوان؛ لا يزال رمز الوصول مطلوبًا.');diagnoseAI()});$('#clear-api').addEventListener('click',()=>{db.endpoint='';db.endpointCleared=true;verifiedSession=false;sessionStorage.removeItem('atif-office-code');$('#api-endpoint').value='';$('#access-code').value='';$('#diagnostic-status').textContent='الاتصال مفصول يدويًا.';save();renderChat();toast('تم فصل الاتصال')});$('#export-data').addEventListener('click',downloadJSON);$('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('الملف كبير جدًا');const d=JSON.parse(await file.text());if(!Array.isArray(d.tasks)||typeof d.chats!=='object'||d.chats===null||!agents.every(a=>Array.isArray(d.chats[a.id])))throw new Error('صيغة النسخة الاحتياطية غير صحيحة');db={tasks:d.tasks.filter(t=>typeof t.title==='string'&&typeof t.id==='string'&&typeof t.agent==='string').slice(0,1000),chats:Object.fromEntries(agents.map(a=>[a.id,d.chats[a.id].filter(m=>typeof m.text==='string'&&['user','assistant'].includes(m.role)).slice(-80)])),endpoint:typeof d.endpoint==='string'?d.endpoint:''};save();render();toast('تم استيراد النسخة الاحتياطية')}catch(ex){toast('تعذر الاستيراد: '+ex.message)}e.target.value=''});$('#erase-data').addEventListener('click',()=>{if(confirm('هل تريد حذف جميع مهامك ومحادثاتك من هذا الجهاز؟')){localStorage.removeItem(KEY);sessionStorage.removeItem('atif-office-code');db=structuredClone(emptyState);render();toast('تم مسح البيانات المحلية')}});$('#check-api').addEventListener('click',diagnoseAI);$('#manual-install').addEventListener('click',()=>alert('على أندرويد: افتح رابط الموقع المنشور في Google Chrome، ثم القائمة ⋮، ثم اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية. يجب أن يكون الموقع منشورًا عبر HTTPS.'));window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#install-btn').hidden=false});$('#install-btn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#install-btn').hidden=true;});window.addEventListener('appinstalled',()=>{$('#install-btn').hidden=true;toast('تم تثبيت التطبيق')});}
function init(){$('#today-label').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date());renderAgents();wire();render();
const existing=sessionStorage.getItem('atif-office-code');
if(existing&&db.endpoint){verifyConnectionCode(existing).then(()=>{verifiedSession=true;renderChat()}).catch(()=>{sessionStorage.removeItem('atif-office-code');verifiedSession=false;renderChat()})}
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
init();