import {defineConfig} from 'vite';
import {readFileSync} from 'node:fs';
const headers=Object.fromEntries(readFileSync(new URL('./public/_headers',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('  ')).map(line=>{const at=line.indexOf(':');return[line.slice(0,at).trim(),line.slice(at+1).trim()];}));
export default defineConfig({preview:{headers}});
