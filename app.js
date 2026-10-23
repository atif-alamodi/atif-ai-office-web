'use strict';
const KEY='atif-ai-office-v1';
const DEFAULT_ENDPOINT='https://atif-ai-office.vercel.app/api/chat';
const agents=[
 {id:'khulood',name:'خلود',letter:'خ',role:'الموارد البشرية والامتثال',long:'عمليات الموظفين والعقود والإجراءات والسياسات',color:'#b9a7ff',hello:'أنا خلود، مسؤولة أعمال الموارد البشرية. أستطيع إعداد عقد عمل فعلي قابل للتنزيل بصيغة Word، وتجهيز الخطابات والمخالصات والمسودات للمراجعة. كلفني بالمطلوب مباشرة.'},
 {id:'diala',name:'ديالا',letter:'د',role:'المساعد التنفيذي',long:'البريد والمواعيد والمتابعة والتنظيم',color:'#7ee2c8',hello:'أنا ديالا. أكتب المراسلات والخطابات ومحاضر الاجتماعات والتقارير الجاهزة للاستخدام، ويمكنك تنزيل أعمالي كملفات Word. الإرسال الخارجي يتطلب تفويض ربط مستقل.'},
 {id:'joanna',name:'جوانا',letter:'ج',role:'البيانات وذكاء الأعمال',long:'مؤشرات الأداء والتقارير والتحليلات',color:'#f5c68e',hello:'أنا جوانا، مختصة بتحليل البيانات والأرقام. أعطني البيانات أو النتائج وسأجهز تحليلًا وجداول وتوصيات وتقريرًا قابلًا للتنزيل.'},
 {id:'anas',name:'أنس',letter:'أ',role:'البرمجة والأتمتة',long:'التطوير والاختبارات والربط التقني',color:'#81b7f3',hello:'أنا أنس، مختص بالبرمجة والتطوير. أكتب الأكواد كاملة مع طريقة التشغيل والاختبارات، ويمكنني تجهيز وثائق تقنية قابلة للتنزيل.'}
];
const $=(sel,base=document)=>base.querySelector(sel);
const $$=(sel,base=document)=>[...base.querySelectorAll(sel)];
const emptyState={tasks:[],chats:{khulood:[],diala:[],joanna:[],anas:[]},documents:[],workflowRuns:[],endpoint:DEFAULT_ENDPOINT,endpointCleared:false};
let db=load(), activeAgent='khulood', currentRoute='dashboard', deferredInstall=null;
let verifiedSession=false, pendingAction=null;
const runningTasks=new Set();
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(!d||typeof d!=='object')return structuredClone(emptyState);return {tasks:Array.isArray(d.tasks)?d.tasks:[],chats:{...emptyState.chats,...(d.chats||{})},documents:Array.isArray(d.documents)?d.documents.filter(x=>x&&typeof x.content==='string'&&typeof x.id==='string').slice(-60):[],workflowRuns:Array.isArray(d.workflowRuns)?d.workflowRuns.slice(-15):[],endpoint:(typeof d.endpoint==='string'&&d.endpoint.trim()?d.endpoint:(d.endpointCleared?'':DEFAULT_ENDPOINT)),endpointCleared:!!d.endpointCleared};}catch{return structuredClone(emptyState)}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch{toast('تعذر الحفظ المحلي. تحقق من مساحة الجهاز.');}}
function safe(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function agent(id){return agents.find(a=>a.id===id)||agents[0]}
function status(s){return ({pending:['جديدة','pending'],progress:['قيد العمل','progress'],review:['بانتظار الاعتماد','review'],done:['مكتملة','done']})[s]||['جديدة','pending']}
function time(t){return new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'short'}).format(new Date(t))}
function toast(t){let el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3300)}
const catalog=()=>window.AtifSkillCatalog||{skills:[],workflows:[],integrations:[]};
let localReport=null;
let teamAbort=null;
let teamRunning=false;
const skillModeLabel={local:'يعمل هنا',ai:'بالنموذج المجاني',integration:'بانتظار ربط'};
function renderSkills(){
 const data=catalog(),list=$('#skill-cards');if(!list)return;
 const agentFilter=$('#skill-agent').value||'all',mode=$('#skill-mode').value||'all',q=$('#skill-search').value.trim().toLowerCase();
 const all=data.skills;
 const active=all.filter(s=>s.mode!=='integration');
 $('#skills-overview').innerHTML='<div class="stat"><small>إجمالي المهارات</small><b>'+all.length+'</b></div><div class="stat"><small>مهارات جاهزة للتجربة</small><b>'+active.length+'</b></div><div class="stat"><small>أدوات محلية</small><b>'+all.filter(s=>s.mode==='local').length+'</b></div><div class="stat"><small>تكاملات تحتاج تفويضًا</small><b>'+all.filter(s=>s.mode==='integration').length+'</b></div>';
 const shown=all.filter(s=>(agentFilter==='all'||s.agent===agentFilter)&&(mode==='all'||s.mode===mode)&&(!q||(s.title+' '+s.category+' '+s.prompt).toLowerCase().includes(q)));
 list.innerHTML=shown.length?shown.map(s=>'<article class="skill-card"><div class="skill-title"><strong>'+safe(s.title)+'</strong><small>'+safe(agent(s.agent).name)+' • '+safe(s.category)+'</small></div><span class="skill-state mode-'+s.mode+'">'+skillModeLabel[s.mode]+'</span><p>'+safe(s.prompt)+'</p><button data-skill-id="'+safe(s.id)+'" class="btn '+(s.mode==='integration'?'btn-ghost':'btn-primary')+'">'+(s.mode==='integration'?'تفاصيل الربط':s.mode==='local'?'فتح الأداة':'استخدام المهارة')+'</button></article>').join(''):empty('لا توجد مهارات مطابقة','جرّب تغيير البحث أو المرشحات');
 const integrations=$('#integrations-list');
 integrations.innerHTML=data.integrations.map(i=>'<div class="integration-row"><div><strong>'+safe(i.name)+'</strong><small>'+safe(i.tools)+' • '+safe(i.scope)+'</small></div><span class="skill-state mode-integration">لم يُربط بهذا التطبيق</span></div>').join('');
}
function initSkills(){
 const templates=catalog().workflows;
 $('#workflow-template').innerHTML=templates.map(w=>'<option value="'+safe(w.id)+'">'+safe(w.title)+' ('+w.steps.length+' وكلاء)</option>').join('');
 ['skill-search','skill-agent','skill-mode'].forEach(id=>$('#'+id).addEventListener(id==='skill-search'?'input':'change',renderSkills));
 $('#run-csv').addEventListener('click',readAndAnalyzeCSV);
 $('#eos-form').addEventListener('submit',runEosTool);
 $('#github-check-form').addEventListener('submit',runGithubTool);
 $('#workflow-run').addEventListener('click',runTeamWorkflow);
 $('#workflow-stop').addEventListener('click',()=>{if(teamAbort)teamAbort.abort();});
}
function toolDocument(title,body,agentId){
 const doc=addWorkspaceDocument(title,body,agentId);
 toast('تم إنشاء التقرير محليًا. يمكنك تنزيله من مستنداتي.');
 return doc;
}
async function readAndAnalyzeCSV(){
 const output=$('#csv-output'),file=$('#csv-file').files[0];
 if(!file){output.textContent='اختر ملف CSV أولاً.';return}
 if(file.size>2_000_000){output.textContent='الحد الأقصى 2MB. استخدم ملفًا أقل حجمًا.';return}
 output.textContent='جارٍ التحليل المحلي...';
 try{
  const textValue=await file.text();
  const stats=window.AtifOfficeTools.analyzeCSV(textValue);
  localReport=stats;
  const doc=toolDocument('تحليل بيانات - '+file.name,stats.report,'joanna');
  output.textContent=stats.report+'\n\n✓ التقرير موجود في مستنداتي.';
  const btn=document.createElement('button');
  btn.className='btn btn-ghost';btn.textContent='تنزيل جدول النتائج CSV';
  btn.onclick=()=>{
   const data=window.AtifOfficeTools.downloadCSV(stats),blob=new Blob([data],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='تحليل_'+file.name.replace(/\.[^.]*$/,'')+'.csv';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  output.appendChild(btn);
  renderDocuments();
 }catch(e){output.textContent='تعذر التحليل: '+String(e.message||e)}
}
function runEosTool(e){
 e.preventDefault();
 const out=$('#eos-output');
 try{
  const calc=window.AtifOfficeTools.eos({wage:$('#eos-wage').value,years:$('#eos-years').value,months:$('#eos-months').value,days:$('#eos-days').value,reason:$('#eos-reason').value});
  const doc=toolDocument('تقدير مكافأة نهاية الخدمة',calc.report,'khulood');
  out.textContent=calc.report+'\n\nالمستند محفوظ للتنزيل.';
  renderDocuments();
 }catch(err){out.textContent='خطأ في الإدخال: '+String(err.message||err)}
}
async function runGithubTool(e){
 e.preventDefault();
 const out=$('#github-output');out.textContent='جارٍ قراءة GitHub العام...';
 try{
  const result=await window.AtifOfficeTools.githubPublicRepo($('#github-repo').value);
  toolDocument('فحص GitHub - '+result.name,result.report,'anas');
  out.textContent=result.report;
  renderDocuments();
 }catch(err){out.textContent='تعذر الفحص: '+String(err.message||err)}
}
function useSkill(id){
 const skill=catalog().skills.find(s=>s.id===id);if(!skill)return;
 if(skill.mode==='integration'){
  const matches=catalog().integrations.filter(i=>i.owners.includes(skill.agent));
  alert(skill.title+'\n\nهذه العملية تتطلب تكاملًا رسميًا مفوضًا. لا توجد صلاحية مُفعّلة لهذا التطبيق الآن.\nالأنظمة ذات الصلة: '+matches.map(x=>x.name).join('، ')+'\nيمكن إعداد المسودة أو خطة العمل بالوكيل دون ادعاء إتمام العملية الخارجية.');
  return;
 }
 if(skill.mode==='local'){
  if(skill.tool==='contract'){activeAgent='khulood';route('chat');$('#chat-input').value='أعدّي عقد عمل سعودي باسم [اسم الموظف] مع البنود الكاملة وخانات الاستكمال';$('#chat-input').focus();return}
  const field=skill.tool==='csv'?'#csv-file':skill.tool==='github'?'#github-repo':'#eos-wage';
  const node=$(field);if(node){node.scrollIntoView({behavior:'smooth',block:'center'});node.focus();}return;
 }
 activeAgent=skill.agent;route('chat');$('#chat-input').value=skill.prompt+'\n\n[أضف هنا بيانات المهمة أو السياق المتاح]';$('#chat-input').focus();
}
function renderWorkflowResults(){
 const el=$('#workflow-results');if(!el)return;
 const runs=(db.workflowRuns||[]).slice().reverse().slice(0,5);
 el.innerHTML=runs.length?runs.map(run=>{
  const steps=run.results||[];
  return '<div class="workflow-run"><strong>'+safe(run.title)+' — '+safe(run.status)+'</strong><small>'+safe(run.request||'')+'</small>'+steps.map((step,i)=>'<div class="workflow-step"><b>'+safe(agent(step.agent).name)+'</b><span>'+safe(step.status||'قيد الانتظار')+'</span>'+(step.content?'<details><summary>عرض النتائج</summary><pre>'+safe(step.content)+'</pre></details>':'')+'</div>').join('')+'<div class="setting-actions">'+(run.docId?'<button class="btn btn-ghost" data-doc-download="'+safe(run.docId)+'">تنزيل تقرير الفريق Word</button>':'')+'</div></div>';
 }).join(''):'<p class="subtext">لم يبدأ الفريق أي سير عمل بعد.</p>';
}
async function runTeamWorkflow(){
 if(teamRunning)return;
 const w=catalog().workflows.find(x=>x.id===$('#workflow-template').value);
 const input=$('#workflow-request').value.trim();
 if(!w||!input){toast('اختر مسار عمل واكتب المطلوب بدقة.');return}
 const access=sessionStorage.getItem('atif-office-code')||'';
 if(!access){showConnection({type:'workflow'});toast('أدخل رمز الدخول أولاً، ثم شغّل سير العمل.');return}
 teamRunning=true;teamAbort=new AbortController();
 $('#workflow-run').disabled=true;$('#workflow-stop').disabled=false;
 const item={id:'wf-'+Date.now(),title:w.title,request:input,status:'قيد التنفيذ',startedAt:new Date().toISOString(),results:[]};
 db.workflowRuns.push(item);db.workflowRuns=db.workflowRuns.slice(-15);save();renderWorkflowResults();
 let previous='';
 try{
  for(const step of w.steps){
   if(teamAbort.signal.aborted)throw new Error('أوقفت التنفيذ');
   const row={agent:step.agent,status:'قيد المعالجة',content:''};item.results.push(row);save();renderWorkflowResults();
   const prompt='العمل المطلوب من فريق متعدد التخصصات: '+input+'\nتكليفك الحالي: '+step.instruction+'\nمخرجات الخطوة السابقة: '+previous.slice(0,1700)+'\nاعطِ نتيجة عملية وقابلة للمراجعة ولا تدّع الوصول إلى أنظمة خارجية.';
   const resp=await fetch(db.endpoint,{method:'POST',signal:teamAbort.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+access},body:JSON.stringify({agent:step.agent,action:'chat',message:prompt})});
   let value={};try{value=await resp.json()}catch{}
   if(!resp.ok||typeof value.reply!=='string')throw new Error(value.error||'فشلت خطوة '+agent(step.agent).name);
   row.status='مكتملة';row.content=value.reply;previous=value.reply;save();renderWorkflowResults();
  }
  const content='تقرير عمل الفريق — '+w.title+'\nالمطلوب: '+input+'\n\n'+item.results.map((r,i)=>'الخطوة '+(i+1)+' — '+agent(r.agent).name+'\n'+r.content).join('\n\n');
  const doc=toolDocument('تقرير الفريق — '+w.title,content,'diala');item.docId=doc.id;item.status='مكتملة، بانتظار مراجعتك';
 }catch(error){item.status=teamAbort.signal.aborted?'أُوقف':'تعذر الإكمال';item.error=String(error.message||error);toast(item.error)}
 finally{teamRunning=false;teamAbort=null;$('#workflow-run').disabled=false;$('#workflow-stop').disabled=true;save();renderWorkflowResults();renderDocuments()}
}

function renderNav(){const count=db.tasks.filter(t=>t.status==='review').length;$('#nav-approval-count').textContent=count;$$('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===currentRoute));}
function route(view){currentRoute=view;$$('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));$('#page-title').textContent=({dashboard:'نظرة عامة',chat:'غرفة المحادثات',tasks:'إدارة المهام',skills:'المهارات والأدوات',documents:'المستندات',approvals:'الاعتمادات',settings:'الإعدادات'})[view]||view;render();if(view==='settings')diagnoseAI();window.scrollTo({top:0,behavior:'smooth'});}
function renderAgents(){const mini=$('#mini-agents');mini.innerHTML=agents.map(a=>'<button class="mini-agent" data-agent="'+a.id+'"><span class="mini-avatar" style="background:'+a.color+'25;color:'+a.color+'">'+a.letter+'</span><div><strong>'+a.name+'</strong><small>'+a.role+'</small></div></button>').join('');$('#agent-grid').innerHTML=agents.map(a=>'<article class="agent-card" style="--agent:'+a.color+'"><div class="agent-head"><span class="agent-avatar">'+a.letter+'</span><span class="agent-online">● جاهز للتكليف</span></div><h3>'+a.name+'</h3><p class="agent-role">'+a.long+'</p><div class="agent-foot"><small>وكيل متخصص</small><button class="text-btn" data-agent="'+a.id+'">فتح المحادثة ←</button></div></article>').join('');$('#chat-agents').innerHTML=agents.map(a=>'<button class="chat-agent" data-agent="'+a.id+'"><span class="mini-avatar" style="background:'+a.color+'25;color:'+a.color+'">'+a.letter+'</span><div><strong>'+a.name+'</strong><small>'+a.role+'</small></div></button>').join('');}
function renderStats(){const vals=[['إجمالي المهام',db.tasks.length,'▦'],['قيد المتابعة',db.tasks.filter(t=>t.status==='progress').length,'◷'],['تحتاج اعتمادك',db.tasks.filter(t=>t.status==='review').length,'◎'],['مكتملة',db.tasks.filter(t=>t.status==='done').length,'✓']];$('#stats').innerHTML=vals.map(v=>'<div class="stat"><i>'+v[2]+'</i><small>'+v[0]+'</small><b>'+v[1]+'</b></div>').join('');}
function taskRow(t,edit){
 const a=agent(t.agent),s=status(t.status);
 const note=t.note?' • '+safe(t.note.slice(0,80)):'';
 const result=t.result?'<details class="task-result"><summary>عرض مخرجات '+a.name+'</summary><div>'+safe(t.result)+'</div><small>هذه مسودة ذكاء اصطناعي للمراجعة، ولم تنفذ أي إجراءات خارجية.</small></details>':'';
 const error=t.error?'<div class="task-error">فشل تنفيذ النموذج: '+safe(t.error)+'</div>':'';
 const tools=edit?'<div class="task-controls">'+(t.status!=='done'?'<button class="btn btn-run" data-run-task="'+safe(t.id)+'" '+(runningTasks.has(t.id)?'disabled':'')+'>'+(runningTasks.has(t.id)?'جارٍ التنفيذ...':t.result?'إعادة المعالجة':'تشغيل الوكيل')+'</button>':'')+(t.result?'<button class="btn btn-word" data-task-word="'+safe(t.id)+'">Word ↓</button>':'')+
 (t.status==='review'&&t.result?'<button class="btn btn-approve" data-approve-task="'+safe(t.id)+'">اعتماد المسودة</button>':'')+'<button class="trash" data-delete-task="'+safe(t.id)+'" aria-label="حذف">✕</button></div>':'';
 return '<article class="task-row task-row-extended"><span class="task-icon" style="color:'+a.color+'">'+a.letter+'</span><div class="task-summary"><strong>'+safe(t.title)+'</strong><small>'+a.name+' • '+safe(time(t.createdAt))+note+'</small></div><span class="status status-'+s[1]+'">'+s[0]+'</span>'+tools+(result||error?'<div class="task-details">'+error+result+'</div>':'')+'</article>';
}
function renderTasks(){let q=$('#task-search').value.trim().toLowerCase(),f=$('#task-filter').value,who=$('#agent-filter').value;let a=[...db.tasks].sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));$('#recent-tasks').innerHTML=a.length?a.slice(0,5).map(t=>taskRow(t,false)).join(''):empty('لا توجد مهام بعد','ابدأ بتكليف أحد أعضاء فريقك');let list=a.filter(t=>(f==='all'||t.status===f)&&(who==='all'||t.agent===who)&&(!q||(t.title+' '+t.note).toLowerCase().includes(q)));$('#tasks-list').innerHTML=list.length?list.map(t=>taskRow(t,true)).join(''):empty('لا توجد مهام مطابقة','أنشئ مهمة جديدة أو غيّر عوامل التصفية');let review=a.filter(t=>t.status==='review');$('#approvals-list').innerHTML=review.length?review.map(t=>taskRow(t,true)).join(''):empty('لا توجد اعتمادات معلقة','ستظهر هنا المهام التي تحوّلها إلى بانتظار الاعتماد');}
function empty(title,desc){return '<div class="empty"><b>◇</b><strong>'+title+'</strong><span>'+desc+'</span></div>'}

function employmentContractRequested(text,who){
 if(who!=='khulood')return false;
 const str=String(text||'');
 const mentionsContract=/عقد(?:\s+عمل|\s+توظيف)?|employment\s+contract/i.test(str);
 const hasDraftIntent=/اكتب|كتابة|أنشئ|انشئ|اصنع|اعمل|إعداد|اعد|أعد|صياغة|سوّي|سوي|عمل|اريد|أريد|عقد\s+ل/i.test(str);
 const otherAction=/فسخ\s+عقد|إنهاء\s+عقد|انهاء\s+عقد|إلغاء\s+عقد|الغاء\s+عقد/i.test(str);
 return mentionsContract&&hasDraftIntent&&!otherAction;
}
function workerFromRequest(text){
 let s=String(text||'').replace(/[،.؟\n]/g,' ').trim();
 let m=s.match(/(?:عقد\s+(?:عمل\s+)?ل|عقد\s+لـ|للموظف\s+)([\u0621-\u064a]+(?:\s+[\u0621-\u064a]+){0,3})/);
 if(!m)m=s.match(/(?:للموظف|باسم|للسيد|للسيدة)\s+([\u0621-\u064a]+(?:\s+[\u0621-\u064a]+){1,3})/);
 if(!m)return '[اسم الموظف]';
 let n=m[1].replace(/\s+(?:براتب|بوظيفة|بمسمى|في|لمدة|على|ابتداء).*/,'').trim();
 return n.length>3&&n.length<75?n:'[اسم الموظف]';
}
function contractContent(worker){
 const name=worker||'[اسم الموظف]';
 return [
 'مسودة عقد عمل - '+name,
 'مسودة قابلة للتعديل والمراجعة، وليست عقدًا موثقًا أو موقعًا. جميع الحقول بين المعقوفين تستكمل من البيانات المعتمدة قبل الاعتماد.',
 '',
 'أولاً: أطراف العقد',
 'الطرف الأول (صاحب العمل): [الاسم النظامي للمنشأة]، سجل تجاري رقم [يستكمل]، وعنوانها [المدينة والعنوان]، ويمثلها [الاسم والصفة].',
 'الطرف الثاني (العامل): '+name+'، الجنسية [يستكمل]، رقم الهوية/الإقامة [يستكمل]، وعنوان السكن [يستكمل]، ووسيلة التواصل [يستكمل].',
 '',
 'ثانياً: العمل والمسمى الوظيفي',
 'يعمل الطرف الثاني لدى الطرف الأول بمسمى [المسمى الوظيفي]، ويؤدي المهام المحددة في الوصف الوظيفي المرفق، في [مكان العمل]، وفق التعليمات المهنية المشروعة وسياسات العمل المعتمدة.',
 '',
 'ثالثاً: نوع العقد ومدته',
 'نوع العقد: [محدد المدة / غير محدد المدة وفق الحالة النظامية]. تاريخ المباشرة [يوم/شهر/سنة].',
 'إذا كان محدد المدة، تبدأ المدة في [التاريخ] وتنتهي في [التاريخ]، وتحدد آلية التجديد كتابةً بما يوافق النظام.',
 'تُراجع جنسية العامل وأحكام النظام قبل تحديد نوع العقد ومدته نهائيًا.',
 '',
 'رابعاً: الأجر والبدلات والمزايا',
 'الأجر الأساسي الشهري: [المبلغ] ريال سعودي.',
 'بدل السكن: [المبلغ أو الميزة]؛ بدل النقل: [المبلغ أو الميزة]؛ بدلات أو مزايا أخرى: [يستكمل].',
 'إجمالي الأجر الشهري المتفق عليه: [المبلغ] ريال سعودي، ويُدفع وفق المواعيد والوسائل النظامية المعتمدة.',
 '',
 'خامساً: أيام وساعات العمل',
 'أيام العمل الأسبوعية: [يستكمل]. ساعات العمل: [يستكمل].',
 'تخضع فترات الراحة والعمل الإضافي والعطل والضوابط ذات الصلة لنظام العمل ولوائح المنشأة السارية.',
 '',
 'سادساً: فترة التجربة',
 'فترة التجربة إن وجدت: [تحدد صراحة بعد التحقق من الشروط النظامية]، وتطبق عليها الأحكام النظامية ذات الصلة.',
 '',
 'سابعاً: الإجازات والتأمينات',
 'يستحق العامل الإجازات السنوية والرسمية والمرضية وفق نظام العمل والعقد والسياسة المعتمدة، بما لا ينتقص من حقوقه النظامية.',
 'يلتزم الطرفان بما ينطبق من أحكام التأمينات الاجتماعية والتغطية الطبية والالتزامات النظامية ذات الصلة.',
 '',
 'ثامناً: التزامات الطرفين',
 'يلتزم الطرف الأول بتمكين العامل من أداء العمل ودفع الأجر المتفق عليه والوفاء بالالتزامات النظامية.',
 'يلتزم الطرف الثاني بأداء مهامه بعناية، والمحافظة على ممتلكات صاحب العمل، وسرية المعلومات المهنية والشخصية وفق الأنظمة والسياسات المعتمدة.',
 '',
 'تاسعاً: التعديل والإنهاء وتسوية الحقوق',
 'لا تُعدّل الشروط الجوهرية إلا بالطريقة النظامية المعتبرة. وتنظّم إجراءات انتهاء العلاقة والتسوية النهائية والتعويض - إن وجد - وفق نوع العقد والأحكام النظامية المطبقة.',
 '',
 'عاشراً: أحكام ختامية',
 'تعدّ المرفقات المعتمدة جزءًا من العقد عند الإشارة إليها واعتمادها. وتسري أحكام نظام العمل السعودي ولائحته فيما لم يرد به نص صحيح في هذا العقد.',
 'يُحرَّر العقد بالنسخ والطرق النظامية المطلوبة، ويُستكمل توثيقه في المنصة المختصة عند انطباق ذلك.',
 '',
 'توقيع الطرف الأول: [الاسم والصفة والتوقيع والتاريخ]',
 'توقيع الطرف الثاني: '+name+' — [التوقيع والتاريخ]',
 '',
 'بيانات تحتاج استكمالاً قبل الاعتماد:',
 'الاسم النظامي للمنشأة وسجلها وعنوانها، هوية العامل وجنسيته، المسمى، مكان العمل، المدة، تواريخ المباشرة، الراتب والبدلات، ساعات العمل، فترة التجربة إن وجدت، أسماء الممثلين والتوقيعات.',
 '',
 'مرجع الصياغة: المادة (52) من نظام العمل السعودي بشأن العناصر الأساسية للعقد. تُراجع المسودة على ضوء النموذج الرسمي والأنظمة النافذة قبل التوقيع أو التوثيق.'
 ].join('\n');
}
function addWorkspaceDocument(title,content,owner){
 if(!Array.isArray(db.documents))db.documents=[];
 const clean=String(title||'مستند جديد').trim().slice(0,130);
 const doc={id:'doc-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:clean,content:String(content||''),agent:owner,createdAt:new Date().toISOString(),filename:clean.replace(/[\\/:*?"<>|]/g,'_')+'.docx'};
 db.documents.push(doc);db.documents=db.documents.slice(-60);
 save();return doc;
}
function downloadDocument(doc){
 if(!doc)return toast('المستند غير موجود.');
 if(!window.AtifDocs)return toast('مولّد ملفات Word غير متاح. حدّث التطبيق.');
 window.AtifDocs.downloadDocx(doc.title,doc.content,doc.filename);
}
function renderDocuments(){
 const el=$('#documents-list');if(!el)return;
 const docs=[...(db.documents||[])].reverse();
 el.innerHTML=docs.length?docs.map(doc=>'<article class="doc-row"><span class="doc-icon">W</span><div class="doc-details"><strong>'+safe(doc.title)+'</strong><small>أنشأته '+agent(doc.agent).name+' • '+safe(time(doc.createdAt))+' • محفوظ محليًا</small></div><button class="btn btn-ghost" data-doc-download="'+safe(doc.id)+'">تنزيل Word</button><button class="trash" data-doc-delete="'+safe(doc.id)+'" aria-label="حذف المستند">✕</button></article>').join(''):empty('لا توجد مستندات محفوظة','اطلب من خلود إعداد عقد، أو نزّل أي تقرير Word من محادثاتك.');
}

function renderChat(){const a=agent(activeAgent);$$('.chat-agent').forEach(el=>el.classList.toggle('active',el.dataset.agent===activeAgent));$('#chat-avatar').textContent=a.letter;$('#chat-avatar').style.background=a.color+'30';$('#chat-avatar').style.color=a.color;$('#chat-agent-name').textContent=a.name;$('#chat-agent-role').textContent=a.role;const hasCode=!!sessionStorage.getItem('atif-office-code');
$('#chat-connection-status').textContent=!db.endpoint?'الخادم غير مضبوط':!hasCode?'بانتظار رمز الدخول':verifiedSession?'متصل — نموذج مجاني':'رمز محفوظ — تحقق من الدخول';
$('#connect-from-chat').hidden=hasCode&&verifiedSession;
$('#chat-auth-notice').textContent=hasCode&&verifiedSession?'تم تفعيل الوكلاء الأربعة. يمكنك إرسال الرسائل والمهام إلى النموذج المجاني، دون صلاحيات للأنظمة الخارجية.':'للتحدث إلى خلود وديالا وجوانا وأنس أدخل رمز دخول المكتب مرة واحدة في هذه الجلسة.';let entries=db.chats[activeAgent]||[];let feed=$('#chat-messages');feed.innerHTML='<div class="bubble agent"><div class="message-label">'+a.name+'</div>'+safe(a.hello)+'</div>'+entries.map((m,i)=>'<div class="bubble '+(m.role==='user'?'me':'agent')+'"><div class="message-label">'+(m.role==='user'?'أنت':a.name)+'</div>'+safe(m.text)+(m.role==='assistant'&&m.text.length>50?'<div class="bubble-actions"><button data-chat-word="'+i+'" class="word-button">تنزيل Word</button>'+(m.docId?'<button data-doc-open="'+safe(m.docId)+'" class="word-button">عرض في المستندات</button>':'')+'</div>':'')+'</div>').join('');feed.scrollTop=feed.scrollHeight;}
function render(){renderNav();renderStats();renderTasks();renderDocuments();renderSkills();renderWorkflowResults();renderChat();if(currentRoute==='settings'){$('#api-endpoint').value=db.endpoint;}}
function addTask(title,who,note){
 const t={id:'t-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title,agent:who,note,status:'pending',createdAt:new Date().toISOString(),result:'',error:''};
 db.tasks.push(t);
 if(employmentContractRequested(title+' '+note,who)){
  const name=workerFromRequest(title+' '+note);
  const contract=contractContent(name);
  const doc=addWorkspaceDocument('مسودة عقد عمل - '+name,contract,who);
  t.result=contract;t.docId=doc.id;t.status='review';
  save();render();toast('أنشأت خلود مسودة عقد Word، وهي بانتظار اعتمادك.');
  return t;
 }
 save();render();
 if(db.endpoint&&sessionStorage.getItem('atif-office-code'))runTask(t.id);
 else if(db.endpoint)showConnection({type:'task',id:t.id});
 else toast('المهمة محفوظة. فعّل الخادم من الإعدادات.');
 return t;
}
async function runTask(id){
 const t=db.tasks.find(x=>x.id===id);
 if(!t||runningTasks.has(id)||t.status==='done')return;
 if(employmentContractRequested(t.title+' '+(t.note||''),t.agent)){
  const name=workerFromRequest(t.title+' '+(t.note||''));
  const contract=contractContent(name);
  const doc=addWorkspaceDocument('مسودة عقد عمل - '+name,contract,t.agent);
  t.result=contract;t.docId=doc.id;t.status='review';t.error='';
  save();render();toast('مسودة العقد جاهزة للتنزيل من قسم المستندات.');return;
 }
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
function chatAdd(a,role,text,meta={}){if(!db.chats[a])db.chats[a]=[];db.chats[a].push({role,text,createdAt:new Date().toISOString(),...meta});db.chats[a]=db.chats[a].slice(-80);save();renderChat();}
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
  }else if(todo?.type==='workflow'){
    route('skills');await runTeamWorkflow();
  }
 }catch(error){
  $('#connect-error').textContent=error.message||'فشل التحقق من رمز الدخول';
 }finally{button.disabled=false;button.textContent='تحقق واتصل بالوكلاء'}
}

async function sendChat(text){
 const id=activeAgent;
 if(employmentContractRequested(text,id)){
  chatAdd(id,'user',text);
  const name=workerFromRequest(text);
  const content=contractContent(name);
  const doc=addWorkspaceDocument('مسودة عقد عمل - '+name,content,id);
  chatAdd(id,'assistant',content,{docId:doc.id});
  renderDocuments();
  toast('تم إنشاء عقد عمل حقيقي قابل للتنزيل بصيغة Word. راجع الحقول الناقصة قبل اعتماده.');
  return;
 }
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
    status.textContent='خادم النموذج المجاني جاهز للتجربة. '+(sessionStorage.getItem('atif-office-code')?'جرّب تشغيل المهمة الآن.':'أدخل رمز دخول التطبيق واضغط حفظ، ثم شغّل المهمة.');
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
document.addEventListener('click',e=>{const go=e.target.closest('[data-route]');if(go){route(go.dataset.route);return}const ag=e.target.closest('[data-agent]');if(ag){activeAgent=ag.dataset.agent;route('chat');return}if(e.target.closest('[data-action="new-task"]')){modal(true);return}const skillButton=e.target.closest('[data-skill-id]');if(skillButton){useSkill(skillButton.dataset.skillId);return}const chatWord=e.target.closest('[data-chat-word]');if(chatWord){const msg=(db.chats[activeAgent]||[])[Number(chatWord.dataset.chatWord)];if(msg){const existing=(db.documents||[]).find(d=>d.id===msg.docId);if(existing)downloadDocument(existing);else downloadDocument({title:'مخرجات '+agent(activeAgent).name,content:msg.text,filename:'مخرجات_'+agent(activeAgent).name+'.docx'});}return}
const taskWord=e.target.closest('[data-task-word]');if(taskWord){const t=db.tasks.find(x=>x.id===taskWord.dataset.taskWord);if(t)downloadDocument({title:t.title,content:t.result,filename:'مخرجات_'+agent(t.agent).name+'.docx'});return}
const docsOpen=e.target.closest('[data-doc-open]');if(docsOpen){route('documents');return}
const docsDownload=e.target.closest('[data-doc-download]');if(docsDownload){downloadDocument((db.documents||[]).find(d=>d.id===docsDownload.dataset.docDownload));return}
const docsDelete=e.target.closest('[data-doc-delete]');if(docsDelete){const id=docsDelete.dataset.docDelete;if(confirm('حذف المستند المحفوظ من هذا الجهاز؟')){db.documents=db.documents.filter(d=>d.id!==id);save();renderDocuments();}return}
const run=e.target.closest('[data-run-task]');if(run){runTask(run.dataset.runTask);return}const approve=e.target.closest('[data-approve-task]');if(approve){const t=db.tasks.find(x=>x.id===approve.dataset.approveTask);if(t&&t.result&&t.status==='review'){t.status='done';save();render();toast('تم اعتماد المسودة محليًا دون تنفيذ خارجي.')}return}const del=e.target.closest('[data-delete-task]');if(del){const task=db.tasks.find(t=>t.id===del.dataset.deleteTask);if(task&&confirm('حذف المهمة: '+task.title+'؟')){db.tasks=db.tasks.filter(t=>t.id!==task.id);save();render()}return}});
$('#close-modal').addEventListener('click',()=>modal(false));$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')modal(false)});$('#task-form').addEventListener('submit',e=>{e.preventDefault();addTask($('#task-title').value.trim(),$('#task-agent').value,$('#task-note').value.trim());modal(false);route('tasks')});document.addEventListener('change',e=>{const sel=e.target.closest('[data-task-status]');if(sel){const t=db.tasks.find(t=>t.id===sel.dataset.taskStatus);if(t){t.status=sel.value;save();render();toast('تم تحديث حالة المهمة محليًا')}}});['task-search','task-filter','agent-filter'].forEach(id=>$('#'+id).addEventListener(id==='task-search'?'input':'change',renderTasks));$('#chat-form').addEventListener('submit',async e=>{e.preventDefault();const input=$('#chat-input'),v=input.value.trim();if(!v)return;input.value='';await sendChat(v)});$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chat-form').requestSubmit()}});$('#save-api').addEventListener('click',()=>{const url=$('#api-endpoint').value.trim();let parsed;try{parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('https required');}catch{toast('أدخل عنوان HTTPS صحيحًا للخادم');return}if(parsed.href!==db.endpoint){verifiedSession=false;sessionStorage.removeItem('atif-office-code');}db.endpoint=parsed.href;db.endpointCleared=false;const code=$('#access-code').value.trim();if(code){sessionStorage.setItem('atif-office-code',code);verifiedSession=false;$('#access-code').value='';}save();renderChat();toast(sessionStorage.getItem('atif-office-code')?'تم حفظ العنوان والرمز للجلسة. يجري فحص الخادم.':'حُفظ العنوان؛ لا يزال رمز الوصول مطلوبًا.');diagnoseAI()});$('#clear-api').addEventListener('click',()=>{db.endpoint='';db.endpointCleared=true;verifiedSession=false;sessionStorage.removeItem('atif-office-code');$('#api-endpoint').value='';$('#access-code').value='';$('#diagnostic-status').textContent='الاتصال مفصول يدويًا.';save();renderChat();toast('تم فصل الاتصال')});$('#export-data').addEventListener('click',downloadJSON);$('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('الملف كبير جدًا');const d=JSON.parse(await file.text());if(!Array.isArray(d.tasks)||typeof d.chats!=='object'||d.chats===null||!agents.every(a=>Array.isArray(d.chats[a.id])))throw new Error('صيغة النسخة الاحتياطية غير صحيحة');db={tasks:d.tasks.filter(t=>typeof t.title==='string'&&typeof t.id==='string'&&typeof t.agent==='string').slice(0,1000),chats:Object.fromEntries(agents.map(a=>[a.id,d.chats[a.id].filter(m=>typeof m.text==='string'&&['user','assistant'].includes(m.role)).slice(-80)])),documents:Array.isArray(d.documents)?d.documents.filter(x=>x&&typeof x.id==='string'&&typeof x.content==='string').slice(-60):[],endpoint:typeof d.endpoint==='string'?d.endpoint:''};save();render();toast('تم استيراد النسخة الاحتياطية')}catch(ex){toast('تعذر الاستيراد: '+ex.message)}e.target.value=''});$('#erase-data').addEventListener('click',()=>{if(confirm('هل تريد حذف جميع مهامك ومحادثاتك من هذا الجهاز؟')){localStorage.removeItem(KEY);sessionStorage.removeItem('atif-office-code');db=structuredClone(emptyState);render();toast('تم مسح البيانات المحلية')}});$('#check-api').addEventListener('click',diagnoseAI);$('#manual-install').addEventListener('click',()=>alert('على أندرويد: افتح رابط الموقع المنشور في Google Chrome، ثم القائمة ⋮، ثم اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية. يجب أن يكون الموقع منشورًا عبر HTTPS.'));window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#install-btn').hidden=false});$('#install-btn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#install-btn').hidden=true;});window.addEventListener('appinstalled',()=>{$('#install-btn').hidden=true;toast('تم تثبيت التطبيق')});}
function init(){$('#today-label').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date());renderAgents();wire();initSkills();render();
const existing=sessionStorage.getItem('atif-office-code');
if(existing&&db.endpoint){verifyConnectionCode(existing).then(()=>{verifiedSession=true;renderChat()}).catch(()=>{sessionStorage.removeItem('atif-office-code');verifiedSession=false;renderChat()})}
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
init();