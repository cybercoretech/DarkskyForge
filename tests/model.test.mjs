import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ot from 'opentype.js/dist/opentype.mjs';
import {DEFAULT,readLicense,validateFontName,validateProject,composeSVG,buildFont,outlinedText} from '../src/model.js';
const buffer=fs.readFileSync('public/fonts/krypton.woff');
const font=ot.parse(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
const license=readLicense(fs.readFileSync('public/fonts/OFL-Monaspace.txt','utf8'));
test('Reads every declared Monaspace reserved name and blocks font reuse',()=>{
  assert.equal(license.ofl,true);assert.deepEqual(license.reserved,['Monaspace','Argon','Neon','Xenon','Radon','Krypton']);
  for(const name of ['Monaspace New','Neo Krypton','MONA SPACE','Kryptonix'])assert.throws(()=>validateFontName(name,license,''));
  validateFontName('Darksky Custom',license,'Monaspace Krypton ExtraBold');
  assert.throws(()=>validateFontName('New Font',readLicense('All rights reserved'),''));
});
test('Malformed imported projects cannot inject SVG or non-finite path data',()=>{
  assert.deepEqual(validateProject(DEFAULT),DEFAULT);
  assert.throws(()=>validateProject({...DEFAULT,color:'red" onload="alert(1)'}));
  assert.throws(()=>validateProject({...DEFAULT,glyphs:{A:[{type:'M',x:Infinity,y:0}]}}));
  assert.throws(()=>validateProject({...DEFAULT,size:999999}));
});
test('SVG contains real outlines, transparent exports omit the background',()=>{
  const svg=composeSVG(font,DEFAULT);assert.match(svg,/<path fill=/);assert.doesNotMatch(svg,/<text/);assert.match(svg,/<rect/);
  assert.doesNotMatch(composeSVG(font,{...DEFAULT,transparent:true}),/<rect/);
  assert.throws(()=>composeSVG(font,{...DEFAULT,text:''}));
  assert.throws(()=>composeSVG(font,{...DEFAULT,text:'🛰'}));
});
test('Font subset round-trips with a new internal name, licence, and edited outlines',()=>{
  const state=structuredClone(DEFAULT),c=font.charToGlyph('D').path.commands.map(c=>({...c}));
  c[0].x+=20;state.glyphs.D=c;
  const derived=ot.parse(buildFont(font,state,license));
  assert.equal(derived.names.windows.fontFamily.en,'Darksky Custom');
  assert.match(derived.names.windows.license.en,/SIL OPEN FONT LICENSE/);
  assert.ok(derived.charToGlyphIndex('D')>0);assert.equal(derived.charToGlyphIndex('☃'),0);
  assert.equal(derived.charToGlyph('D').path.commands[0].x,c[0].x);
  assert.throws(()=>buildFont(font,{...state,fontName:'Monaspace Custom'},license));
});
test('Kerning and ligatures survive font compilation and table checksums remain valid',()=>{
 const state={...structuredClone(DEFAULT),text:'AVfi',kerning:{AV:-120},ligatures:{fi:'D'}};
 const bytes=buildFont(font,state,license),derived=ot.parse(bytes);
 assert.equal(derived.getKerningValue(derived.charToGlyph('A'),derived.charToGlyph('V')),-120);
 assert.deepEqual(derived.stringToGlyphs('fi').map(g=>g.index),[derived.charToGlyphIndex('D')]);
 const view=new DataView(bytes);let sum=0;for(let i=0;i<bytes.byteLength;i+=4)sum=(sum+view.getUint32(i))>>>0;
 assert.equal(sum,0xB1B0AFBA);
});

test('Outlines use source units per em, preserving the original glyph scale',()=>{
 const actual=outlinedText(font,'D',104,0).getBoundingBox();
 const expected=font.getPath('D',0,0,104).getBoundingBox();
 assert.deepEqual(actual,expected);
});

test('Every bundled typeface parses, carries its licence and draws the default logo',async()=>{
 const {FONT_LIBRARY,FONT_GROUPS}=await import('../src/model.js');
 assert.ok(FONT_LIBRARY.length>=27);
 for(const f of FONT_LIBRARY){
  assert.ok(FONT_GROUPS.includes(f.group),`${f.id} group`);
  const b=fs.readFileSync(`public${f.url}`),parsed=ot.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  assert.equal(readLicense(fs.readFileSync(`public${f.license}`,'utf8')).ofl,true,`${f.id} licence`);
  assert.match(composeSVG(parsed,{...DEFAULT,font:f.id}),/<path fill=/,`${f.id} renders`);
 }
});

test('Every symbol validates and renders as stroked outlines',async()=>{
 const {SYMBOLS}=await import('../src/model.js');
 assert.ok(SYMBOLS.length>=18);
 for(const s of SYMBOLS){
  const state=validateProject({...DEFAULT,symbol:s.id}),svg=composeSVG(font,state);
  if(s.id==='none')assert.match(svg,/stroke-width="4"[^>]*><\/g>/,'wordmark-only draws an empty symbol group');else assert.ok(svg.includes(s.svg),`${s.id} drawn`);
 }
 assert.throws(()=>validateProject({...DEFAULT,symbol:'<script>'}));
});
