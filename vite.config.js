import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const headers=Object.fromEntries(readFileSync(new URL('./public/_headers',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('  ')).map(line=>{const at=line.indexOf(':');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
// brotli-wasm's "browser" entry is CommonJS for webpack; use its ES module
// web build, which loads brotli_wasm_bg.wasm as a same-origin asset (CSP-safe).
const brotliWeb=fileURLToPath(new URL('./node_modules/brotli-wasm/index.web.js',import.meta.url));
export default defineConfig({preview:{headers},resolve:{alias:{'brotli-wasm':brotliWeb}},optimizeDeps:{exclude:['brotli-wasm']},worker:{format:'es'}});
