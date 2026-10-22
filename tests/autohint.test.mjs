import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ot from 'opentype.js/dist/opentype.mjs';
import createTtfautohint from '../src/autohint/ttfautohint.mjs';
import {autohintWith} from '../src/autohint.js';
import {DEFAULT,readLicense,buildFont} from '../src/model.js';
import {otfToTtf,readTables} from '../src/fontformats.js';

const m=await createTtfautohint();
const ttfFor=(id,file,lic)=>{const b=fs.readFileSync(`public/fonts/${file}`),font=ot.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  return otfToTtf(buildFont(font,{...structuredClone(DEFAULT),font:id,text:'DARKSKY AVfi gq@&%',kerning:{AV:-90},ligatures:{fi:'D'}},readLicense(fs.readFileSync(`public/fonts/${lic}`,'utf8'))));};

for(const [id,file,lic] of [['krypton','krypton.woff','OFL-Monaspace.txt'],['jetbrains','jetbrains-bold.ttf','OFL-JetBrains.txt']]){
  test(`${id}: ttfautohint adds TrueType instructions and leaves everything else intact`,()=>{
    const ttf=ttfFor(id,file,lic),hinted=autohintWith(m,new Uint8Array(ttf)),before=readTables(ttf).tables,after=readTables(hinted.buffer).tables;
    for(const tag of ['fpgm','prep','cvt ','gasp'])assert.ok(after.has(tag)&&!before.has(tag),`${tag} added`);
    for(const tag of ['cmap','hmtx','kern','GSUB','post','OS/2'])assert.deepEqual(after.get(tag),before.get(tag),`${tag} unchanged`);
    const a=ot.parse(ttf),b=ot.parse(hinted.buffer);
    assert.equal(b.glyphs.length,a.glyphs.length);assert.equal(b.names.windows.fontFamily.en,'Darksky Custom');
    for(let i=1;i<a.glyphs.length;i++)assert.deepEqual(b.glyphs.get(i).path.commands,a.glyphs.get(i).path.commands,`glyph ${i} outline unchanged`);
    assert.equal(b.getKerningValue(b.charToGlyph('A'),b.charToGlyph('V')),-90);
    assert.deepEqual(autohintWith(m,new Uint8Array(ttf)),hinted,'deterministic');
    const view=new DataView(hinted.buffer);let sum=0;for(let i=0;i<hinted.length;i+=4)sum=(sum+view.getUint32(i))>>>0;assert.equal(sum,0xB1B0AFBA);
  });
}

test('ttfautohint rejects input that is not a TrueType font',()=>{
  assert.throws(()=>autohintWith(m,new Uint8Array([1,2,3,4])),/not a font with TrueType outlines/);
  const b=fs.readFileSync('public/fonts/krypton.woff');assert.throws(()=>autohintWith(m,new Uint8Array(b)),/ttfautohint/);
});
