window.AtifOfficeTools=(function(){
'use strict';
const text=n=>String(n??'').trim();
const money=n=>new Intl.NumberFormat('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
function parseCSV(input){
 const t=String(input||'').replace(/^\uFEFF/,'');
 if(t.length>2000000)throw new Error('ملف CSV أكبر من الحد المحلي المسموح (2 MB)');
 const head=t.split(/\r?\n/,1)[0]||'';
 const delimiter=[',',';', '\t'].map(sep=>({sep,n:head.split(sep).length})).sort((a,b)=>b.n-a.n)[0].sep;
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<t.length;i++){
  const ch=t[i];
  if(quoted){if(ch==='"'&&t[i+1]==='"'){field+='"';i++}else if(ch==='"'){quoted=false}else{field+=ch}}
  else if(ch==='"'&&field===''){quoted=true}
  else if(ch===delimiter){row.push(field);field=''}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(field);if(row.some(c=>c!==''))rows.push(row);row=[];field='';if(rows.length>20010)throw new Error('الملف كبير جدًا للتحليل المحلي')}
  else{field+=ch}
 }
 if(quoted)throw new Error('ملف CSV يحتوي على علامة اقتباس غير مغلقة');
 row.push(field);if(row.some(c=>c!==''))rows.push(row);
 if(rows.length<2)throw new Error('يجب أن يحتوي ملف CSV على عنوان أعمدة وصف بيانات واحد على الأقل');
 const headers=rows[0].slice(0,100).map((h,i)=>text(h)||'Column_'+(i+1));
 if(rows[0].length>100)throw new Error('الملف يتجاوز 100 عمود');
 return {headers,rows:rows.slice(1).map(r=>headers.map((_,i)=>r[i]??'')),delimiter};
}
function analyzeCSV(content){
 const {headers,rows}=parseCSV(content);
 const duplicates=new Set();let dupes=0;
 const columns=headers.map((name,i)=>{
  const vals=rows.map(r=>text(r[i])),missing=vals.filter(v=>v===''||/^(null|n\/a|nan)$/i.test(v)).length;
  const nonMissing=vals.filter(v=>v!==''&&!/^(null|n\/a|nan)$/i.test(v));
  const values=nonMissing.map(v=>Number(v.replace(/,/g,'')));
  const numeric=values.length>0&&values.filter(Number.isFinite).length/values.length>=.90;
  let statistics=null;
  if(numeric){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);let sum=v.reduce((a,b)=>a+b,0);statistics={count:v.length,min:v[0],max:v[v.length-1],mean:sum/v.length,median:v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2};}
  return {name,missing,missingPercent:rows.length?+(missing*100/rows.length).toFixed(1):0,nonMissing:nonMissing.length,unique:new Set(nonMissing).size,type:numeric?'رقمي':'نصي',statistics};
 });
 for(const r of rows){const key=JSON.stringify(r);if(duplicates.has(key))dupes++;else duplicates.add(key);}
 let report='تقرير جودة وتحليل بيانات CSV\n\nعدد السجلات: '+rows.length+'\nعدد الأعمدة: '+headers.length+'\nالصفوف المتكررة: '+dupes+'\n';
 for(const c of columns){report+='\nالعمود: '+c.name+'\nالنوع: '+c.type+'\nالقيم المفقودة: '+c.missing+' ('+c.missingPercent+'%)'+'\nالقيم المميزة: '+c.unique+'\n';if(c.statistics){const s=c.statistics;report+='المتوسط: '+s.mean.toFixed(3)+'، الوسيط: '+s.median.toFixed(3)+'، الأدنى: '+s.min+'، الأعلى: '+s.max+'\n';}}
 report+='\nتنبيه: هذا تحليل وصفي محلي. لا يُرسل الملف إلى أي مزوّد ذكاء اصطناعي ولا يعتمد وحده لاتخاذ قرارات تتعلق بالموظفين.';
 return {headers,rowCount:rows.length,columnCount:headers.length,duplicates:dupes,columns,report};
}
function eos({wage,years,months=0,days=0,reason='employer'}){
 const w=Number(wage),y=Number(years),m=Number(months),d=Number(days);
 if(![w,y,m,d].every(Number.isFinite)||w<=0||y<0||m<0||m>11||d<0||d>30||y>80)throw new Error('أدخل أجرًا صحيحًا وسنوات وأشهرًا وأيامًا منطقية');
 const tenure=y+m/12+d/365;
 const gross=w*(.5*Math.min(5,tenure)+Math.max(0,tenure-5));
 const ratio=reason==='resignation'?(tenure<2?0:tenure<=5?1/3:tenure<10?2/3:1):1;
 const result=gross*ratio;
 return {tenure,base:gross,ratio,result,report:'تقدير استرشادي لمكافأة نهاية الخدمة\nالأجر المستخدم: '+money(w)+' ريال\nمدة الخدمة التقريبية: '+tenure.toFixed(3)+' سنة\nالمكافأة الأساسية وفق المادة 84: '+money(gross)+' ريال\nنسبة الاستحقاق في السيناريو المحدد: '+Math.round(100*ratio)+'%\nالتقدير الأولي: '+money(result)+' ريال\n\nالمرجع: المادتان 84 و85 من نظام العمل السعودي. يجب التحقق من سبب انتهاء العلاقة والاستثناءات وأجر التسوية والعقود الخاصة والمواد النظامية الحالية قبل الاعتماد.\nالمصدر: https://www.hrsd.gov.sa/علاقات-العمل'};
}
function parseRepo(value){
 let s=text(value).replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/,'').replace(/\/$/,'');
 const parts=s.split('/');
 if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9._-]{1,100}$/.test(p)))throw new Error('اكتب مالك/مستودع، مثل vercel/next.js. المستودعات الخاصة لا تظهر دون مصادقة.');
 return parts;
}
async function githubPublicRepo(str){
 const [owner,repo]=parseRepo(str);
 const res=await fetch('https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo),{headers:{Accept:'application/vnd.github+json'}});
 if(!res.ok)throw new Error(res.status===404?'المستودع غير عام أو غير موجود':'تعذر قراءة GitHub ('+res.status+')');
 const d=await res.json();
 const report='فحص مستودع GitHub عام\n\nالاسم: '+(d.full_name||owner+'/'+repo)+'\nالوصف: '+(d.description||'غير محدد')+'\nاللغة: '+(d.language||'غير محددة')+'\nالمتابعون (Stars): '+Number(d.stargazers_count||0)+'\nالتفرعات: '+Number(d.forks_count||0)+'\nالمسائل المفتوحة: '+Number(d.open_issues_count||0)+'\nآخر تحديث: '+(d.pushed_at||'غير متوفر')+'\nالرابط: '+d.html_url+'\n\nقراءة عامة فقط. لم يجر أي تعديل على المستودع.';
 return {report,url:d.html_url,name:d.full_name};
}
function downloadCSV(stats){
 const lines=['العمود,النوع,المفقود,نسبة المفقود,المميز,العدد الرقمي,الحد الأدنى,المتوسط,الوسيط,الحد الأعلى'];
 const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 for(const c of stats.columns){const s=c.statistics||{};lines.push([c.name,c.type,c.missing,c.missingPercent,c.unique,s.count||'',s.min??'',s.mean??'',s.median??'',s.max??''].map(quote).join(','));}
 return '\uFEFF'+lines.join('\r\n');
}
return Object.freeze({parseCSV,analyzeCSV,eos,parseRepo,githubPublicRepo,downloadCSV});
})();