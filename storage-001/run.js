import { IndexedSaves } from './persistence/browser/indexed-saves.js';
import { newProfile } from './persistence/profile.js';
import { scenario } from './scenario.js';

const run=document.querySelector('#run'), report=document.querySelector('#report');
const key='rift-test:'+location.pathname;
const catalog=new Map();
const profile=newProfile('profile:alpha'), other=newProfile('profile:beta');
const character={version:1,id:'saved-character:one',profileId:profile.id,level:1,experience:0,
  template:null,race:'race:test',class:'class:test',subclass:null,skills:[],selectedBoons:[],category:null,manifestation:null};
let memory=JSON.parse(sessionStorage.getItem(key)??'null');
let checks=memory?.checks??[];
function assert(name,ok){checks.push({name,status:ok?'PASS':'FAIL'});if(!ok)throw Error(name);}
async function execute(){
  run.disabled=true;
  const id=memory?.id??crypto.randomUUID();
  if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid diagnostic identifier');
  const name='rift-diagnostic-'+id;
  const open=()=>IndexedSaves.open(indexedDB,name,catalog);
  const handles=[];
  const connect=async()=>{const db=await open();handles.push(db);return db;};
  let reloading=false;
  try {
    const db=await connect();
    await scenario({db,connect,catalog,profile,other,character,assert,name,resumed:!!memory});
    if(!memory){
      for(const handle of handles)handle.close();
      sessionStorage.setItem(key,JSON.stringify({id,checks}));reloading=true;location.reload();return;
    }
  }catch(e){checks.push({name:'Execution',status:'FAIL',error:e.name});}
  finally{
    if(!reloading){
      for(const handle of handles)handle.close();
      sessionStorage.removeItem(key);
      const req=indexedDB.deleteDatabase(name);
      const clean=await new Promise(resolve=>{req.onsuccess=()=>resolve(true);req.onerror=req.onblocked=()=>resolve(false);});
      checks.push({name:'Isolated database removed',status:clean?'PASS':'FAIL'});
      report.textContent=JSON.stringify({scenario:location.pathname,reloaded:!!memory,checks},null,2);
      run.disabled=false;
    }
  }
}
run.addEventListener('click',()=>{memory=null;checks=[];execute();});run.disabled=false;report.textContent='Ready';
if(memory)execute();
