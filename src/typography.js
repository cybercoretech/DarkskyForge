import {buildFont,glyphCommands,pathFrom} from './model.js';
const $=s=>document.querySelector(s);
export function typography(context){
  const {getState,getFont,getLicense,remember,render,tell}=context;
  let pairDrag=null,previewSequence=0,previewFace=null,timer;
  const pair=()=>[...$('#kern-pair').value].slice(0,2);
  function renderPairs(){
    const state=getState(),font=getFont();if(!font)return;
    const [left,right]=pair();if(!left||!right){$('#kern-canvas').replaceChildren();return;}
    const a=font.charToGlyph(left),b=font.charToGlyph(right),adjust=state.kerning[left+right]??font.getKerningValue(a,b),size=130,scale=size/font.unitsPerEm;
    const glyphPath=c=>{const commands=glyphCommands(font,c,state.glyphs).map(cmd=>{const out={...cmd};for(const k of ['x','x1','x2'])if(k in out)out[k]*=scale;for(const k of ['y','y1','y2'])if(k in out)out[k]*=-scale;return out;});return pathFrom(commands).toPathData({flipY:false});};
    const width=(state.metrics[left]??a.advanceWidth??font.unitsPerEm)*scale;
    $('#kern-value').value=adjust;
    $('#kern-canvas').innerHTML=`<path d="M50 160H650" stroke="#354158"/><path d="M${90+width} 15V190" stroke="#67e8df66" stroke-dasharray="4 5"/><path fill="#c5a3ff" d="${glyphPath(left)}" transform="translate(90 160)"/><g class="second-glyph" transform="translate(${90+width+adjust*scale} 160)"><rect x="-20" y="-145" width="${Math.max(100,(state.metrics[right]??b.advanceWidth??font.unitsPerEm)*scale+40)}" height="180" fill="transparent"/><path fill="#67e8df" d="${glyphPath(right)}"/></g>`;
    $('#ligature-map').replaceChildren();
    for(const [from,to]of Object.entries(state.ligatures)){const button=document.createElement('button');button.textContent=`${from} → ${to} ×`;button.title='Remove substitution';button.onclick=()=>{remember();delete state.ligatures[from];render();};$('#ligature-map').append(button);}
  }
  async function refreshTestbed(){
    const font=getFont(),state=getState();if(!font)return;
    const seq=++previewSequence,text=$('#test-text').value.slice(0,300),testState={...state,fontName:'Darksky Preview',text:state.text+text};
    try{
      const bytes=buildFont(font,testState,getLicense()),face=new FontFace('DarkskyPreview'+seq,bytes);await face.load();
      if(seq!==previewSequence)return;document.fonts.add(face);if(previewFace)document.fonts.delete(previewFace);previewFace=face;
      $('#font-testbed').style.fontFamily=`"${face.family}"`;$('#font-testbed').textContent=text;$('#font-testbed').style.fontSize=$('#test-size').value+'px';$('#font-testbed').classList.toggle('light',$('#test-light').checked);
    }catch(e){$('#font-testbed').textContent=e.message;}
  }
  $('#kern-pair').oninput=renderPairs;
  $('#kern-value').onchange=()=>{const key=pair().join(''),value=Number($('#kern-value').value);if([...key].length!==2||!Number.isFinite(value)||Math.abs(value)>10000)return;remember();getState().kerning[key]=Math.round(value);render();};
  $('#kern-canvas').onpointerdown=e=>{if(!e.target.closest('.second-glyph'))return;e.preventDefault();remember();const point=new DOMPoint(e.clientX,e.clientY).matrixTransform($('#kern-canvas').getScreenCTM().inverse());pairDrag={x:point.x,value:Number($('#kern-value').value),key:pair().join('')};$('#kern-canvas').setPointerCapture(e.pointerId);};
  $('#kern-canvas').onpointermove=e=>{if(!pairDrag)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform($('#kern-canvas').getScreenCTM().inverse()),delta=(point.x-pairDrag.x)*getFont().unitsPerEm/130;getState().kerning[pairDrag.key]=Math.round(Math.max(-10000,Math.min(10000,pairDrag.value+delta)));renderPairs();};
  $('#kern-canvas').onpointerup=()=>{if(pairDrag){pairDrag=null;render();}};$('#kern-canvas').onpointercancel=$('#kern-canvas').onpointerup;
  $('#add-ligature').onclick=()=>{const from=$('#ligature-from').value,to=$('#ligature-to').value,font=getFont();if([...from].length<2||[...from].length>4||[...to].length!==1){tell('Use a 2–4 character sequence and one replacement character.',true);return;}if([...from,to].some(c=>!font.charToGlyphIndex(c)&&!getState().glyphs[c])){tell('The source and replacement characters need glyph outlines. Draw or import the replacement first.',true);return;}remember();getState().ligatures[from]=to;render();};
  for(const id of ['test-text','test-size','test-light'])$('#'+id).oninput=()=>{clearTimeout(timer);timer=setTimeout(refreshTestbed,150);};
  return {refresh(){renderPairs();clearTimeout(timer);timer=setTimeout(refreshTestbed,200);}};
}
