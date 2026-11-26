import { trustedTouch } from './touch.js';
const byId=id=>document.getElementById(id);
const run=byId('run'),copy=byId('copy'),report=byId('report'),status=byId('status');
let result, epoch=0;
function refresh(){report.value=JSON.stringify(result,null,2);}
function check(name,ok,observed){result.checks.push({name,status:ok?'PASS':'FAIL',observed});refresh();}
async function frame(host,file,width) {
  const f=document.createElement('iframe'); f.title=file==='fixture.html'?'Component fixture':'Original shell';
  if(width) f.style.width=width+'px';
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('load-timeout')),8000);
    f.onload=()=>{clearTimeout(timer);resolve();};
  });
  f.src='./'+file;host.replaceChildren(f);await ready;
  if(file==='fixture.html') await f.contentWindow.fixtureModule;
  return {d:f.contentDocument,w:f.contentWindow};
}
async function fingerprint() {
  const r=await fetch('manifest.json',{cache:'no-store'});
  if(!r.ok) throw Error('manifest');
  const m=await r.json();result.source=m.source;result.build=m.build;
  if(m.build!=='components-003'||!/^([a-f0-9]{40})$/.test(m.source))throw Error('manifest');
  for(const [name,hash] of Object.entries(m.assets)){
    if(!/^[a-z0-9/-]+\.(?:html|js|css)$/.test(name))throw Error('manifest');
    const response=await fetch(name,{cache:'no-store'});
    const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
    const actual=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    if(!response.ok || actual!==hash)throw Error('asset');
  }
  check('Served asset fingerprint',true,Object.keys(m.assets).length);
}
function observeInput(d,w,token) {
  const button=d.querySelector('[data-action-role=basic]'),out=d.querySelector('output');
  let seq=[],key=false,before=0;
  const event=e=>({type:e.type,trusted:e.isTrusted,pointerId:e.pointerId,pointerType:e.pointerType});
  button.addEventListener('pointerdown',e=>{before=Number(out.value);seq=[event(e)];key=false;});
  button.addEventListener('pointerup',e=>seq.push(event(e)));
  button.addEventListener('pointercancel',()=>{seq=[];});
  button.addEventListener('keydown',e=>{seq=[];before=Number(out.value);key=e.isTrusted&&['Enter',' '].includes(e.key);});
  button.addEventListener('blur',()=>{seq=[];key=false;});
  button.addEventListener('click',e=>{
    if(token!==epoch)return;
    const once=Number(out.value)===before+1 && button.getAttribute('aria-pressed')==='true';
    const sequence=[...seq,event(e)], validTouch=trustedTouch(sequence);
    if(validTouch)result.touch={status:once&&!w.componentErrors?'PASS':'FAIL',observed:'trusted touch sequence; activation delta '+(Number(out.value)-before)};
    if(key && e.isTrusted && e.detail===0)result.keyboard={status:once&&!w.componentErrors?'PASS':'FAIL',observed:'trusted keyboard activation'};
    result.browserErrors=w.componentErrors+window.componentErrors;seq=[];key=false;refresh();
    status.textContent='Input recorded. Copy Report.';
  });
}
run.addEventListener('click',async()=>{
  const token=++epoch;run.disabled=true;copy.disabled=true;byId('actual').replaceChildren();
  result={build:'components-003',time:new Date().toISOString(),origin:location.origin,path:location.pathname,
    device:{android:/Android/.test(navigator.userAgent),browser:/Chrome\//.test(navigator.userAgent)?'Chrome-compatible':'Other',viewport:innerWidth},
    checks:[],touch:{status:'NOT RUN'},keyboard:{status:'NOT RUN'},scope:'Operator browser; frame widths simulate layout. Physical desktop and full keyboard suite NOT RUN.'};
  refresh();
  try{
    await fingerprint();
    const shell=await frame(byId('lab'),'shell.html',360);
    const smoke=shell.d.querySelector('#check'),out=shell.d.querySelector('#status');
    const initial=out.value;smoke.click();
    check('Original served module and synthetic smoke',initial==='Development shell ready'&&out.value==='Development check passed'&&!shell.w.componentErrors,out.value);
    for(const width of new Set([360,1280,byId('actual').clientWidth])){
      const {d,w}=await frame(byId('lab'),'fixture.html',width),region=d.querySelector('section'),trigger=d.querySelector('[aria-controls]');
      const body=d.getElementById(trigger.getAttribute('aria-controls'));
      check('Named region and closed disclosure '+width,d.getElementById(region.getAttribute('aria-labelledby')).textContent==='Action choices'&&body.hidden&&trigger.getAttribute('aria-expanded')==='false',trigger.textContent);
      trigger.click();
      const buttons=[...body.querySelectorAll('button')], labels=['Basic Attack','Attack Skill','Spell Skill','Dust'];
      check('Expanded native controls '+width,!body.hidden&&trigger.getAttribute('aria-expanded')==='true'&&buttons.length===4&&buttons.every((b,i)=>b.type==='button'&&b.textContent.startsWith(labels[i])&&b.getBoundingClientRect().height>=44),buttons.length);
      const markers=buttons.map(b=>w.getComputedStyle(b.querySelector('.rift-marker')));
      check('Theme and distinct rendered shapes '+width,new Set(markers.map(m=>m.clipPath+'|'+m.borderRadius)).size===4&&markers.every(m=>m.backgroundColor!=='rgba(0, 0, 0, 0)'),markers.map(m=>m.backgroundColor));
      buttons[0].click();buttons[3].click();
      check('Single synthetic activation and disabled suppression '+width,buttons[3].disabled&&d.querySelector('output').value==='1'&&buttons[0].getAttribute('aria-pressed')==='true',d.querySelector('output').value);
      check('Layout '+width,w.innerWidth===width&&d.documentElement.scrollWidth<=width,d.documentElement.scrollWidth);
      trigger.click();check('Disclosure closed '+width,body.hidden,trigger.getAttribute('aria-expanded'));
      const fixture=await w.fixtureModule;
      fixture.dispose();trigger.click();buttons[0].click();
      check('Disposed handlers and captured errors '+width,body.hidden&&d.querySelector('output').value==='1'&&w.componentErrors===0,w.componentErrors);
    }
    const {d,w}=await frame(byId('actual'),'fixture.html');
    d.querySelector('[aria-controls]').click();
    const target=d.querySelector('[data-action-role=basic]');target.focus();
    check('Visible fixture focus',d.activeElement===target,target.textContent);
    observeInput(d,w,token);
    check('Tester fits device',document.documentElement.scrollWidth<=innerWidth,innerWidth);
    status.textContent='Tap Basic Attack once, then Copy Report.';
  }catch{check('Diagnostic execution',false,'Could not finish served asset or component checks');status.textContent='Check stopped. Copy Report.';}
  finally{byId('lab').replaceChildren();run.disabled=false;copy.disabled=false;refresh();}
});
copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(report.value);status.textContent='Report copied.';}
  catch{report.focus();report.select();status.textContent='Long-press the selected report to copy.';}});
run.disabled=false;status.textContent='Ready.';
