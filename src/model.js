import * as opentype from 'opentype.js/dist/opentype.mjs';

// Bundled typefaces are listed in tools/fonts.json; tools/fetch-fonts.mjs
// verifies each one and generates src/font-library.js.
import {FONT_LIBRARY,FONT_GROUPS} from './font-library.js';
export {FONT_LIBRARY,FONT_GROUPS};
// Logo symbols: stroked outlines in a 96×100 box, drawn in the accent colour.
export const SYMBOLS = [
  {id:'brackets', label:'〈 / 〉  Forge brackets', svg:'<path d="M28 4 4 28v44l24 24M68 4l24 24v44L68 96M59 18 37 82"/>'},
  {id:'orbit', label:'◎  Orbital', svg:'<ellipse cx="48" cy="50" rx="45" ry="19" transform="rotate(-45 48 50)"/><circle cx="48" cy="50" r="28"/><path d="M48 5v15M48 80v15"/>'},
  {id:'diamond', label:'◇  Prism', svg:'<path d="m48 3 45 47-45 47L3 50Z M48 25 72 50 48 75 24 50Z"/>'},
  {id:'hexagon', label:'⬡  Hex core', svg:'<path d="M48 4 88 27v46L48 96 8 73V27Z M48 26 69 38v24L48 74 27 62V38Z"/>'},
  {id:'chip', label:'▣  Circuit chip', svg:'<rect x="26" y="28" width="44" height="44"/><rect x="40" y="42" width="16" height="16"/><path d="M36 28V12M48 28V12M60 28V12M36 72v16M48 72v16M60 72v16M26 40H10M26 60H10M70 40h16M70 60h16"/>'},
  {id:'prompt', label:'>_  Prompt', svg:'<path d="M10 22 40 50 10 78M48 80h40"/>'},
  {id:'omega', label:'Ω  Omega', svg:'<path d="M12 92h24v-8C20 76 12 62 12 47 12 25 28 8 48 8s36 17 36 39c0 15-8 29-24 37v8h24"/>'},
  {id:'trident', label:'Ψ  Trident', svg:'<path d="M48 96V22M18 12v22c0 12 13 18 30 18s30-6 30-18V12M48 4l-8 14h16Z"/>'},
  {id:'eye', label:'◉  Alien eye', svg:'<path d="M4 50C20 22 76 22 92 50 76 78 20 78 4 50Z"/><ellipse cx="48" cy="50" rx="7" ry="20"/>'},
  {id:'delta', label:'△  Delta rune', svg:'<path d="M48 6 92 92H4Z M48 40 66 76H30Z"/>'},
  {id:'crosshair', label:'⌖  Crosshair', svg:'<circle cx="48" cy="50" r="34"/><circle cx="48" cy="50" r="6"/><path d="M48 4v26M48 70v26M2 50h26M68 50h26"/>'},
  {id:'planet', label:'◍  Ringed planet', svg:'<circle cx="48" cy="50" r="24"/><ellipse cx="48" cy="50" rx="46" ry="14" transform="rotate(-20 48 50)"/>'},
  {id:'bolt', label:'ϟ  Bolt', svg:'<path d="M58 4 18 56h28l-8 40 40-54H50Z"/>'},
  {id:'shield', label:'⛨  Shield', svg:'<path d="M48 4 86 18v30c0 24-16 40-38 48C26 88 10 72 10 48V18Z M48 26v48"/>'},
  {id:'spark', label:'✦  Spark', svg:'<path d="M48 4c4 30 14 40 44 46-30 6-40 16-44 46-4-30-14-40-44-46 30-6 40-16 44-46Z"/>'},
  {id:'infinity', label:'∞  Infinity', svg:'<path d="M48 50C38 36 30 30 20 30 8 30 2 39 2 50s6 20 18 20c10 0 18-6 28-20s18-20 28-20c12 0 18 9 18 20s-6 20-18 20c-10 0-18-6-28-20Z"/>'},
  {id:'saucer', label:'⊛  Saucer', svg:'<ellipse cx="48" cy="58" rx="44" ry="13"/><path d="M26 50c0-14 10-24 22-24s22 10 22 24M36 80l-8 14M60 80l8 14"/>'},
  {id:'none', label:'Wordmark only', svg:''},
];
const symbolMarkup=id=>SYMBOLS.find(sym=>sym.id===id)?.svg??'';
export const DEFAULT = {version:1, text:'DARKSKY', tagline:'FORGE YOUR SIGNATURE', font:'krypton', tracking:7, size:104, color:'#c5a3ff', accent:'#67e8df', background:'#090c15', symbol:'brackets', transparent:false, glyphs:{}, metrics:{}, kerning:{}, ligatures:{}, fontName:'Darksky Custom'};
export const escapeXML = (s) => String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const safeName = (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'darksky-design';
export function readLicense(text) {
  if (typeof text !== 'string' || text.length > 100000) throw Error('Choose a plain-text font licence under 100 KB.');
  const ofl = /SIL OPEN FONT LICENSE\s*(?:,?\s*Version)?\s*1\.1/i.test(text) && /PREAMBLE/.test(text) && /TERMINATION/.test(text) && /DISCLAIMER/.test(text);
  const header = text.split(/\bPREAMBLE\b/i)[0];
  const reservation = header.match(/(?:with\s+)?Reserved Font Names?[\s\S]*?(?=\n\s*\n|This Font Software|$)/i)?.[0] ?? '';
  const reserved = [...reservation.matchAll(/["“]([^"”]+)["”]/g)].map(m=>m[1]);
  // Ambiguous unquoted reservations are not silently accepted for modified fonts.
  return {ofl, reserved, ambiguous: !!reservation && !reserved.length, text};
}
export function validateFontName(name, license, originalName) {
  if (!license.ofl) throw Error('Font export needs a complete SIL Open Font License 1.1. Other licences are not supported yet.');
  if (license.ambiguous) throw Error('The reserved-name declaration needs review before font export.');
  if (!/^[A-Za-z][A-Za-z0-9 -]{2,47}$/.test(name)) throw Error('Use a new font name: 3–48 letters, numbers, spaces or hyphens, starting with a letter.');
  const normalized = name.replace(/[^a-z0-9]/gi,'').toLowerCase();
  if ([...license.reserved, originalName].filter(Boolean).some(n=>normalized.includes(n.replace(/[^a-z0-9]/gi,'').toLowerCase()))) throw Error('Choose a new font name without the original or reserved font names.');
}
export function validateProject(value) {
  if (!value || value.version !== 1) throw Error('This is not a DarkskyForge v1 project.');
  const s = {...DEFAULT};
  for (const key of ['text','tagline','fontName']) { if(typeof value[key]!=='string') throw Error(`Invalid ${key}.`); s[key]=value[key]; }
  if(s.text.length>48 || s.tagline.length>64 || s.fontName.length>48) throw Error('Project text is too long.');
  if(!FONT_LIBRARY.some(f=>f.id===value.font) && value.font!=='custom') throw Error('Unknown project font.');
  s.font=value.font;
  for(const key of ['color','accent','background']) { if(!/^#[0-9a-f]{6}$/i.test(value[key])) throw Error('Invalid project colour.'); s[key]=value[key]; }
  for(const [key,min,max] of [['tracking',-10,30],['size',40,180]]) { if(!Number.isFinite(value[key])||value[key]<min||value[key]>max) throw Error(`Invalid ${key}.`); s[key]=value[key]; }
  if(!SYMBOLS.some(sym=>sym.id===value.symbol)) throw Error('Unknown symbol.');
  s.symbol=value.symbol; s.transparent=!!value.transparent; s.glyphs={};
  if(!value.glyphs||typeof value.glyphs!=='object'||Array.isArray(value.glyphs)) throw Error('Invalid glyph data.');
  const entries=Object.entries(value.glyphs);
  if(entries.length>100) throw Error('Too many custom glyphs.');
  for(const [character,commands] of entries) {
    if([...character].length!==1 || !Array.isArray(commands)||commands.length>5000) throw Error('Invalid glyph.');
    s.glyphs[character]=commands.map(c=>{
      if(!c || !['M','L','Q','C','Z'].includes(c.type)) throw Error('Invalid path command.');
      const keys={M:['x','y'],L:['x','y'],Q:['x1','y1','x','y'],C:['x1','y1','x2','y2','x','y'],Z:[]}[c.type];
      const out={type:c.type};
      for(const k of keys) { if(!Number.isFinite(c[k])||Math.abs(c[k])>10000) throw Error('Invalid path coordinate.'); out[k]=c[k]; }
      return out;
    });
  }
  for(const key of ['metrics','kerning','ligatures']) {
    const map=value[key]??{};
    if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>500)throw Error('Invalid typography data.');
    s[key]={};
    for(const [entry,v] of Object.entries(map)) {
      if(key==='ligatures') {
        if([...entry].length<2||[...entry].length>4||typeof v!=='string'||[...v].length!==1)throw Error('Invalid ligature.');
      }else if(!Number.isFinite(v)||Math.abs(v)>10000||(key==='metrics'&&(v<1||[...entry].length!==1))||(key==='kerning'&&[...entry].length!==2))throw Error('Invalid metrics.');
      s[key][entry]=v;
    }
  }
  return s;
}
export function glyphCommands(font, character, edits) {
  return structuredClone(edits[character] ?? font.charToGlyph(character).path.commands);
}
export function pathFrom(commands) { const p=new opentype.Path(); p.commands=structuredClone(commands); return p; }
export function shapeText(text,ligatures={}) {
  const characters=[...text],out=[],rules=Object.keys(ligatures).sort((a,b)=>[...b].length-[...a].length);
  for(let i=0;i<characters.length;) {const rule=rules.find(r=>characters.slice(i,i+[...r].length).join('')===r);if(rule){out.push(ligatures[rule]);i+=[...rule].length;}else out.push(characters[i++]);}return out;
}
export function outlinedText(font,text,size,tracking,edits={},metrics={},kerning={},ligatures={}) {
  const path=new opentype.Path(); let cursor=0; const scale=size/font.unitsPerEm;
  const characters=shapeText(text,ligatures);
  for(const [index,character] of characters.entries()) {
    const original=font.charToGlyph(character);
    if(original.index===0 && !edits[character]) throw Error(`This font has no “${character}” glyph. Choose another font or draw it in Glyph lab.`);
    const glyph=new opentype.Glyph({name:original.name||'custom',unicode:character.codePointAt(0),advanceWidth:metrics[character]??original.advanceWidth??font.unitsPerEm,path:pathFrom(glyphCommands(font,character,edits))});
    glyph.path.unitsPerEm=font.unitsPerEm;
    path.extend(glyph.getPath(cursor,0,size,{hinting:false},font));
    cursor+=(glyph.advanceWidth*scale)+tracking+(kerning[character+(characters[index+1]||'')]??font.getKerningValue(original,font.charToGlyph(characters[index+1]||' ')))*scale;
  }
  return path;
}
export function composeSVG(font,state) {
  if(!state.text.trim()) throw Error('Add a wordmark to compose your logo.');
  const word=outlinedText(font,state.text,state.size,state.tracking,state.glyphs,state.metrics,state.kerning,state.ligatures);
  if(!word.commands.length) throw Error('The wordmark has no visible outlines.');
  const b=word.getBoundingBox();
  const tagline=state.tagline.trim() ? outlinedText(font,state.tagline,13,3,state.glyphs,state.metrics,state.kerning,state.ligatures) : null;
  const t=tagline?.getBoundingBox();
  const symbolSpace=state.symbol==='none'?0:124;
  const blockWidth=Math.max(b.x2-b.x1,t?t.x2-t.x1:0);
  const width=Math.ceil(Math.max(280,blockWidth+symbolSpace+128));
  const height=Math.ceil(Math.max(240,b.y2-b.y1+160));
  const x=64+symbolSpace+(blockWidth-(b.x2-b.x1))/2-b.x1;
  const y=(height-(b.y2-b.y1))/2-b.y1-(tagline?16:0);
  const symbol=symbolMarkup(state.symbol);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXML(state.text)} logo"><title>${escapeXML(state.text)} — DarkskyForge</title>${state.transparent?'':`<rect width="100%" height="100%" fill="${state.background}"/>`}<g fill="none" stroke="${state.accent}" stroke-width="4" stroke-linecap="square" transform="translate(64 ${height/2-56})">${symbol}</g><path fill="${state.color}" transform="translate(${x} ${y})" d="${word.toPathData({decimalPlaces:3,flipY:false})}"/>${tagline?`<path fill="${state.accent}" opacity=".85" transform="translate(${64+symbolSpace+(blockWidth-(t.x2-t.x1))/2-t.x1} ${y+b.y2+36})" d="${tagline.toPathData({decimalPlaces:3,flipY:false})}"/>`:''}</svg>`;
}
export function buildFont(font,state,license) {
  validateFontName(state.fontName,license,font.names.windows?.fontFamily?.en||font.names.macintosh?.fontFamily?.en||'');
  const characters=[...new Set([...state.text,...state.tagline,...Object.keys(state.glyphs),...Object.keys(state.metrics||{}),...Object.keys(state.kerning||{}).join(''),...Object.keys(state.ligatures||{}).join(''),...Object.values(state.ligatures||{}),' '])];
  const glyphs=[new opentype.Glyph({name:'.notdef',advanceWidth:font.unitsPerEm/2,path:new opentype.Path()})];
  for(const c of characters) {
    const original=font.charToGlyph(c);
    if(original.index===0&&!state.glyphs[c]) throw Error(`Missing glyph: ${c}`);
    glyphs.push(new opentype.Glyph({name:`uni${c.codePointAt(0).toString(16).toUpperCase()}`,unicode:c.codePointAt(0),advanceWidth:state.metrics?.[c]??original.advanceWidth??font.unitsPerEm,path:pathFrom(glyphCommands(font,c,state.glyphs))}));
  }
  const derived=new opentype.Font({familyName:state.fontName,styleName:'Regular',unitsPerEm:font.unitsPerEm,ascender:font.ascender,descender:font.descender,glyphs});
  const notice=license.text.split(/\bPREAMBLE\b/i)[0].trim();
  for(const names of Object.values(derived.names)) {
    // opentype.js 2 uses platform namespaces.
    if(names && typeof names==='object' && names.fontFamily) {
      names.license={en:license.text}; names.licenseURL={en:'https://openfontlicense.org/'}; names.copyright={en:notice};
    }
  }
  for(const [sequence,target] of Object.entries(state.ligatures||{})) {
    const sub=[...sequence].map(c=>characters.indexOf(c)+1),by=characters.indexOf(target)+1;
    derived.substitution.add('liga',{sub,by});
  }
  const pairs=[];
  for(let a=0;a<characters.length;a++)for(let b=0;b<characters.length;b++) {
    const key=characters[a]+characters[b];
    const value=Math.round(state.kerning?.[key]??font.getKerningValue(font.charToGlyph(characters[a]),font.charToGlyph(characters[b])));
    if(value)pairs.push([a+1,b+1,value]);
  }
  const bytes=derived.toArrayBuffer();
  return pairs.length?appendKernTable(bytes,pairs):bytes;
}

// opentype.js writes GSUB but not kerning tables. Emit the standard version-0
// horizontal kern table, then rebuild SFNT checksums including head adjustment.
export function appendKernTable(buffer,pairs) {
  if(pairs.length>10000)throw Error('Too many kerning pairs for this exporter.');
  const kern=new Uint8Array(18+pairs.length*6),kv=new DataView(kern.buffer);
  kv.setUint16(2,1);kv.setUint16(6,kern.length-4);kv.setUint16(8,1);kv.setUint16(10,pairs.length);
  const power=2**Math.floor(Math.log2(pairs.length));kv.setUint16(12,power*6);kv.setUint16(14,Math.log2(power));kv.setUint16(16,pairs.length*6-power*6);
  pairs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);pairs.forEach(([left,right,value],i)=>{kv.setUint16(18+i*6,left);kv.setUint16(20+i*6,right);kv.setInt16(22+i*6,value);});
  const input=new DataView(buffer),count=input.getUint16(4),tables=[];
  for(let i=0;i<count;i++){const pos=12+i*16,tag=String.fromCharCode(...new Uint8Array(buffer,pos,4));if(tag==='kern')continue;const offset=input.getUint32(pos+8),length=input.getUint32(pos+12);const bytes=new Uint8Array(buffer.slice(offset,offset+length));if(tag==='head')new DataView(bytes.buffer).setUint32(8,0);tables.push({tag,bytes});}
  tables.push({tag:'kern',bytes:kern});tables.sort((a,b)=>a.tag<b.tag?-1:a.tag>b.tag?1:0);
  const aligned=n=>(n+3)&~3,size=12+tables.length*16+tables.reduce((sum,t)=>sum+aligned(t.bytes.length),0),out=new Uint8Array(size),view=new DataView(out.buffer);
  out.set(new Uint8Array(buffer,0,4));view.setUint16(4,tables.length);const p=2**Math.floor(Math.log2(tables.length));view.setUint16(6,p*16);view.setUint16(8,Math.log2(p));view.setUint16(10,tables.length*16-p*16);
  const checksum=bytes=>{let sum=0;for(let i=0;i<bytes.length;i+=4){let word=0;for(let j=0;j<4;j++)word=(word<<8)|(bytes[i+j]||0);sum=(sum+(word>>>0))>>>0;}return sum;};
  let offset=12+tables.length*16,headOffset;
  tables.forEach((t,i)=>{const pos=12+i*16;out.set([...t.tag].map(c=>c.charCodeAt(0)),pos);view.setUint32(pos+4,checksum(t.bytes));view.setUint32(pos+8,offset);view.setUint32(pos+12,t.bytes.length);out.set(t.bytes,offset);if(t.tag==='head')headOffset=offset;offset+=aligned(t.bytes.length);});
  view.setUint32(headOffset+8,(0xB1B0AFBA-checksum(out))>>>0);return out.buffer;
}
