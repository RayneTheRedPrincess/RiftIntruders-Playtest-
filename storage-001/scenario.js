export async function scenario({db,connect,profile,other,character,assert,resumed}){
  if(resumed){
    const a=await db.load(profile.id),b=await db.load(other.id);
    assert('Reload restored exact revision and character experience',a.ok&&a.value.revision===2&&a.value.characters[0].experience===9);
    assert('Second owner survives reload independently',b.ok&&b.value.profile.id===other.id&&b.value.characters.length===0);
    return;
  }
  assert('Fresh profile absent',(await db.load(profile.id)).error==='missing');
  assert('Atomic profile and character creation',(await db.save(profile.id,0,profile,[character])).ok);
  assert('Independent owner creation',(await db.save(other.id,0,other,[])).ok);
  assert('Foreign character rejected',(await db.save(other.id,1,other,[character])).error==='invalid');
  const concurrent=await connect();
  const wins=await Promise.all([db,concurrent].map(h=>h.save(profile.id,1,profile,[{...character,experience:9}])));
  assert('Exactly one concurrent writer committed',wins.filter(r=>r.ok).length===1&&wins.filter(r=>r.error==='conflict').length===1);
  assert('Malformed overwrite rejected',(await db.save(profile.id,2,{...profile,version:99},[])).error==='invalid');
  db.close();
  assert('Closed connection returns storage error',(await db.load(profile.id)).error==='storage');
  const reopened=await connect(), result=await reopened.load(profile.id);
  assert('Reopened durable snapshot is detached and frozen',result.ok&&result.value.revision===2&&Object.isFrozen(result.value.characters[0]));
}
