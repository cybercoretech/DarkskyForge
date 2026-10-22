import * as opentype from 'opentype.js/dist/opentype.mjs';

// SFNT container helpers shared by every exporter.
export function readTables(buffer) {
  const view=new DataView(buffer),count=view.getUint16(4),tables=new Map();
  for(let i=0;i<count;i++){
    const pos=12+i*16,tag=String.fromCharCode(...new Uint8Array(buffer,pos,4)),offset=view.getUint32(pos+8),length=view.getUint32(pos+12);
    if(offset+length>buffer.byteLength)throw Error(`Font table ${tag} runs past the end of the file.`);
    tables.set(tag,new Uint8Array(buffer.slice(offset,offset+length)));
  }
  return {version:view.getUint32(0),tables};
}
const checksum=bytes=>{let sum=0;for(let i=0;i<bytes.length;i+=4){let word=0;for(let j=0;j<4;j++)word=(word<<8)|(bytes[i+j]||0);sum=(sum+(word>>>0))>>>0;}return sum;};
// Writes tables in tag order with valid directory search fields, per-table
// checksums and head.checkSumAdjustment.
export function assembleSfnt(version,tableMap) {
  const tables=[...tableMap].map(([tag,bytes])=>({tag,bytes:tag==='head'?zeroAdjustment(bytes):bytes})).sort((a,b)=>a.tag<b.tag?-1:a.tag>b.tag?1:0);
  const aligned=n=>(n+3)&~3,size=12+tables.length*16+tables.reduce((sum,t)=>sum+aligned(t.bytes.length),0),out=new Uint8Array(size),view=new DataView(out.buffer);
  view.setUint32(0,version);view.setUint16(4,tables.length);const p=2**Math.floor(Math.log2(tables.length));view.setUint16(6,p*16);view.setUint16(8,Math.log2(p));view.setUint16(10,tables.length*16-p*16);
  let offset=12+tables.length*16,headOffset=-1;
  tables.forEach((t,i)=>{const pos=12+i*16;out.set([...t.tag].map(c=>c.charCodeAt(0)),pos);view.setUint32(pos+4,checksum(t.bytes));view.setUint32(pos+8,offset);view.setUint32(pos+12,t.bytes.length);out.set(t.bytes,offset);if(t.tag==='head')headOffset=offset;offset+=aligned(t.bytes.length);});
  if(headOffset<0)throw Error('Font has no head table.');
  view.setUint32(headOffset+8,(0xB1B0AFBA-checksum(out))>>>0);return out.buffer;
}
function zeroAdjustment(head){const copy=new Uint8Array(head);new DataView(copy.buffer).setUint32(8,0);return copy;}

// ── cubic → quadratic (port of fontTools cu2qu, MIT) ───────────────────────
// Points are [x,y]. Approximates a cubic with the fewest quadratic segments
// whose distance from the cubic stays within `tolerance` font units.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],len=a=>Math.hypot(a[0],a[1]);
function cubicFitsInside(p0,p1,p2,p3,tolerance){
  if(len(p2)<=tolerance&&len(p1)<=tolerance)return true;
  const mid=mul(add(add(p0,mul(add(p1,p2),3)),p3),.125);
  if(len(mid)>tolerance)return false;
  const deriv3=mul(sub(sub(add(p3,p2),p1),p0),.125);
  return cubicFitsInside(p0,mul(add(p0,p1),.5),sub(mid,deriv3),mid,tolerance)&&cubicFitsInside(mid,add(mid,deriv3),mul(add(p2,p3),.5),p3,tolerance);
}
function intersect(a,b,c,d){
  const ab=sub(b,a),cd=sub(d,c),p=[-ab[1],ab[0]],den=p[0]*cd[0]+p[1]*cd[1];
  if(Math.abs(den)<1e-12)return null;
  const h=(p[0]*(a[0]-c[0])+p[1]*(a[1]-c[1]))/den;return add(c,mul(cd,h));
}
function splitCubic(p0,p1,p2,p3,n){
  const c=mul(sub(p1,p0),3),b=sub(mul(sub(p2,p1),3),c),a=sub(sub(sub(p3,p0),c),b),dt=1/n,d2=dt*dt,d3=dt*d2,out=[];
  for(let i=0;i<n;i++){
    const t1=i*dt,t2=t1*t1,a1=mul(a,d3),b1=mul(add(mul(a,3*t1),b),d2),c1=mul(add(add(mul(b,2*t1),c),mul(a,3*t2)),dt),d1=add(add(add(mul(a,t1*t2),mul(b,t2)),mul(c,t1)),p0);
    const q1=d1,q2=add(mul(c1,1/3),d1),q3=add(mul(add(b1,c1),1/3),q2),q4=add(add(add(a1,d1),c1),b1);out.push([q1,q2,q3,q4]);
  }
  return out;
}
const approxControl=(t,[p0,p1,p2,p3])=>{const a=add(p0,mul(sub(p1,p0),1.5)),b=add(p3,mul(sub(p2,p3),1.5));return add(a,mul(sub(b,a),t));};
function cubicApproxSpline(cubic,n,tolerance){
  if(n===1){
    const q1=intersect(...cubic);if(!q1)return null;
    const c1=add(cubic[0],mul(sub(q1,cubic[0]),2/3)),c2=add(cubic[3],mul(sub(q1,cubic[3]),2/3));
    return cubicFitsInside([0,0],sub(c1,cubic[1]),sub(c2,cubic[2]),[0,0],tolerance)?[cubic[0],q1,cubic[3]]:null;
  }
  const cubics=splitCubic(...cubic,n);let next=cubics[0],nextQ1=approxControl(0,next),q2=cubic[0],d1=[0,0];const spline=[cubic[0],nextQ1];
  for(let i=1;i<=n;i++){
    const [,c1,c2,c3]=next,q0=q2,q1=nextQ1;
    if(i<n){next=cubics[i];nextQ1=approxControl(i/(n-1),next);spline.push(nextQ1);q2=mul(add(q1,nextQ1),.5);}else q2=c3;
    const d0=d1;d1=sub(q2,c3);
    if(len(d1)>tolerance||!cubicFitsInside(d0,sub(add(q0,mul(sub(q1,q0),2/3)),c1),sub(add(q2,mul(sub(q1,q2),2/3)),c2),d1,tolerance))return null;
  }
  spline.push(cubic[3]);return spline;
}
export function cubicToQuadratic(cubic,tolerance=1){
  for(let n=1;n<=100;n++){const spline=cubicApproxSpline(cubic,n,tolerance);if(spline)return spline;}
  throw Error('A curve could not be converted to TrueType within tolerance.');
}

// ── TrueType outlines ──────────────────────────────────────────────────────
// Path commands (y-up font units) → contours of {x,y,on} points.
export function quadraticContours(commands,tolerance=1){
  const contours=[];let contour=null,cur=null;
  const close=()=>{if(!contour)return;const first=contour[0],last=contour[contour.length-1];if(contour.length>1&&last.on&&last.x===first.x&&last.y===first.y)contour.pop();if(contour.length>2||contour.some(p=>!p.on))contours.push(contour);contour=null;};
  for(const c of commands){
    if(c.type==='M'){close();contour=[{x:c.x,y:c.y,on:true}];cur=[c.x,c.y];}
    else if(c.type==='L'){contour.push({x:c.x,y:c.y,on:true});cur=[c.x,c.y];}
    else if(c.type==='Q'){contour.push({x:c.x1,y:c.y1,on:false},{x:c.x,y:c.y,on:true});cur=[c.x,c.y];}
    else if(c.type==='C'){const spline=cubicToQuadratic([cur,[c.x1,c.y1],[c.x2,c.y2],[c.x,c.y]],tolerance);for(const p of spline.slice(1,-1))contour.push({x:p[0],y:p[1],on:false});contour.push({x:c.x,y:c.y,on:true});cur=[c.x,c.y];}
    else if(c.type==='Z')close();
  }
  close();
  const rounded=contours.map(points=>points.map(p=>({x:Math.round(p.x),y:Math.round(p.y),on:p.on})).filter((p,i,all)=>{const prev=all[(i-1+all.length)%all.length];return all.length<2||!(p.on&&prev.on&&p.x===prev.x&&p.y===prev.y);})).filter(c=>c.length>=2);
  // TrueType fills clockwise outer contours. Keep the glyph's relative
  // winding and flip everything when the largest contour runs the other way.
  const area=c=>c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p.x*q.y-q.x*p.y;},0)/2;
  const largest=rounded.reduce((best,c)=>Math.abs(area(c))>Math.abs(area(best||[]))?c:best,null);
  return largest&&area(largest)>0?rounded.map(c=>[c[0],...c.slice(1).reverse()]):rounded;
}
function encodeGlyph(contours){
  if(!contours.length)return {bytes:new Uint8Array(0),bounds:null,points:0};
  const pts=contours.flat(),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  const flags=[],xb=[],yb=[];let px=0,py=0;
  for(const p of pts){
    let f=p.on?1:0;const dx=p.x-px,dy=p.y-py;px=p.x;py=p.y;
    if(dx===0)f|=0x10;else if(Math.abs(dx)<256){f|=0x02|(dx>0?0x10:0);xb.push(Math.abs(dx));}else xb.push((dx>>8)&255,dx&255);
    if(dy===0)f|=0x20;else if(Math.abs(dy)<256){f|=0x04|(dy>0?0x20:0);yb.push(Math.abs(dy));}else yb.push((dy>>8)&255,dy&255);
    flags.push(f);
  }
  const size=10+contours.length*2+2+flags.length+xb.length+yb.length,bytes=new Uint8Array((size+3)&~3),v=new DataView(bytes.buffer);
  v.setInt16(0,contours.length);bounds.forEach((b,i)=>v.setInt16(2+i*2,b));
  let end=-1,o=10;for(const c of contours){end+=c.length;v.setUint16(o,end);o+=2;}
  v.setUint16(o,0);o+=2;bytes.set(flags,o);o+=flags.length;bytes.set(xb,o);o+=xb.length;bytes.set(yb,o);
  return {bytes,bounds,points:pts.length,contours:contours.length};
}

// OpenType/CFF → TrueType: every outline is re-encoded as quadratic glyf
// data; cmap, names, metrics, GSUB and kern tables are carried over as-is.
export function otfToTtf(otfBuffer,{tolerance=1}={}) {
  const font=opentype.parse(otfBuffer),{tables}=readTables(otfBuffer);
  const glyphs=[];for(let i=0;i<font.glyphs.length;i++)glyphs.push(encodeGlyph(quadraticContours(font.glyphs.get(i).path.commands,tolerance)));
  const glyfSize=glyphs.reduce((s,g)=>s+g.bytes.length,0),glyf=new Uint8Array(glyfSize),loca=new Uint8Array((glyphs.length+1)*4),lv=new DataView(loca.buffer);
  let off=0;glyphs.forEach((g,i)=>{lv.setUint32(i*4,off);glyf.set(g.bytes,off);off+=g.bytes.length;});lv.setUint32(glyphs.length*4,off);
  const drawn=glyphs.filter(g=>g.bounds),union=drawn.length?[Math.min(...drawn.map(g=>g.bounds[0])),Math.min(...drawn.map(g=>g.bounds[1])),Math.max(...drawn.map(g=>g.bounds[2])),Math.max(...drawn.map(g=>g.bounds[3]))]:[0,0,0,0];
  const head=new Uint8Array(tables.get('head')),hv=new DataView(head.buffer);union.forEach((b,i)=>hv.setInt16(36+i*2,b));hv.setInt16(50,1);hv.setInt16(52,0);
  const maxp=new Uint8Array(32),mv=new DataView(maxp.buffer);
  mv.setUint32(0,0x00010000);mv.setUint16(4,glyphs.length);mv.setUint16(6,Math.max(0,...glyphs.map(g=>g.points)));mv.setUint16(8,Math.max(0,...glyphs.map(g=>g.contours||0)));mv.setUint16(14,2);
  // Left side bearings must equal each glyph's new xMin.
  const hhea=new Uint8Array(tables.get('hhea')),hh=new DataView(hhea.buffer),numH=hh.getUint16(34),hmtx=new Uint8Array(tables.get('hmtx')),hm=new DataView(hmtx.buffer);
  const advance=i=>hm.getUint16(Math.min(i,numH-1)*4);let minL=Infinity,minR=Infinity,maxX=-Infinity;
  glyphs.forEach((g,i)=>{const lsb=g.bounds?g.bounds[0]:0,at=i<numH?i*4+2:numH*4+(i-numH)*2;if(at+2<=hmtx.length)hm.setInt16(at,lsb);if(g.bounds){minL=Math.min(minL,lsb);minR=Math.min(minR,advance(i)-g.bounds[2]);maxX=Math.max(maxX,g.bounds[2]);}});
  if(drawn.length){hh.setInt16(12,minL);hh.setInt16(14,minR);hh.setInt16(16,maxX);}
  const out=new Map(tables);out.delete('CFF ');out.delete('CFF2');out.delete('VORG');
  out.set('head',head).set('maxp',maxp).set('hhea',hhea).set('hmtx',hmtx).set('glyf',glyf).set('loca',loca);
  return assembleSfnt(0x00010000,out);
}

// ── WOFF2 (W3C WOFF File Format 2.0) ───────────────────────────────────────
// Every table is stored untransformed: glyf/loca use the spec's "null
// transform" (version 3), other tables version 0. All table data goes into
// one Brotli stream. Decoders (Chrome/OTS, fontTools, Google's woff2)
// rebuild the identical TrueType file.
const KNOWN_TAGS=['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
function base128(n){const out=[n&127];while((n=Math.floor(n/128))>0)out.unshift((n&127)|128);if(out.length>5)throw Error('WOFF2 length too large.');return out;}
// `compress(bytes)` must return Brotli data (browser: brotli-wasm; Node: zlib).
export async function encodeWoff2(sfntBuffer,compress){
  const {version,tables}=readTables(sfntBuffer);
  // Table order: by tag, with loca directly after glyf as the spec requires.
  const order=[...tables.keys()].sort().filter(t=>t!=='loca');if(tables.has('loca'))order.splice(order.indexOf('glyf')+1,0,'loca');
  const dir=[],chunks=[];let sfntSize=12+16*order.length;
  for(const tag of order){
    const bytes=tables.get(tag),known=KNOWN_TAGS.indexOf(tag),transform=tag==='glyf'||tag==='loca'?3:0;
    dir.push((known<0?63:known)|(transform<<6));
    if(known<0)dir.push(...[...tag].map(c=>c.charCodeAt(0)));
    dir.push(...base128(bytes.length));chunks.push(bytes);sfntSize+=(bytes.length+3)&~3;
  }
  const stream=new Uint8Array(chunks.reduce((s,c)=>s+c.length,0));let at=0;for(const c of chunks){stream.set(c,at);at+=c.length;}
  const packed=await compress(stream),length=(48+dir.length+packed.length+3)&~3,out=new Uint8Array(length),v=new DataView(out.buffer);
  const head=tables.get('head'),rev=head?new DataView(head.buffer,head.byteOffset).getUint32(4):0x00010000;
  v.setUint32(0,0x774F4632);v.setUint32(4,version);v.setUint32(8,length);v.setUint16(12,order.length);v.setUint32(16,sfntSize);v.setUint32(20,packed.length);
  v.setUint16(24,rev>>>16);v.setUint16(26,Math.round((rev&0xffff)/65536*1000)&0xffff);
  out.set(dir,48);out.set(packed,48+dir.length);return out.buffer;
}
// brotli-wasm (wasm-bindgen, no runtime code generation) loads its ~1 MB
// WebAssembly only when someone actually exports WOFF2.
export async function toWoff2(sfntBuffer){
  const brotli=await (await import('brotli-wasm')).default;
  return encodeWoff2(sfntBuffer,bytes=>brotli.compress(bytes,{quality:11}));
}

// ── TrueType autohinting (ttfautohint in a Web Worker) ─────────────────────
let hintWorker,hintSeq=0;const pending=new Map();
export function autohintTtf(ttfBuffer,options){
  if(!hintWorker){
    hintWorker=new Worker(new URL('./autohint-worker.js',import.meta.url),{type:'module'});
    hintWorker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.bytes);};
    hintWorker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'The autohinter failed to start.'));pending.clear();hintWorker=null;};
  }
  const id=++hintSeq,copy=ttfBuffer.slice(0);
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});hintWorker.postMessage({id,bytes:copy,options},[copy]);});
}
