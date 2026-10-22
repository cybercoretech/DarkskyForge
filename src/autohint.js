// Runs ttfautohint (compiled to WebAssembly, src/autohint/) on a TrueType font
// held in memory. `m` is the instantiated module; the worker and the Node
// tests share this so both exercise exactly the same calls.
export const AUTOHINT_DEFAULTS={min:8,max:50,limit:200,xHeight:14};
export function autohintWith(m,bytes,{min=8,max=50,limit=200,xHeight=14,symbol=false}={}){
  const input=m._malloc(bytes.length),outPtrPtr=m._malloc(4);
  try{
    m.HEAPU8.set(bytes,input);
    const length=m._dsf_autohint(input,bytes.length,outPtrPtr,min,max,limit,xHeight,symbol?1:0);
    if(length<0)throw Error(`ttfautohint: ${m.UTF8ToString(m._dsf_last_error())||`error ${-length}`}`);
    const out=m.HEAPU32[outPtrPtr>>2],hinted=m.HEAPU8.slice(out,out+length);m._free(out);return hinted;
  }finally{m._free(input);m._free(outPtrPtr);}
}
