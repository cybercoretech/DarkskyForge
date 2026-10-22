// Writes OTF, TTF and WOFF2 exports of both bundled fonts so an independent
// parser (tools/validate-fonts.py, fontTools) can check them.
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as ot from 'opentype.js/dist/opentype.mjs';
import {DEFAULT,readLicense,buildFont} from '../src/model.js';
import {otfToTtf,encodeWoff2} from '../src/fontformats.js';
import createTtfautohint from '../src/autohint/ttfautohint.mjs';
import {autohintWith} from '../src/autohint.js';
const hinter=await createTtfautohint();
const brotli=bytes=>new Uint8Array(zlib.brotliCompressSync(bytes,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11,[zlib.constants.BROTLI_PARAM_MODE]:zlib.constants.BROTLI_MODE_FONT}}));
const out=process.argv[2]||'test-results/fonts';fs.mkdirSync(out,{recursive:true});
for(const [id,file,lic] of [['krypton','krypton.woff','OFL-Monaspace.txt'],['jetbrains','jetbrains-bold.ttf','OFL-JetBrains.txt']]){
  const b=fs.readFileSync(`public/fonts/${file}`),font=ot.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const otf=buildFont(font,{...structuredClone(DEFAULT),font:id,text:'DARKSKY AVfi gq@&%',kerning:{AV:-90},ligatures:{fi:'D'}},readLicense(fs.readFileSync(`public/fonts/${lic}`,'utf8')));
  const ttf=otfToTtf(otf);
  fs.writeFileSync(`${out}/${id}.otf`,new Uint8Array(otf));fs.writeFileSync(`${out}/${id}.ttf`,new Uint8Array(ttf));fs.writeFileSync(`${out}/${id}.woff2`,new Uint8Array(await encodeWoff2(ttf,brotli)));
  fs.writeFileSync(`${out}/${id}.hinted.ttf`,autohintWith(hinter,new Uint8Array(ttf)));
}
console.log(`fixtures written to ${out}`);
