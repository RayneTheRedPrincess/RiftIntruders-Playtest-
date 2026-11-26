import { rawRecord } from './raw.js';
export async function scenario({db,name,profile,character,assert,resumed}){
  const read=()=>rawRecord(name,'saves',profile.id),write=v=>rawRecord(name,'saves',profile.id,v);
  const old={format:1,revision:7,profile,characters:[{...character,subclass:'subclass:trained',category:'oath'}]};
  if(!resumed){
    for(const bad of [{...old,format:99},{...old,characters:[{}]}]){
      await write(bad);assert('Rejected unsupported or malformed stored envelope',(await db.load(profile.id)).error==='corrupt');
      assert('Rejected record preserved',JSON.stringify(await read())===JSON.stringify(bad));
    }
    await write(old);
  }
  const loaded=await db.load(profile.id);
  assert('Current envelope with original revision and permanent locks',loaded.ok&&loaded.value.format===2&&loaded.value.revision===7&&
    loaded.value.characters[0].subclass==='subclass:trained'&&loaded.value.characters[0].category==='oath');
  const stored=await read();
  assert('Migration committed to IndexedDB',stored.format===2&&stored.streams.length===0);
  await db.load(profile.id);
  assert('Second load is idempotent',JSON.stringify(await read())===JSON.stringify(stored));
}
