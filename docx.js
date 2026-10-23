window.AtifDocs=(function(){
 'use strict';
 const encoder=new TextEncoder();
 const xmlEscape=value=>String(value==null?'':value).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[x]});
 const buf=v=>encoder.encode(v);
 const crcTable=(function(){const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[i]=c>>>0}return t})();
 const crc32=bytes=>{let c=0xffffffff;for(const n of bytes)c=crcTable[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0};
 const write16=(v,o,n)=>new DataView(v.buffer,v.byteOffset,v.byteLength).setUint16(o,n,true);
 const write32=(v,o,n)=>new DataView(v.buffer,v.byteOffset,v.byteLength).setUint32(o,n>>>0,true);
 function zip(files){
  const chunks=[],central=[];let pos=0;
  for(const entry of files){
   const name=buf(entry[0]),data=buf(entry[1]),crc=crc32(data);
   const local=new Uint8Array(30+name.length);
   write32(local,0,0x04034b50);write16(local,4,20);write16(local,6,0x0800);write16(local,8,0);
   write32(local,14,crc);write32(local,18,data.length);write32(local,22,data.length);write16(local,26,name.length);
   local.set(name,30);
   const center=new Uint8Array(46+name.length);
   write32(center,0,0x02014b50);write16(center,4,20);write16(center,6,20);write16(center,8,0x0800);
   write16(center,10,0);write32(center,16,crc);write32(center,20,data.length);
   write32(center,24,data.length);write16(center,28,name.length);write32(center,42,pos);center.set(name,46);
   chunks.push(local,data);central.push(center);pos+=local.length+data.length;
  }
  const start=pos;
  for(const part of central){chunks.push(part);pos+=part.length}
  const end=new Uint8Array(22);
  write32(end,0,0x06054b50);write16(end,8,files.length);write16(end,10,files.length);
  write32(end,12,pos-start);write32(end,16,start);chunks.push(end);
  return new Blob(chunks,{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 }
 function paragraph(line){
  let text=String(line||'').replace(/^\s*#{1,5}\s*/,'').replace(/^\s*[-*]\s+/,'• ').replace(/^\s*\d+\.\s+/,'').replace(/\*\*/g,'');
  const header=/^(مسودة|عقد عمل|أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|ثامناً|تاسعاً|عاشراً|البند|المادة|الطرف|توقيع|بيانات)/.test(text)&&text.length<110;
  const size=header?26:23;
  const color=header?'243656':'172333';
  const bold=header?'<w:b/>':'';
  const shading=header?'<w:shd w:fill="EFF3FC"/>':'';
  return '<w:p><w:pPr><w:bidi/><w:jc w:val="right"/><w:spacing w:before="'+(header?'170':'0')+'" w:after="'+(header?'190':'115')+'"/>'+shading+'</w:pPr><w:r><w:rPr>'+bold+'<w:rtl/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="'+size+'"/><w:szCs w:val="'+size+'"/><w:color w:val="'+color+'"/></w:rPr><w:t xml:space="preserve">'+xmlEscape(text||' ')+'</w:t></w:r></w:p>';
 }
 function createDocx(title,content){
  const paragraphs=String(content||'').split(/\r?\n/).slice(0,800);
  const titleXml=paragraph(String(title||'مسودة مستند'));
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
   +titleXml+paragraphs.map(paragraph).join('')
   +'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1250" w:right="1250" w:bottom="1250" w:left="1250" w:header="720" w:footer="720"/></w:sectPr>'
   +'</w:body></w:document>';
  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
   +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
   +'<Default Extension="xml" ContentType="application/xml"/>'
   +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
   +'</Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
   +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
   +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
   +'</Relationships>';
  return zip([['[Content_Types].xml',contentTypes],['_rels/.rels',rels],['word/document.xml',doc]]);
 }
 function downloadDocx(title,content,filename){
  const blob=createDocx(title,content);
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=(String(filename||title||'document').replace(/[\\/:*?"<>|]/g,'_').slice(0,85)||'document').replace(/\.docx$/i,'')+'.docx';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},2000);
 }
 return {createDocx,downloadDocx};
})();