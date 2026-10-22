import {typography} from './typography.js';
import * as opentype from 'opentype.js/dist/opentype.mjs';
import {zipSync,strToU8} from 'fflate';
import {otfToTtf,toWoff2} from './fontformats.js';
import {DEFAULT,FONT_LIBRARY,FONT_GROUPS,SYMBOLS,googleFontRef,googleFontURL,readLicense,validateProject,composeSVG,buildFont,glyphCommands,pathFrom,safeName,escapeXML} from './model.js';

const $=s=>document.querySelector(s);
let state=structuredClone(DEFAULT),font,license,fontBytes,customSource=null,googleRef=null,googleCatalog=null,googlePick=null,svg='',undo=[],redo=[],mode='logo';
let fileHandle=null,typographyTools;
let selectedPoint=null,drawPoints=[],dragging=null,glyphBefore=null,loadSequence=0;
const fontCache=new Map();
let engine,allThemes=[],customThemes=[],currentTheme;
const storeKey='darkskyforge.project.v1',themeKey='darkskyforge.themes.v1';
function tell(message,error=false) { const el=$('#status'); el.textContent=String(message);el.hidden=false;el.classList.toggle('error',error);clearTimeout(tell.timer);tell.timer=setTimeout(()=>el.hidden=true,error?10000:5000); }
const run=fn=>async(...args)=>{try {await fn(...args);}catch(e){tell(e.message||e,true);}};
function remember(){undo.push(JSON.stringify(state));if(undo.length>60)undo.shift();redo=[];}
function persist(){try{if(state.font==='custom'){$('#save-state').textContent='Imported font: save a project file to keep it.';return;}localStorage.setItem(storeKey,JSON.stringify(state));$('#save-state').textContent='Saved in this browser.';}catch{$('#save-state').textContent='Browser storage unavailable. Save a project file.';}}
function sync(){for(const [id,key] of [['wordmark','text'],['tagline','tagline'],['font-select','font'],['tracking','tracking'],['type-size','size'],['color','color'],['accent','accent'],['background','background'],['symbol','symbol'],['font-name','fontName']])$('#'+id).value=state[key];$('#transparent').checked=state.transparent;$('#size-value').value=state.size;$('#tracking-value').value=state.tracking;}
function render(){
  if(!font)return;
  sync();persist();$('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;
  try{svg=composeSVG(font,state);$('#logo-preview').innerHTML=svg;const el=$('#logo-preview svg');$('#canvas-dimensions').textContent=`${el.getAttribute('width')} × ${el.getAttribute('height')} px`;$('#export-logo').disabled=false;}
  catch(e){svg='';$('#logo-preview').textContent=e.message;$('#canvas-dimensions').textContent='Composition needs attention';$('#export-logo').disabled=true;}
  $('#font-note').textContent=license.ofl?'SIL OFL 1.1 · original licence included':'Unsupported font licence';
  $('#license-summary').textContent=license.reserved.length?`Reserved names: ${license.reserved.join(', ')}.`:'OFL 1.1. Font licences travel with your work.';
  $('#reserved-names').textContent=license.reserved.length?`Choose a new family name without: ${license.reserved.join(', ')}.`:'A new family name identifies your modified subset.';
  if(mode==='glyph')renderGlyph();
}
async function loadFont(id){
  const sequence=++loadSequence;
  let source;
  if(id==='custom'){if(!customSource)throw Error('Reopen the saved project or import the custom font again.');source=customSource;}
  else if(id==='google'){
    if(!googleRef)throw Error('Choose a Google Fonts family again.');
    const key=`google:${googleRef.commit}/${googleRef.dir}/${googleRef.file}`;
    if(!fontCache.has(key)){
      const responses=await Promise.all([fetch(googleFontURL(googleRef)),fetch(googleFontURL(googleRef,'OFL.txt'))]);
      if(responses.some(r=>!r.ok))throw Error('Google Fonts download failed. Check your connection and try again.');
      const [bytes,text]=await Promise.all([responses[0].arrayBuffer(),responses[1].text()]);
      if(bytes.byteLength>4*1024*1024)throw Error('This font file is too large to edit here.');
      const lic=readLicense(text);if(!lic.ofl)throw Error('This family does not ship a complete SIL OFL 1.1 licence.');
      fontCache.set(key,{bytes,license:lic});
    }
    source=fontCache.get(key);
  }
  else {
    if(!fontCache.has(id)){
      const meta=FONT_LIBRARY.find(f=>f.id===id);if(!meta)throw Error('Unknown font.');
      const responses=await Promise.all([fetch(meta.url),fetch(meta.license)]);if(responses.some(r=>!r.ok))throw Error('Font download failed. Please try again.');
      const [bytes,text]=await Promise.all([responses[0].arrayBuffer(),responses[1].text()]);
      fontCache.set(id,{bytes,license:readLicense(text)});
    }
    source=fontCache.get(id);
  }
  const parsed=opentype.parse(source.bytes.slice(0));
  if(sequence!==loadSequence)return false;
  font=parsed;license=source.license;fontBytes=source.bytes;return true;
}
function blobDownload(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function zipDownload(name,files){blobDownload(name,new Blob([zipSync(files)],{type:'application/zip'}));}
function projectData(){const data={...structuredClone(state),fontLicense:license.text};if(state.font==='custom'){const bytes=new Uint8Array(fontBytes);let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));data.sourceFont={data:btoa(raw),license:license.text};}return data;}
function projectJSON(){return JSON.stringify(projectData(),null,2);}
function sourceDescription(){if(state.font==='google'&&googleRef)return `${googleRef.family} ${googleRef.style}, Google Fonts\n  ${googleFontURL(googleRef)}\n  (google/fonts commit ${googleRef.commit})`;return FONT_LIBRARY.find(f=>f.id===state.font)?.name||'Imported font';}
function licenseFiles(){return {'OFL.txt':strToU8(license.text),'README.txt':strToU8(`Created with DarkskyForge\nhttps://github.com/cybercoretech/DarkskyForge\n\nSource typeface: ${sourceDescription()}\nThe original font licence is included in OFL.txt. Logo artwork is your creation; including this licence does not put your artwork under OFL. A generated font subset remains under OFL.\n`)};}
async function pngBytes(source,scale){
  const image=new Image(),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  try{image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width*scale;canvas.height=image.height*scale;if(canvas.width>16384||canvas.width*canvas.height>32000000)throw Error('This image is too large. Lower the PNG scale or shorten the wordmark.');const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed.');return new Uint8Array(await blob.arrayBuffer());}finally{URL.revokeObjectURL(url);}
}
$('#export-logo').onclick=run(async()=>{
  if(!svg||!license.ofl)throw Error('A valid composition and OFL licence are required.');
  const files=licenseFiles(),format=$('#export-format').value,base=safeName(state.text);
  if(format!=='png')files[`${base}.svg`]=strToU8(svg);
  if(format!=='svg')files[`${base}.png`]=await pngBytes(svg,Number($('#png-scale').value));
  if(format==='pack')files[`${base}.darksky.json`]=strToU8(projectJSON());
  zipDownload(`${base}-${format}.zip`,files);tell('Artwork exported with its font licence.');
});
$('#save-local').onclick=run(async()=>{
  if(!window.showSaveFilePicker){$('#save-project').click();tell('Direct file saving is unavailable in this browser. Downloaded a project file.');return;}
  try{if(!fileHandle)fileHandle=await window.showSaveFilePicker({suggestedName:safeName(state.text)+'.darksky.json',types:[{description:'DarkskyForge project',accept:{'application/json':['.json']}}]});const writable=await fileHandle.createWritable();await writable.write(projectJSON());await writable.close();$('#save-local').textContent='Save to '+fileHandle.name;tell('Saved to your local project file.');}catch(e){if(e.name!=='AbortError')throw e;}
});
$('#save-project').onclick=run(()=>blobDownload(`${safeName(state.text)}.darksky.json`,new Blob([projectJSON()],{type:'application/json'})));
$('#open-project').onclick=()=>$('#project-file').click();
$('#project-file').onchange=run(async e=>{
  const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('Project files must be smaller than 8 MiB.');
  const value=JSON.parse(await file.text()),next=validateProject(value);
  let imported;
  if(next.font==='custom'){
    if(!value.sourceFont||typeof value.sourceFont.data!=='string')throw Error('The project is missing its source font.');
    const bytes=Uint8Array.from(atob(value.sourceFont.data),c=>c.charCodeAt(0)).buffer,lic=readLicense(value.sourceFont.license);
    if(!lic.ofl)throw Error('This project has an unsupported font licence.');opentype.parse(bytes.slice(0));imported={bytes,license:lic};
  }
  remember();fileHandle=null;$('#save-local').textContent='Save to local file…';if(imported){customSource=imported;ensureCustomOption();}if(next.font==='google'){googleRef=next.googleFont;ensureGoogleOption(googleRef);}await loadFont(next.font);state=next;render();tell('Project opened.');e.target.value='';
});
function ensureGoogleOption(ref){let o=$('#font-select option[value="google"]');if(!o){o=new Option('','google');$('#font-select').add(o);}o.textContent=`${ref.family} / ${ref.style} · Google Fonts`;}
function ensureCustomOption(){if(!$('#font-select option[value="custom"]'))$('#font-select').add(new Option('Imported typeface / local','custom'));}
$('#import-font').onclick=()=>{$('#font-dialog').showModal();openGoogleFonts().catch(e=>{$('#gf-count').textContent=e.message;});};$('#close-font-dialog').onclick=()=>$('#font-dialog').close();
// Google Fonts browser: a pinned catalogue (tools/build-google-catalog.mjs).
async function openGoogleFonts(){
  if(!googleCatalog){
    $('#gf-count').textContent='Loading the catalogue…';
    const r=await fetch('/google-fonts/catalog.json');if(!r.ok)throw Error('The Google Fonts catalogue could not be loaded.');
    googleCatalog=await r.json();
    for(const c of [...new Set(googleCatalog.families.map(f=>f.c))].sort())$('#gf-category').add(new Option(c,c));
  }
  googleResults();
}
function googleResults(){
  const q=$('#gf-search').value.trim().toLowerCase(),cat=$('#gf-category').value;
  const matches=googleCatalog.families.filter(f=>(!cat||f.c===cat)&&(!q||f.n.toLowerCase().includes(q)||f.d.toLowerCase().includes(q)));
  $('#gf-results').replaceChildren(...matches.slice(0,60).map(f=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(googlePick===f));b.dataset.dir=f.dir;const name=document.createElement('span');name.textContent=f.n;const meta=document.createElement('small');meta.textContent=`${f.c} · ${f.files.length} file${f.files.length>1?'s':''}`;b.append(name,meta);b.onclick=()=>pickGoogleFamily(f);return b;}));
  $('#gf-count').textContent=`${matches.length} of ${googleCatalog.families.length} families${matches.length>60?' · showing the 60 most popular, refine your search':''} · google/fonts@${googleCatalog.commit.slice(0,7)}`;
}
function pickGoogleFamily(f){
  googlePick=f;$('#gf-pick').hidden=false;$('#gf-detail').textContent=`${f.n}${f.d?` by ${f.d}`:''} · ${f.c}`;
  $('#gf-style').replaceChildren(...f.files.map(([file,label,size],i)=>new Option(`${label} (${Math.max(1,Math.round(size/1024))} kB)`,String(i))));
  const regular=f.files.findIndex(([,label])=>label==='Regular'||(/^Variable ·/.test(label)));$('#gf-style').value=String(Math.max(0,regular));
  googleStyleNote();for(const b of $('#gf-results').children)b.setAttribute('aria-selected',String(b.dataset.dir===f.dir));
}
function googleStyleNote(){const label=googlePick?.files[+$('#gf-style').value]?.[1]||'';$('#gf-note').textContent=label.startsWith('Variable')?'Variable font: DarkskyForge edits its default instance, and exported fonts are static.':'';}
$('#gf-search').oninput=()=>googleCatalog&&googleResults();$('#gf-category').onchange=()=>googleCatalog&&googleResults();$('#gf-style').onchange=googleStyleNote;
$('#gf-import').onclick=async()=>{
  try{
    const [file,label]=googlePick.files[+$('#gf-style').value];
    const ref=googleFontRef({commit:googleCatalog.commit,dir:googlePick.dir,file,family:googlePick.n,style:label});
    $('#gf-import').disabled=true;$('#gf-import').textContent='Downloading…';
    const previous=googleRef;googleRef=ref;
    try{await loadFont('google');}catch(e){googleRef=previous;throw e;}
    undo=[];redo=[];ensureGoogleOption(ref);state.font='google';state.googleFont=ref;state.glyphs={};state.metrics={};state.kerning={};state.ligatures={};render();$('#font-dialog').close();$('#font-import-error').textContent='';
    tell(`${ref.family} ${ref.style} imported from Google Fonts with its OFL licence.`);
  }catch(e){$('#font-import-error').textContent=e.message;}
  finally{$('#gf-import').disabled=false;$('#gf-import').textContent='Import from Google Fonts ↗';}
};
$('#load-custom-font').onclick=async()=>{
  try{
    const file=$('#custom-font-file').files[0],lic=$('#custom-license-file').files[0];
    if(!file||!lic)throw Error('Choose both a font and its original licence.');if(file.size>4*1024*1024||lic.size>100000)throw Error('Use a font under 4 MiB and licence under 100 KB.');
    const text=await lic.text(),parsedLicense=readLicense(text);if(!parsedLicense.ofl)throw Error('The full SIL OFL 1.1 is required. Other licences are not supported yet.');
    const bytes=await file.arrayBuffer();opentype.parse(bytes.slice(0));
    // Clear history on a new imported source so undo cannot attach old outlines to a new font.
    undo=[];redo=[];customSource={bytes,license:parsedLicense};ensureCustomOption();await loadFont('custom');state.font='custom';state.glyphs={};state.metrics={};state.kerning={};state.ligatures={};render();$('#font-dialog').close();$('#font-import-error').textContent='';tell('Font loaded on your device. Save a project file to keep it.');
  }catch(e){$('#font-import-error').textContent=e.message;}
};
for(const [id,key] of [['wordmark','text'],['tagline','tagline'],['tracking','tracking'],['type-size','size'],['color','color'],['accent','accent'],['background','background'],['symbol','symbol'],['font-name','fontName'],['transparent','transparent']]){
  const input=$('#'+id);input.addEventListener('focus',()=>{input.dataset.before=JSON.stringify(state);});
  input.addEventListener('input',()=>{state[key]=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;render();});
  input.addEventListener('change',()=>{if(input.dataset.before&&input.dataset.before!==JSON.stringify(state)){undo.push(input.dataset.before);redo=[];}input.dataset.before=JSON.stringify(state);render();});
}
$('#font-select').onchange=run(async e=>{const next=e.target.value;await loadFont(next);remember();state.font=next;if(next==='google')state.googleFont=googleRef;else delete state.googleFont;state.glyphs={};state.metrics={};state.kerning={};state.ligatures={};render();});
async function travel(from,to){if(!from.length)return;const next=validateProject(JSON.parse(from[from.length-1]));await loadFont(next.font);to.push(JSON.stringify(state));from.pop();state=next;selectedPoint=null;drawPoints=[];render();}
$('#undo').onclick=run(()=>travel(undo,redo));$('#redo').onclick=run(()=>travel(redo,undo));$('#glyph-undo').onclick=run(()=>travel(undo,redo));
$('#toggle-grid').onclick=e=>{const on=$('#artboard').classList.toggle('grid');e.target.setAttribute('aria-pressed',String(on));};
const presets={signal:{text:'SIGNAL',symbol:'brackets',color:'#c5a3ff',accent:'#67e8df',background:'#090c15'},orbital:{text:'ORBITAL',symbol:'orbit',color:'#a6f5de',accent:'#65bbff',background:'#08171c'},phantom:{text:'PHANTOM',symbol:'diamond',color:'#f3a9cf',accent:'#d1c5ff',background:'#16101e'}};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{remember();Object.assign(state,presets[b.dataset.preset]);render();});
function setMode(next){mode=next;for(const m of ['logo','glyph','theme'])$('#'+m+'-workspace').hidden=m!==mode;document.querySelectorAll('nav [data-mode]').forEach(b=>{if(b.dataset.mode===mode)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('#workspace-title').innerHTML={logo:'Forge your signature<span>.</span>',glyph:'Shape every letter<span>.</span>',theme:'Set your own atmosphere<span>.</span>'}[mode];$('#workspace-subtitle').textContent={logo:'From the first letter to the last pixel. Make a mark of your own.',glyph:'A familiar typeface. An unfamiliar possibility. Make it yours.',theme:'The Cybercore palette engine, right here in your creative workspace.'}[mode];if(mode==='glyph')renderGlyph();}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
function showInfo(title,text){$('#dialog-title').textContent=title;$('#dialog-content').textContent=text;$('#info-dialog').showModal();}
$('#close-dialog').onclick=()=>$('#info-dialog').close();$('#view-license').onclick=()=>showInfo('Font licence',license.text);
$('#about-button').onclick=()=>showInfo('DarkskyForge','An open creative toolkit by Darkstardevx / Cybercore.\n\nFonts and projects are processed on your device. No accounts, analytics, tracking, or uploaded documents. Browser storage holds your current built-in-font project and custom themes. Imported fonts stay in this session; save a project file to keep them.\n\nFonts: '+FONT_LIBRARY.length+' open-source typefaces, each under the SIL Open Font License 1.1 and shipped with its licence. Use Read font licence for the complete original text.\n\nTechnology: Cybercore (MIT), opentype.js (MIT), fflate (MIT), brotli-wasm (Apache-2.0) with Google Brotli (MIT), Vite (MIT).\n\nFont exports are renamed subsets (OTF, TTF and/or WOFF2) containing your composition characters and edited glyphs. Custom kerning and ligatures are included. Source hinting and other advanced shaping are not retained.\n\nhttps://github.com/cybercoretech/DarkskyForge\nhttps://openfontlicense.org/ofl-faq/');

// Glyph lab: source coordinates are kept in font units, independent of preview scale.
function character(){return [...$('#glyph-character').value][0]||'D';}
function commands(){return glyphCommands(font,character(),state.glyphs);}
function renderGlyph(){
  if(!font)return;const c=character(),cmds=commands(),p=pathFrom(cmds),u=font.unitsPerEm;
  const bounds=p.getBoundingBox(),left=Math.min(-u*.15,bounds.x1-u*.1),top=-Math.max(font.ascender,bounds.y2)-u*.1,width=Math.max(u*1.3,bounds.x2-left+u*.15),height=Math.max(u*1.4,font.ascender-font.descender+u*.2);
  $('#glyph-canvas').setAttribute('viewBox',`${left} ${top} ${width} ${height}`);
  const radius=u*.009;
  let contents=`<path d="M ${left} 0 H ${left+width} M 0 ${top} V ${top+height} M ${left} ${-font.ascender} H ${left+width}" stroke="#34445e" stroke-width="${u*.0015}" stroke-dasharray="${u*.008} ${u*.006}"/><g transform="scale(1 -1)"><path d="${p.toPathData({flipY:false,decimalPlaces:2})}" fill="#c5a3ff22" stroke="#c5a3ff" stroke-width="${u*.002}"/>`;
  cmds.forEach((cmd,index)=>{
    if('x1'in cmd)contents+=`<path d="M ${cmd.x} ${cmd.y} L ${cmd.x1} ${cmd.y1}${'x2'in cmd?` M ${cmd.x} ${cmd.y} L ${cmd.x2} ${cmd.y2}`:''}" stroke="#80659c" stroke-width="${u*.001}"/>`;
    for(const suffix of ['', '1', '2'])if(('x'+suffix)in cmd)contents+=`<circle class="glyph-point ${suffix?'control':''} ${selectedPoint?.index===index&&selectedPoint?.suffix===suffix?'selected':''}" data-index="${index}" data-suffix="${suffix}" cx="${cmd['x'+suffix]}" cy="${cmd['y'+suffix]}" r="${radius}"/>`;
  });
  if(drawPoints.length)contents+=`<polyline points="${drawPoints.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#67e8df" stroke-width="${u*.003}"/>`;
  const advance=state.metrics[c]??font.charToGlyph(c).advanceWidth??u;
  contents+=`<path d="M ${advance} ${font.descender} V ${font.ascender+u*.1}" stroke="#67e8df88" stroke-width="${u*.002}"/><circle class="bearing-handle" data-bearing="left" cx="${bounds.x1}" cy="${font.ascender+u*.06}" r="${u*.017}"/><circle class="bearing-handle" data-bearing="right" cx="${advance}" cy="${font.ascender+u*.06}" r="${u*.017}"/>`;
  $('#glyph-canvas').innerHTML=contents+'</g>';
  $('#left-bearing').value=Math.round(bounds.x1);$('#right-bearing').value=Math.round(advance-bounds.x2);
  typographyTools?.refresh();
  $('#glyph-detail').textContent=`${c} · ${cmds.length} commands · ${u} units/em`;
  const selected=selectedPoint&&cmds[selectedPoint.index];
  for(const axis of ['x','y']){$('#point-'+axis).value=selected?Math.round(selected[axis+selectedPoint.suffix]):'';$('#point-'+axis).disabled=!selected;}
}
$('#glyph-character').oninput=()=>{selectedPoint=null;drawPoints=[];renderGlyph();};
$('#glyph-tool').onchange=()=>{drawPoints=[];renderGlyph();};
function fontPoint(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('#glyph-canvas').getScreenCTM().inverse());return{x:Math.round(p.x),y:-Math.round(p.y)};}
$('#glyph-canvas').onpointerdown=e=>{
  if(!font)return;
  const point=fontPoint(e);
  if($('#glyph-tool').value==='draw'){drawPoints.push(point);renderGlyph();return;}
  const bearing=e.target.closest('.bearing-handle');
  if(bearing){e.preventDefault();dragging=bearing.dataset.bearing;glyphBefore=JSON.stringify(state);$('#glyph-canvas').setPointerCapture(e.pointerId);return;}
  const hit=e.target.closest('.glyph-point');if(!hit)return;
  e.preventDefault();selectedPoint={index:Number(hit.dataset.index),suffix:hit.dataset.suffix};dragging=true;glyphBefore=JSON.stringify(state);$('#glyph-canvas').setPointerCapture(e.pointerId);$('#glyph-canvas').focus();renderGlyph();
};
$('#glyph-canvas').onpointermove=e=>{
  if(typeof dragging==='string'){const p=fontPoint(e),b=pathFrom(commands()).getBoundingBox();setBearing(dragging,dragging==='left'?p.x:p.x-b.x2);renderGlyph();return;}
  if(!dragging||!selectedPoint)return;const c=commands(),p=fontPoint(e),cmd=c[selectedPoint.index];cmd['x'+selectedPoint.suffix]=Math.max(-10000,Math.min(10000,p.x));cmd['y'+selectedPoint.suffix]=Math.max(-10000,Math.min(10000,p.y));state.glyphs[character()]=c;renderGlyph();
};
function finishDrag(){if(!dragging)return;dragging=null;if(glyphBefore!==JSON.stringify(state)){undo.push(glyphBefore);redo=[];}render();}
$('#glyph-canvas').onpointerup=finishDrag;$('#glyph-canvas').onpointercancel=finishDrag;
$('#glyph-canvas').onkeydown=e=>{if(!selectedPoint||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();remember();const c=commands(),axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?'x':'y',delta=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*(e.shiftKey?10:1);c[selectedPoint.index][axis+selectedPoint.suffix]+=delta;state.glyphs[character()]=c;render();};
$('#apply-point').onclick=run(()=>{if(!selectedPoint)throw Error('Select a point first.');const x=Number($('#point-x').value),y=Number($('#point-y').value);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>10000||Math.abs(y)>10000)throw Error('Use coordinates between −10000 and 10000.');remember();const c=commands();Object.assign(c[selectedPoint.index],{['x'+selectedPoint.suffix]:x,['y'+selectedPoint.suffix]:y});state.glyphs[character()]=c;render();});
$('#finish-contour').onclick=run(()=>{if(drawPoints.length<3)throw Error('Draw at least three points before closing a contour.');remember();state.glyphs[character()]=[...commands(),...drawPoints.map((p,i)=>({type:i?'L':'M',...p})),{type:'Z'}];drawPoints=[];render();});
$('#reset-glyph').onclick=()=>{remember();delete state.glyphs[character()];delete state.metrics[character()];drawPoints=[];selectedPoint=null;render();};
function setBearing(side,value){
  const c=character(),cmds=commands(),bounds=pathFrom(cmds).getBoundingBox(),advance=state.metrics[c]??font.charToGlyph(c).advanceWidth??font.unitsPerEm;
  if(!Number.isFinite(value)||Math.abs(value)>5000)return;
  if(side==='left'){const delta=value-bounds.x1;for(const cmd of cmds)for(const key of ['x','x1','x2'])if(key in cmd)cmd[key]+=delta;state.glyphs[c]=cmds;state.metrics[c]=Math.max(1,Math.min(10000,advance+delta));}
  else state.metrics[c]=Math.max(1,Math.min(10000,bounds.x2+value));
}
for(const side of ['left','right'])$('#'+side+'-bearing').onchange=()=>{remember();setBearing(side,Number($('#'+side+'-bearing').value));render();};
$('#clear-glyph').onclick=()=>{remember();state.glyphs[character()]=[];selectedPoint=null;drawPoints=[];render();};
$('#import-svg').onclick=()=>$('#svg-file').click();
async function importSVG(file){
  if(!file)return;if(file.size>1000000)throw Error('Use an SVG under 1 MB.');
  const doc=new DOMParser().parseFromString(await file.text(),'image/svg+xml');
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw Error('Invalid SVG.');
  // Extract only path geometry. Never attach imported SVG markup to the live DOM.
  if(doc.querySelector('[transform], use, rect, circle, ellipse, polygon, polyline, text, image'))throw Error('Convert shapes to paths and flatten transforms before importing.');
  const paths=[...doc.querySelectorAll('path')];if(!paths.length)throw Error('This SVG has no outline paths.');
  const combined=new opentype.Path();for(const p of paths){const d=p.getAttribute('d');if(d&&d.length<300000)combined.extend(opentype.Path.fromSVG(d,{flipY:false}));}
  const b=combined.getBoundingBox(),height=b.y2-b.y1;if(!height||!Number.isFinite(height))throw Error('This SVG has no usable outline.');
  const scale=font.ascender/height;const cmds=combined.commands.map(c=>{const out={...c};for(const k of ['x','x1','x2'])if(k in out)out[k]=(out[k]-b.x1)*scale+font.unitsPerEm*.05;for(const k of ['y','y1','y2'])if(k in out)out[k]=(b.y2-out[k])*scale;return out;});
  validateProject({...state,glyphs:{...state.glyphs,[character()]:cmds}});remember();state.glyphs[character()]=cmds;state.metrics[character()]=Math.min(10000,(b.x2-b.x1)*scale+font.unitsPerEm*.1);selectedPoint=null;render();tell('SVG outline imported into this glyph.');
}
$('#svg-file').onchange=run(async e=>{await importSVG(e.target.files[0]);e.target.value='';});
$('#glyph-canvas').ondragover=e=>e.preventDefault();$('#glyph-canvas').ondrop=run(async e=>{e.preventDefault();await importSVG(e.dataTransfer.files[0]);});
typographyTools=typography({getState:()=>state,getFont:()=>font,getLicense:()=>license,remember,render,tell});
$('#export-font').onclick=run(async()=>{
  const want={otf:$('#format-otf').checked,ttf:$('#format-ttf').checked,woff2:$('#format-woff2').checked};
  if(!want.otf&&!want.ttf&&!want.woff2)throw Error('Choose at least one font format.');
  const base=safeName(state.fontName),otf=buildFont(font,state,license),files={...licenseFiles(),'darksky-project.json':strToU8(projectJSON())};
  if(want.otf)files[`${base}.otf`]=new Uint8Array(otf);
  if(want.ttf||want.woff2){
    const ttf=otfToTtf(otf);if(want.ttf)files[`${base}.ttf`]=new Uint8Array(ttf);
    if(want.woff2){tell('Compressing WOFF2…');files[`${base}.woff2`]=new Uint8Array(await toWoff2(ttf));files[`${base}.css`]=strToU8(fontFaceCSS(state.fontName,base,want));}
  }
  zipDownload(`${base}-font.zip`,files);tell(`Renamed font subset exported (${Object.keys(want).filter(k=>want[k]).map(k=>k.toUpperCase()).join(', ')}) with its original licence.`);
});
function fontFaceCSS(family,base,want){const src=[want.woff2&&`url("${base}.woff2") format("woff2")`,want.ttf&&`url("${base}.ttf") format("truetype")`,want.otf&&`url("${base}.otf") format("opentype")`].filter(Boolean).join(',\n       ');return `/* ${family}: generated by DarkskyForge. Licence: OFL.txt */\n@font-face {\n  font-family: "${family.replace(/["\\]/g,'')}";\n  src: ${src};\n  font-display: swap;\n}\n`;}

// The Rust engine is the only validator / pack importer / CSS generator.
function customJSON(){return JSON.stringify(customThemes);}
function themeOptions(selected){const select=$('#theme-select');select.replaceChildren();for(const t of [...allThemes,...customThemes])select.add(new Option(`${t.metadata.name} / ${t.metadata.family}`,t.metadata.id));if(selected)select.value=selected;}
function themeDocument(){return JSON.stringify(currentTheme);}
function refreshTheme(){
  if(!engine||!currentTheme)return;const appearance=$('#theme-appearance').value,palette=currentTheme.variants?.[appearance]||currentTheme.palette;
  $('#theme-colors').replaceChildren();
  for(const [role,value] of Object.entries(palette)){
    const label=document.createElement('label'),input=document.createElement('input');input.type='color';input.value='#'+value;input.setAttribute('aria-label',role);label.append(input,role.replaceAll('_',' '));$('#theme-colors').append(label);
    input.oninput=()=>{if(appearance==='light'&&!currentTheme.variants.light)currentTheme.variants.light=structuredClone(currentTheme.palette);const p=appearance==='light'?currentTheme.variants.light:currentTheme.palette;p[role]=input.value.slice(1);refreshThemePreview();};
  }
  refreshThemePreview();
}
function refreshThemePreview(){
  const appearance=$('#theme-appearance').value,palette=currentTheme.variants?.[appearance]||currentTheme.palette;
  for(const [role,value]of Object.entries(palette))$('#theme-preview').style.setProperty('--sample-'+role,'#'+value);
  const report=JSON.parse(engine.validate_theme(themeDocument()));
  $('#contrast-report').replaceChildren();
  const note=document.createElement('p');note.className='hint';note.textContent=report.has_explicit_light_variant?'Explicit light variant included.':'Light uses the base palette until you edit a light colour.';$('#contrast-report').append(note);
  for(const check of report.checks.filter(c=>c.appearance===appearance)){const row=document.createElement('div');row.className='contrast-row';const name=document.createElement('span'),result=document.createElement('span');name.textContent=check.label;result.textContent=`${check.ratio.toFixed(2)}:1 / ${check.passes?'PASS':'LOW'}`;result.className=check.passes?'pass':'warn';row.append(name,result);$('#contrast-report').append(row);}
}
function customDocument(){const doc=structuredClone(currentTheme),name=$('#theme-name').value.trim();if(!name)throw Error('Give your custom theme a name.');doc.metadata.id='custom-'+safeName(name).slice(0,55);doc.metadata.name=name;doc.metadata.family='darkskyforge';doc.metadata.author='';engine.validate_theme(JSON.stringify(doc));return doc;}
function persistThemes(themes){localStorage.setItem(themeKey,JSON.stringify(themes));customThemes=themes;}
$('#theme-select').onchange=()=>{currentTheme=structuredClone([...allThemes,...customThemes].find(t=>t.metadata.id===$('#theme-select').value));refreshTheme();};$('#theme-appearance').onchange=refreshTheme;
$('#save-theme').onclick=run(()=>{const doc=customDocument(),next=customThemes.filter(t=>t.metadata.id!==doc.metadata.id);next.push(doc);persistThemes(next);themeOptions(doc.metadata.id);currentTheme=doc;refreshTheme();tell('Custom theme saved in this browser.');});
$('#export-theme').onclick=run(()=>{if(!engine)throw Error('Theme engine is not ready.');const doc=customDocument(),text=JSON.stringify(doc,null,2);zipDownload(`${doc.metadata.id}.zip`,{[doc.metadata.id+'.json']:strToU8(text),'dark.css':strToU8(engine.theme_css(text,'dark')),'light.css':strToU8(engine.theme_css(text,'light')),'quality-report.json':strToU8(engine.validate_theme(text)),'LICENSE-MIT.txt':strToU8(awaitText.license)});tell('Theme and CSS exported.');});
$('#export-family').onclick=run(()=>{const selected=[...allThemes,...customThemes].find(t=>t.metadata.id===$('#theme-select').value);const pack=engine.export_family(customJSON(),selected.metadata.family);blobDownload(`${safeName(selected.metadata.family)}.cyberpack.json`,new Blob([pack],{type:'application/json'}));tell('Saved family exported. Unsaved colour edits are not included.');});
$('#import-pack').onclick=()=>$('#pack-file').click();
$('#pack-file').onchange=run(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>4*1024*1024)throw Error('Theme packs must be under 4 MiB.');const text=await file.text();const conflicts=JSON.parse(engine.pack_conflicts(customJSON(),text));const result=JSON.parse(engine.import_pack(customJSON(),text,$('#pack-policy').value));persistThemes(result.themes);themeOptions(result.report.imported[0]||currentTheme.metadata.id);$('#theme-select').onchange();tell(`Imported ${result.report.imported.length}; skipped ${result.report.skipped.length}. ${conflicts.builtin.length} protected built-in conflicts.`);e.target.value='';});
$('#use-theme-colors').onclick=()=>{if(!currentTheme)return;remember();const p=currentTheme.variants?.[$('#theme-appearance').value]||currentTheme.palette;state.background='#'+p.bg;state.color='#'+p.purple;state.accent='#'+p.cyan;render();setMode('logo');};
const awaitText={license:''};
async function startThemes(){
  try{
    engine=await import('./theme-engine/cybercore_theme_wasm.js');await engine.default();
    allThemes=JSON.parse(engine.builtin_themes());
    try{const saved=JSON.parse(localStorage.getItem(themeKey)||'[]');if(!Array.isArray(saved))throw Error('Invalid saved themes');const ids=new Set(allThemes.map(t=>t.metadata.id));for(const t of saved){engine.validate_theme(JSON.stringify(t));if(ids.has(t.metadata.id))throw Error('Built-in collision');ids.add(t.metadata.id);}customThemes=saved;}catch{customThemes=[];tell('Saved themes could not be loaded. Built-in themes are available.',true);}
    const response=await fetch('/theme-engine/LICENSE-MIT');if(!response.ok)throw Error('Theme engine licence is missing.');awaitText.license=await response.text();
    themeOptions();currentTheme=structuredClone(allThemes.find(t=>t.metadata.id==='cybergrid')||allThemes[0]);$('#theme-select').value=currentTheme.metadata.id;refreshTheme();$('#engine-state').textContent=`${allThemes.length} THEMES / ENGINE READY`;
  }catch(e){$('#engine-state').textContent='ENGINE UNAVAILABLE';for(const id of ['save-theme','export-theme','export-family','import-pack','use-theme-colors'])$('#'+id).disabled=true;tell('Theme engine failed to load: '+(e.message||e),true);}
}
function fontOptions(){
  const select=$('#font-select');select.replaceChildren();
  for(const group of FONT_GROUPS){const og=document.createElement('optgroup');og.label=group;for(const f of FONT_LIBRARY.filter(f=>f.group===group))og.append(new Option(`${f.name} / ${f.style.split(' · ')[0]}`,f.id));if(og.children.length)select.append(og);}
}
async function start(){
  fontOptions();$('#symbol').replaceChildren(...SYMBOLS.map(sym=>new Option(sym.label,sym.id)));
  try{const saved=localStorage.getItem(storeKey);if(saved)state=validateProject(JSON.parse(saved));}catch{tell('Saved project could not be loaded. Starting a new composition.',true);}
  if(state.font==='google'){googleRef=state.googleFont;ensureGoogleOption(googleRef);}
  try{await loadFont(state.font);render();document.body.dataset.ready='true';}catch(e){tell('Could not load the typeface: '+e.message,true);}
}
await Promise.all([start(),startThemes()]);
