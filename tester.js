import { classifyActivation } from './input-evidence.js';
const $ = id => document.getElementById(id);
const run = $('run'), copy = $('copy'), status = $('status'), report = $('report'), area = $('frame-area'), lab = $('lab');
let result, busy = false, generation = 0;
function refresh() { report.value = JSON.stringify(result, null, 2); copy.disabled = busy; }
function check(name, ok, detail = '') { result.checks.push({name,status:ok?'PASS':'FAIL',detail}); refresh(); }
async function loadFrame(width, host) {
  host.replaceChildren();
  const frame = document.createElement('iframe');
  frame.title = 'Development shell at '+width+' pixels';
  frame.width = String(width); frame.height = '380';
  const ready = new Promise((resolve,reject) => {
    const timer = setTimeout(()=>reject(new Error('Frame load timed out')),10000);
    frame.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
  });
  frame.src = './shell.html?test='+Date.now()+'-'+width;
  host.append(frame); await ready;
  if (!frame.contentDocument || !frame.contentWindow) throw new Error('Cannot access shell');
  return {doc:frame.contentDocument,win:frame.contentWindow};
}
function eventRecord(e) { return {type:e.type,trusted:e.isTrusted,pointerType:e.pointerType,pointerId:e.pointerId}; }
function attachInput(doc,win,token) {
  const button=doc.querySelector('#check'), output=doc.querySelector('#status');
  if(!button || !output || button.disabled) throw new Error('Touch target did not initialize');
  let sequence=[], key=false;
  button.addEventListener('pointerdown',e=>{sequence=[eventRecord(e)];key=false;});
  button.addEventListener('pointerup',e=>{sequence.push(eventRecord(e));});
  button.addEventListener('pointercancel',()=>{sequence=[];});
  button.addEventListener('keydown',e=>{sequence=[];key=e.isTrusted && (e.key==='Enter'||e.key===' ');});
  button.addEventListener('blur',()=>{sequence=[];key=false;});
  button.addEventListener('click',e=>{
    const input=[...sequence,eventRecord(e)], keyboard=key && e.isTrusted && e.detail===0;
    sequence=[];key=false;
    setTimeout(()=>{
      if(token!==generation)return;
      const outcome=classifyActivation(input,output.value,win.riftTestErrors);
      if(outcome!=='NOT RUN') result.touch={status:outcome,detail:'Trusted touch pointerdown, pointerup and native click; state and errors checked'};
      if(keyboard)result.keyboard={status:output.value==='Development check passed' && win.riftTestErrors?.length===0?'PASS':'FAIL',detail:'Trusted keyboard activation'};
      refresh();status.textContent=outcome!=='NOT RUN'||keyboard?'Input check recorded. Copy Report.':'Tap the shell button with your touchscreen, then Copy Report.';
    },0);
  });
}
run.addEventListener('click',async()=>{
  if(busy)return;
  busy=true; run.disabled=true; const token=++generation;
  area.replaceChildren();lab.replaceChildren();
  result={build:'m4-shell-002',version:'0.1.0',timestamp:new Date().toISOString(),origin:location.origin,path:location.pathname,device:{android:/Android/i.test(navigator.userAgent),touchPoints:navigator.maxTouchPoints||0,viewport:innerWidth,reportedBrowser:/EdgA?\//.test(navigator.userAgent)?'Edge':/Firefox\//.test(navigator.userAgent)?'Firefox':/SamsungBrowser\//.test(navigator.userAgent)?'Samsung Internet':/Chrome\//.test(navigator.userAgent)?'Chrome-compatible':'Other/unknown'},checks:[],touch:{status:'NOT RUN'},keyboard:{status:'NOT RUN'},scope:'Operator-run hosted diagnostic; not local Playwright or desktop verification'};
  refresh();status.textContent='Running automated checks…';
  try{
    const response=await fetch('./shell.html',{cache:'no-store'});check('Served HTML',response.ok,'HTTP '+response.status);
    const phoneWidth=Math.max(1,Math.floor(area.clientWidth));
    for(const width of [...new Set([1280,360,phoneWidth])]){
      const {doc,win}=await loadFrame(width,lab);
      const button=doc.querySelector('#check'),output=doc.querySelector('#status');
      check('Native modules initialized at '+width,Boolean(button && output && !button.disabled && output.value==='Development shell ready'));
      check('Viewport/no overflow at '+width,win.innerWidth===width && doc.documentElement.scrollWidth<=win.innerWidth,'viewport='+win.innerWidth+' scrollWidth='+doc.documentElement.scrollWidth);
      check('CSS loaded at '+width,Boolean(button && win.getComputedStyle(button).minHeight==='44px'));
      if(button && output)button.click();
      check('Programmatic button activation at '+width,output?.value==='Development check passed','Synthetic click, not physical input');
      check('No captured shell errors at '+width,Array.isArray(win.riftTestErrors)&&win.riftTestErrors.length===0,JSON.stringify(win.riftTestErrors??['monitor missing']));
    }
    lab.replaceChildren();
    const {doc,win}=await loadFrame(phoneWidth,area);attachInput(doc,win,token);
    check('Tester fits actual viewport',document.documentElement.scrollWidth<=innerWidth,'viewport='+innerWidth+' scrollWidth='+document.documentElement.scrollWidth);
    status.textContent='Automated checks complete. Tap Run development check below once, then Copy Report.';
  }catch(e){check('Execution',false,String(e));status.textContent='Test stopped. Copy Report.';}
  finally{lab.replaceChildren();busy=false;run.disabled=false;refresh();}
});
copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(report.value);status.textContent='Report copied. Paste into ChatGPT.';}
  catch{report.focus();report.select();status.textContent='Report selected. Long-press and copy if needed.';}
});
run.disabled=false; status.textContent='Ready. Run All Tests.';
