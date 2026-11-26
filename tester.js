const run = document.querySelector('#run');
const copy = document.querySelector('#copy');
const status = document.querySelector('#status');
const report = document.querySelector('#report');
const area = document.querySelector('#frame-area');
let result;
function refresh() { report.value = JSON.stringify(result, null, 2); copy.disabled = false; }
function check(name, ok, detail='') { result.checks.push({name,status:ok?'PASS':'FAIL',detail}); refresh(); }
async function loadFrame(width) {
  area.replaceChildren();
  const frame = document.createElement('iframe');
  frame.title = 'Development shell at '+width+' pixels';
  frame.width = String(width); frame.height = '320';
  const ready = new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('Frame load timed out')),10000);
    frame.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
  });
  frame.src='./shell.html?test='+Date.now()+'-'+width;
  area.append(frame); await ready;
  if(!frame.contentDocument || !frame.contentWindow) throw new Error('Cannot access shell');
  return {doc:frame.contentDocument,win:frame.contentWindow};
}
run.addEventListener('click',async()=>{
  run.disabled=true;
  result={build:'m4-shell-001',version:'0.1.0',timestamp:new Date().toISOString(),origin:location.origin,checks:[],keyboard:{status:'NOT RUN'},scope:'Operator-run hosted diagnostic, not the local Playwright suite'};
  refresh(); status.textContent='Running tests…';
  try {
    const response=await fetch('./shell.html',{cache:'no-store'});
    check('Served HTML',response.ok,'HTTP '+response.status);
    for(const width of [1280,360]){
      const {doc,win}=await loadFrame(width);
      const button=doc.querySelector('#check'), output=doc.querySelector('#status');
      check('Native modules initialized at '+width,Boolean(button && output && !button.disabled && output.value==='Development shell ready'));
      check('Viewport/no overflow at '+width,win.innerWidth===width && doc.documentElement.scrollWidth<=win.innerWidth,'viewport='+win.innerWidth+' scrollWidth='+doc.documentElement.scrollWidth);
      check('CSS loaded at '+width,Boolean(button && win.getComputedStyle(button).minHeight==='44px'));
      if(button && output)button.click();
      check('Programmatic button activation at '+width,output?.value==='Development check passed','Synthetic click, not keyboard automation');
      check('No captured shell errors at '+width,Array.isArray(win.riftTestErrors)&&win.riftTestErrors.length===0,JSON.stringify(win.riftTestErrors??['monitor missing']));
    }
    const {doc,win}=await loadFrame(360);
    const button=doc.querySelector('#check'),output=doc.querySelector('#status');
    if(button && output && !button.disabled){
      let trustedKey=false;
      button.addEventListener('keydown',e=>{if(e.isTrusted && (e.key==='Enter'||e.key===' '))trustedKey=true;});
      button.addEventListener('click',e=>{
        if(e.isTrusted && trustedKey) setTimeout(()=>{
          result.keyboard={status:output.value==='Development check passed' && win.riftTestErrors?.length===0?'PASS':'FAIL',detail:'Trusted key and native activation'};
          refresh();status.textContent='Keyboard check recorded. Copy report.';
        },0);
      });
      button.focus();
    }
    status.textContent='Checks complete. Optional keyboard check: focus shell button and press Enter or Space. Copy report.';
  }catch(e){check('Execution',false,String(e));status.textContent='Test stopped. Copy report.';}
  finally{run.disabled=false;refresh();}
});
copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(report.value);status.textContent='Report copied.';}
  catch{report.focus();report.select();status.textContent='Report selected. Copy manually.';}
});
run.disabled=false; status.textContent='Ready. Run All Tests.';
