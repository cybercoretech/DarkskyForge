import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const build=spawnSync('npm',['run','build'],{cwd:root,stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
const temporary=mkdtempSync(resolve(tmpdir(),'darkskyforge-deploy-'));
try {
 const result=spawnSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'pages','deploy',resolve(root,'dist'),'--project-name','darkskyforge','--branch','main','--commit-dirty=true'],{cwd:temporary,stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'f770e07e62b976b12330421edcf2a7d9'}});
 process.exitCode=result.status||0;
}finally{rmSync(temporary,{recursive:true,force:true});}
