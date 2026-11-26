import {rawRecord} from './raw.js';
export async function scenario({db,name,profile,other,character,assert,resumed}){
  const key=profile.id,bkey=['backup',key];
  const get=k=>rawRecord(name,'saves',k),put=(k,v)=>rawRecord(name,'saves',k,v);
  if(resumed){
    const r=await db.load(key);
    assert('Recovered record survives reload',r.ok&&r.value.revision===4&&r.value.characters[0].experience===4);
    assert('Other owner survives recovery',(await db.load(other.id)).value.revision===1);
    return;
  }
  await db.save(key,0,profile,[character]);await db.save(other.id,0,other,[]);
  await db.save(key,1,profile,[{...character,experience:4}]);await db.save(key,2,profile,[{...character,experience:9}]);
  const head=await get(key),backup=await get(bkey);
  assert('One-generation rotation',head.revision===3&&backup.previous.revision===2);
  assert('Healthy primary protected',(await db.recover(key)).error==='conflict');
  await put(key,{...head,format:99});
  assert('Future primary protected',(await db.recover(key)).error==='corrupt'&&(await get(key)).format===99);
  const damaged={...head,profile:{...head.profile,renown:17}};await put(key,damaged);
  assert('Schema-valid corruption detected',(await db.load(key)).error==='corrupt');
  assert('Regular save cannot overwrite damage',(await db.save(key,3,profile,[])).error==='corrupt');
  await put(bkey,{...backup,seal:'broken'});
  assert('Damaged backup rejected without write',(await db.recover(key)).error==='corrupt'&&(await get(key)).profile.renown===17);
  await put(bkey,backup);
  const restored=await db.recover(key);
  assert('Explicit restore advances past damaged revision',restored.ok&&restored.value.revision===4&&restored.value.characters[0].experience===4);
  assert('Stale writer after restore rejected',(await db.save(key,3,profile,[character])).error==='conflict');
}
