// Autohinting runs off the main thread; the ~1.4 MB module loads on first use.
import createTtfautohint from './autohint/ttfautohint.mjs';
import {autohintWith} from './autohint.js';
let ready;
self.onmessage=async({data})=>{
  try{
    ready??=createTtfautohint();
    const hinted=autohintWith(await ready,new Uint8Array(data.bytes),data.options);
    self.postMessage({id:data.id,bytes:hinted.buffer},[hinted.buffer]);
  }catch(e){self.postMessage({id:data.id,error:e.message||String(e)});}
};
