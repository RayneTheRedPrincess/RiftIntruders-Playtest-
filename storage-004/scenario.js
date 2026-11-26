import {rawRecord} from './raw.js';
export async function scenario({db,name,profile,other,character,assert,resumed}){
  const key=profile.id,bkey=['backup',key];
  const get=k=>rawRecord(name,'saves',k),put=(k,v)=>rawRecord(name,'saves',k,v);
  if(resumed){
    const r=await db.load(key);
    assert('Recovered record survives reload',r.ok&&r.value.revision===18&&r.value.characters[0].experience===4);
    assert('Other owner survives recovery',(await db.load(other.id)).value.revision===1);
    return;
  }
  assert('Missing owner',(await db.load(key)).error==='missing');
  assert('Missing backup cannot recover',(await db.recover(key)).error==='corrupt');
  assert('Initial saves',(await db.save(key,0,profile,[character])).ok&&(await db.save(other.id,0,other,[])).ok);
  assert('Subsequent saves',(await db.save(key,1,profile,[{...character,experience:4}])).ok&&(await db.save(key,2,profile,[{...character,experience:9}])).ok);
  const head=await get(key),backup=await get(bkey);
  assert('One-generation rotation',head.revision===3&&backup.previous.revision===2);
  assert('Healthy primary protected',(await db.recover(key)).error==='conflict');
  await put(key,{...head,format:99});
  assert('Future primary protected',(await db.recover(key)).error==='corrupt'&&(await get(key)).format===99);
  const damaged={...head,revision:17,profile:{...head.profile,renown:17}};await put(key,damaged);
  assert('Schema-valid corruption detected',(await db.load(key)).error==='corrupt');
  assert('Regular save cannot overwrite damage',(await db.save(key,17,profile,[])).error==='corrupt');
  await put(bkey,{...backup,seal:'broken'});
  assert('Damaged backup rejected without write',(await db.recover(key)).error==='corrupt'&&(await get(key)).profile.renown===17);
  await put(bkey,backup);
  // Inject a synchronous failure at the primary write, after the real backup put is queued.
  const native=IDBObjectStore.prototype.put;
  let injected=false,failed;
  try{
    IDBObjectStore.prototype.put=function(value,k){if(k===key){injected=true;throw Error('fixture abort');}return native.call(this,value,k);};
    failed=await db.recover(key);
  }finally{IDBObjectStore.prototype.put=native;}
  assert('Injected write failure aborts both writes',injected&&failed.error==='storage'&&JSON.stringify(await get(key))===JSON.stringify(damaged)&&JSON.stringify(await get(bkey))===JSON.stringify(backup));
  const restored=await db.recover(key);
  assert('Explicit restore advances beyond observed revision',restored.ok&&restored.value.revision===18&&restored.value.characters[0].experience===4);
  assert('Stale writer after restore rejected',(await db.save(key,17,profile,[character])).error==='conflict');
}
