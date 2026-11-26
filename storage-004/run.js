import { IndexedSaves } from './persistence/browser/indexed-saves.js';
import { newProfile } from './persistence/profile.js';
import { scenario } from './scenario.js';

const run=document.querySelector('#run'),copy=document.querySelector('#copy'),report=document.querySelector('#report'),status=document.querySelector('#status');
const key='rift-test:'+location.pathname;
const catalog=new Map(),profile=newProfile('profile:alpha'),other=newProfile('profile:beta');
const character={version:1,id:'saved-character:one',profileId:profile.id,level:1,experience:0,
  template:null,race:'race:test',class:'class:test',subclass:null,skills:[],selectedBoons:[],category:null,manifestation:null};
let memory=JSON.parse(sessionStorage.getItem(key)??'null'),checks=memory?.checks??[],errors=0,source;
for(const type of ['error','unhandledrejection']) addEventListener(type,()=>errors++);
function assert(name,ok){checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw Error(name);}
async function fingerprint(){
  const response=await fetch('manifest.json',{cache:'no-store'}),m=await response.json();
  if(!response.ok||m.build!=='storage-004'||!/^[0-9a-f]{40}$/.test(m.source)||Object.keys(m.assets).length!==11)throw Error('manifest');
  source=m.source;
  if(memory&&memory.source!==source)throw Error('source changed');
  for(const [name,expected] of Object.entries(m.assets)){
    if(!/^[a-z0-9/-]+\.(?:html|js)$/.test(name)||!/^[0-9a-f]{64}$/.test(expected))throw Error('asset');
    const r=await fetch(name,{cache:'no-store'}),bytes=await r.arrayBuffer();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(!r.ok||hash!==expected)throw Error('asset mismatch');
  }
  assert(memory?'Asset fingerprint after reload':'Asset fingerprint',true);
}
async function execute(){
  run.disabled=true;copy.disabled=true;status.textContent='Running checks';
  const id=memory?.id??crypto.randomUUID(),handles=[];
  let name,reloading=false;
  try{
    if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid diagnostic identifier');
    name='rift-diagnostic-'+id;
    await fingerprint();
    const connect=async()=>{const db=await IndexedSaves.open(indexedDB,name,catalog);handles.push(db);return db;};
    const db=await connect();
    await scenario({db,connect,catalog,profile,other,character,assert,name,resumed:!!memory});
    if(!memory){
      for(const handle of handles)handle.close();
      sessionStorage.setItem(key,JSON.stringify({id,checks,source,errors}));reloading=true;location.reload();return;
    }
  }catch(e){checks.push({name:'Execution',status:'FAIL',error:e.name});}
  finally{
    if(!reloading){
      for(const handle of handles)handle.close();
      sessionStorage.removeItem(key);
      if(name){
        const req=indexedDB.deleteDatabase(name);
        const clean=await new Promise(resolve=>{req.onsuccess=()=>resolve(true);req.onerror=req.onblocked=()=>resolve(false);});
        checks.push({name:'Isolated database removed',status:clean?'PASS':'FAIL'});
      }
      report.value=JSON.stringify({build:'storage-004',source,origin:location.origin,path:location.pathname,time:new Date().toISOString(),reloaded:!!memory,browserErrors:errors+(memory?.errors??0),checks},null,2);
      status.textContent='Finished. Copy Report.';run.disabled=false;copy.disabled=false;
    }
  }
}
run.addEventListener('click',()=>{memory=null;checks=[];errors=0;execute();});
copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(report.value);status.textContent='Report copied';}catch{report.focus();report.select();status.textContent='Long-press to copy selected report';}});
run.disabled=false;status.textContent='Ready';if(memory)execute();
