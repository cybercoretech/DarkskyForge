import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ot from 'opentype.js/dist/opentype.mjs';
import zlib from 'node:zlib';
import {DEFAULT,readLicense,buildFont} from '../src/model.js';
import {cubicToQuadratic,quadraticContours,otfToTtf,encodeWoff2,readTables} from '../src/fontformats.js';

const brotli=bytes=>new Uint8Array(zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11,[zlib.constants.BROTLI_PARAM_MODE]:zlib.constants.BROTLI_MODE_FONT}}));
// Minimal WOFF2 reader (untransformed tables only): returns {flavor, sfntSize, tables}.
function readWoff2(buffer){
  const v=new DataView(buffer),n=v.getUint16(12),tables=new Map(),entries=[];let o=48;
  const tags=['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB'];
  const b128=()=>{let r=0;for(let i=0;i<5;i++){const b=v.getUint8(o++);r=r*128+(b&127);if(!(b&128))return r;}throw Error('bad UIntBase128');};
  for(let i=0;i<n;i++){const f=v.getUint8(o++);let tag;if((f&63)===63){tag=String.fromCharCode(...new Uint8Array(buffer,o,4));o+=4;}else tag=tags[f&63];const t=f>>6,len=b128();if((tag==='glyf'||tag==='loca')?t!==3:t!==0)throw Error(`${tag} is transformed`);entries.push([tag,len]);}
  const data=zlib.brotliDecompressSync(new Uint8Array(buffer,o,v.getUint32(20)));let at=0;for(const [tag,len] of entries){tables.set(tag,new Uint8Array(data.subarray(at,at+len)));at+=len;}
  if(at!==data.length)throw Error('stream length mismatch');return {flavor:v.getUint32(4),length:v.getUint32(8),sfntSize:v.getUint32(16),order:entries.map(e=>e[0]),tables};
}

const load=file=>{const b=fs.readFileSync(`public/fonts/${file}`);return ot.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const FIXTURES=[['krypton','krypton.woff','OFL-Monaspace.txt'],['jetbrains','jetbrains-bold.ttf','OFL-JetBrains.txt']];
const exportState=id=>({...structuredClone(DEFAULT),font:id,text:'DARKSKY AVfi gq@&%',kerning:{AV:-90},ligatures:{fi:'D'}});

const cubicAt=([p0,p1,p2,p3],t)=>[0,1].map(k=>(1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t**2*p2[k]+t**3*p3[k]);
// Evaluate a TrueType spline (implied on-curve midpoints between controls).
function splineAt(spline,steps=200){
  const out=[],ctrl=spline.slice(1,-1),segs=[];let start=spline[0];
  ctrl.forEach((c,i)=>{const end=i<ctrl.length-1?[(c[0]+ctrl[i+1][0])/2,(c[1]+ctrl[i+1][1])/2]:spline.at(-1);segs.push([start,c,end]);start=end;});
  for(const [a,c,b] of segs)for(let i=0;i<=steps;i++){const t=i/steps;out.push([0,1].map(k=>(1-t)**2*a[k]+2*(1-t)*t*c[k]+t*t*b[k]));}
  return out;
}

test('Cubic curves convert to quadratic splines within the requested tolerance',()=>{
  const curves=[[[0,0],[0,100],[100,100],[100,0]],[[0,0],[300,600],[-200,600],[100,0]],[[10,10],[40,10],[70,10],[100,10]],[[0,0],[1000,0],[0,1000],[1000,1000]]];
  for(const cubic of curves)for(const tolerance of [1,0.25]){
    const spline=cubicToQuadratic(cubic,tolerance),samples=splineAt(spline);
    assert.deepEqual(spline[0],cubic[0]);assert.deepEqual(spline.at(-1),cubic[3]);
    for(let i=0;i<=100;i++){const p=cubicAt(cubic,i/100),d=Math.min(...samples.map(q=>Math.hypot(q[0]-p[0],q[1]-p[1])));assert.ok(d<=tolerance+0.05,`deviation ${d} > ${tolerance}`);}
  }
});

test('TrueType contours wind clockwise and drop duplicate closing points',()=>{
  const ccwSquare=[{type:'M',x:0,y:0},{type:'L',x:100,y:0},{type:'L',x:100,y:100},{type:'L',x:0,y:100},{type:'L',x:0,y:0},{type:'Z'}];
  const [c]=quadraticContours(ccwSquare),area=c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p.x*q.y-q.x*p.y;},0);
  assert.equal(c.length,4);assert.ok(area<0,'outer contour must be clockwise');
});

for(const [id,file,lic] of FIXTURES){
  test(`${id}: TTF keeps glyphs, metrics, kerning and ligatures with valid checksums`,async()=>{
    const otf=buildFont(load(file),exportState(id),readLicense(fs.readFileSync(`public/fonts/${lic}`,'utf8')));
    const ttf=otfToTtf(otf),src=ot.parse(otf),out=ot.parse(ttf);
    assert.equal(out.outlinesFormat,'truetype');assert.equal(out.glyphs.length,src.glyphs.length);
    assert.equal(out.names.windows.fontFamily.en,'Darksky Custom');
    assert.equal(out.getKerningValue(out.charToGlyph('A'),out.charToGlyph('V')),-90);
    assert.deepEqual(out.stringToGlyphs('fi').map(g=>g.index),[out.charToGlyphIndex('D')]);
    const {tables,version}=readTables(ttf);assert.equal(version,0x00010000);assert.ok(tables.has('glyf')&&tables.has('loca')&&!tables.has('CFF '));
    const view=new DataView(ttf);let sum=0;for(let i=0;i<ttf.byteLength;i+=4)sum=(sum+view.getUint32(i))>>>0;assert.equal(sum,0xB1B0AFBA);
    for(let i=1;i<out.glyphs.length;i++){
      const a=src.glyphs.get(i),b=out.glyphs.get(i);assert.equal(b.advanceWidth,a.advanceWidth);
      if(!b.path.commands.length)continue;
      const ba=a.getBoundingBox(),bb=b.getBoundingBox();for(const k of ['x1','y1','x2','y2'])assert.ok(Math.abs(ba[k]-bb[k])<=2,`${a.name} ${k} ${ba[k]}→${bb[k]}`);
      assert.equal(b.leftSideBearing,Math.round(bb.x1),`${a.name} lsb matches xMin`);
    }
    const woff2=await encodeWoff2(ttf,brotli),w=readWoff2(woff2);
    assert.equal(String.fromCharCode(...new Uint8Array(woff2,0,4)),'wOF2');assert.equal(w.flavor,0x00010000);assert.equal(w.length,woff2.byteLength);assert.equal(woff2.byteLength%4,0);
    assert.ok(woff2.byteLength<ttf.byteLength*0.7,`woff2 ${woff2.byteLength} vs ttf ${ttf.byteLength}`);
    assert.equal(w.order[w.order.indexOf('glyf')+1],'loca');
    let expectedSize=12+16*tables.size;for(const [tag,bytes] of tables){assert.deepEqual(w.tables.get(tag),bytes,`${tag} round-trips byte for byte`);expectedSize+=(bytes.length+3)&~3;}
    assert.equal(w.sfntSize,expectedSize);
  });
}
