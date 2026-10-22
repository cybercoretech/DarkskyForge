import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const core=resolve(process.env.CYBERCORE_SOURCE||resolve(root,'../../framework/cybercore'));
function run(command,args){const result=spawnSync(command,args,{cwd:core,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||result.stdout||`${command} failed`);return result.stdout.trim();}
const version=run('wasm-bindgen',['--version']);if(version!=='wasm-bindgen 0.2.129')throw Error('Install wasm-bindgen-cli 0.2.129 to match the pinned core dependency.');
run('cargo',['build','--locked','-p','cybercore-theme-wasm','--release','--target','wasm32-unknown-unknown']);
const metadata=JSON.parse(run('cargo',['metadata','--no-deps','--format-version','1']));
run('wasm-bindgen',['--target','web','--out-dir',resolve(root,'src/theme-engine'),resolve(metadata.target_directory,'wasm32-unknown-unknown/release/cybercore_theme_wasm.wasm')]);
mkdirSync(resolve(root,'public/theme-engine'),{recursive:true});
copyFileSync(resolve(core,'LICENSE-MIT'),resolve(root,'public/theme-engine/LICENSE-MIT'));
writeFileSync(resolve(root,'src/theme-engine/provenance.json'),JSON.stringify({repository:'https://github.com/cybercoretech/cybercore',commit:run('git',['rev-parse','HEAD']),dirty:!!run('git',['status','--porcelain']),bindings:version},null,2)+'\n');
console.log('Built Cybercore browser engine.');
