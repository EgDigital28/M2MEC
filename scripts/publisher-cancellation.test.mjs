import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Preserve the actual publisher orchestration; only its external Git/Vercel and
// receipt/queue IO are hermetic fixtures. No remote or Production access occurs.
for (const mode of ['project', 'final-inputs', 'push-started']) test(`publisher cancellation at ${mode} preserves correct publication outcome`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'm2-publisher-cancel-'));
  try {
    mkdirSync(join(root, 'bin'));
    copyFileSync(new URL('./publish-production.mjs', import.meta.url), join(root, 'publish.mjs'));
    writeFileSync(join(root, 'receipt.json'), JSON.stringify({ inputs: { main: 'b'.repeat(40) } }));
    writeFileSync(join(root, 'release-support.mjs'), `
      import { appendFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
      import { dirname } from 'node:path';
      export { runAsync } from ${JSON.stringify(new URL('./release-support.mjs', import.meta.url).href)};
      const head='a'.repeat(40), base='b'.repeat(40); let inputs=0;
      export function atomicJson(path,value){ mkdirSync(dirname(path),{recursive:true}); writeFileSync(path,JSON.stringify(value)); }
      export const receiptPath=()=>process.cwd()+'/receipt.json';
      export function validationInputs(){
        if(++inputs===3 && process.env.CANCEL_AT==='final-inputs'){
          appendFileSync('commands.log','SIGNAL_DURING_FINAL_INPUTS\\n');process.kill(process.pid,'SIGTERM');
        }
        return {main:existsSync('pushed')?head:base,commit:head};
      }
      export function assertReleaseSnapshot(){}
      export function git(...args){
        appendFileSync('commands.log',JSON.stringify(args)+'\\n');
        if(args[0]==='branch')return 'codex/review'; if(args[0]==='status')return '';
        if(args[0]==='remote')return 'https://github.com/EgDigital28/M2MEC.git';
        if(args[0]==='push')throw new Error('Publisher must use cancellable async push');
        if(args[0]==='rev-parse')return args[1]==='origin/main'?(existsSync('pushed')?head:base):head;
        return '';
      }
    `);
    writeFileSync(join(root, 'release-queue.mjs'), "export async function acquireRelease(){return {ticket:{id:'fixture'},assertOwned(){},async release(){}};}");
    writeFileSync(join(root, 'release-verification.mjs'), 'export function requireDeploymentIdentity(){};export function matchesPublicationReceipt(){return true;}');
    writeFileSync(join(root, 'bin/npx'), `#!${process.execPath}
      const fs=require('node:fs');
      if(process.env.CANCEL_AT==='project'){fs.appendFileSync('commands.log','SIGNAL_DURING_PROJECT_CHECK\\n');process.kill(process.ppid,'SIGTERM');}
      console.log(JSON.stringify({id:'prj_MNkLOiIWXD9Ai1aAxi0RkcU62OtQ',name:'m2-mec',link:{type:'github',org:'EgDigital28',repo:'M2MEC',productionBranch:'main'}}));
    `, { mode: 0o700 });
    writeFileSync(join(root, 'bin/git'), `#!${process.execPath}
      const fs=require('node:fs');
      if(process.argv[2]==='push'){
        fs.appendFileSync('commands.log','SIMULATED_MAIN_PUSH\\n');
        fs.writeFileSync('pushed','yes');
        process.kill(process.ppid,'SIGTERM');setTimeout(()=>process.exit(1),100);
      }
    `, { mode: 0o700 });
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['publish.mjs','--execute','--expected-sha','a'.repeat(40)], { cwd: root, env: { ...process.env, PATH: `${join(root,'bin')}:${process.env.PATH}`, CANCEL_AT: mode }, stdio: ['ignore','pipe','pipe'], timeout: 10000 });
      let output=''; child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
      child.once('error',reject);child.once('close',code=>resolve({code,output}));
    });
    assert.equal(result.code,1,result.output);
    const commands=readFileSync(join(root,'commands.log'),'utf8');
    const manifest=JSON.parse(readFileSync(join(root,'.release/manifests/latest-attempt.json'),'utf8'));
    if(mode==='push-started'){
      assert.match(commands,/SIMULATED_MAIN_PUSH/);assert.equal(manifest.publicationOutcome,'uncertain');
    }else{
      assert.doesNotMatch(commands,/SIMULATED_MAIN_PUSH/);assert.equal(manifest.publicationOutcome,'not_started');
    }
    assert.equal(manifest.status,'stopped');assert.equal(manifest.published,false);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
