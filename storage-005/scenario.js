import { readSave } from './persistence/save.js';
import { SeededRng } from './core/seeded-rng.js';
import { rawRecord } from './raw.js';
import { algorithm,seeds,owner,profile,character,streams,same } from './fixture.js';
const resultIs=(r,error)=>!r.ok&&r.error===error;
const draws=(rng,n)=>Array.from({length:n},(_,i)=>i%2?rng.nextInt(97):rng.nextUint32());
export async function scenario({db,connect,catalog,assert,name,resumed}){
  const raw=k=>rawRecord(name,'saves',k);
  const exact=(id,revision,p,c,s)=>readSave({format:2,revision,profile:p,characters:c,streams:s},id,catalog);
  const load=async(id,expected,handle=db)=>{const r=await handle.load(id);return r.ok&&same(r.value,expected);};
  const check=async(scope,work)=>{try{await work((label,ok)=>assert(scope+' '+label,ok));}catch{assert(scope+' stopped',false);}};
  await check('M1',async a=>{
    const id=owner('m1'),p=profile(id),c=character(id),s=streams(seeds),next={...p,renown:19},nc={...c,experience:8};
    const first=exact(id,1,p,[c],s),last=exact(id,2,next,[nc],s);
    if(resumed){a('full envelope after reload',await load(id,last));return;}
    const written=await db.save(id,0,p,[c],s);
    a('initial exact envelope',written.ok&&same(written.value,first)&&await load(id,first));
    const second=await connect();a('independent handle reads same envelope',await load(id,first,second));
    const updated=await second.save(id,1,next,[nc]);a('revision and omitted streams preserved',updated.ok&&same(updated.value,last)&&await load(id,last));
    second.close();const reopened=await connect();a('close reopen consistency',await load(id,last,reopened));reopened.close();
    const before=await raw(id),backup=await raw(['backup',id]);
    a('invalid and stale updates rejected',resultIs(await db.save(id,1,next,[nc]),'conflict')&&resultIs(await db.save(id,2,next,[{...nc,class:'class:other'}]),'invalid'));
    a('rejected writes leave both records unchanged',same(await raw(id),before)&&same(await raw(['backup',id]),backup)&&await load(id,last));
  });
  await check('M2',async a=>{
    const x=owner('m2'),y=owner('m2','b'),px=profile(x),py=profile(y,2,false),cx=character(x),cy=character(y,21,false),nx={...px,renown:30},nc={...cx,experience:12};
    const expectedX=exact(x,2,nx,[nc],[]),expectedY=exact(y,1,py,[cy],[]);
    if(resumed){a('both profiles isolated after reload',await load(x,expectedX)&&await load(y,expectedY));return;}
    a('same character key in different profiles', (await db.save(x,0,px,[cx])).ok&&(await db.save(y,0,py,[cy])).ok&&await load(y,expectedY));
    const yRaw=await raw(y),yBackup=await raw(['backup',y]);
    a('foreign character and unowned boon rejected',resultIs(await db.save(y,1,py,[cx]),'invalid')&&resultIs(await db.save(y,1,py,[{...cy,selectedBoons:['boon:a']}]),'invalid'));
    a('one profile updates without changing other', (await db.save(x,1,nx,[nc])).ok&&await load(x,expectedX)&&await load(y,expectedY)&&same(await raw(y),yRaw)&&same(await raw(['backup',y]),yBackup));
  });
  await check('M3',async a=>{
    const id=owner('m3'),p=profile(id),c=character(id),next={...p,renown:42},nc={...c,experience:22};
    const first=exact(id,1,p,[c],[]),last=exact(id,2,next,[nc],[]);
    if(resumed){a('committed winner survives reload',await load(id,last));return;}
    a('initial save',(await db.save(id,0,p,[c])).ok&&await load(id,first));
    const before=await raw(id),backup=await raw(['backup',id]),native=IDBObjectStore.prototype.put;
    let injected=false,aborted;
    try{IDBObjectStore.prototype.put=function(value,key){const req=native.call(this,value,key);if(key===id){injected=true;this.transaction.abort();}return req;};aborted=await db.save(id,1,next,[nc]);}finally{IDBObjectStore.prototype.put=native;}
    a('ordinary transaction aborted after both writes queued',injected&&resultIs(aborted,'storage'));
    a('abort preserves primary and backup',same(await raw(id),before)&&same(await raw(['backup',id]),backup)&&await load(id,first));
    const second=await connect();const pair=await Promise.all([db.save(id,1,next,[nc]),second.save(id,1,next,[nc])]);
    a('concurrent revision has exactly one winner',pair.filter(r=>r.ok).length===1&&pair.filter(r=>resultIs(r,'conflict')).length===1&&await load(id,last));
    second.close();a('closed handle returns storage error',resultIs(await second.load(id),'storage'));
  });
  await check('M4',async a=>{
    const id=owner('m4'),p=profile(id),c=character(id),rngs=seeds.map(seed=>new SeededRng(seed));
    rngs.forEach(r=>draws(r,13));const checkpoint=streams(rngs.map(r=>r.snapshot()));
    const continuation=rngs.map(r=>draws(r,64)),end=streams(rngs.map(r=>r.snapshot()));
    if(resumed){
      const saved=await db.load(id);a('named checkpoints restored after reload',saved.ok&&same(saved.value.streams,checkpoint));
      const resumedRngs=saved.value.streams.map(s=>new SeededRng(s.state));
      a('64 continued draws per stream match uninterrupted reference',same(resumedRngs.map(r=>draws(r,64)),continuation)&&same(streams(resumedRngs.map(r=>r.snapshot())),end));
      a('advanced states persisted',(await db.save(id,2,p,[c],end)).ok&&await load(id,exact(id,3,p,[c],end)));return;
    }
    a('algorithm and two named checkpoints',checkpoint.every(s=>s.algorithm===algorithm)&&(await db.save(id,0,p,[c],checkpoint)).ok&&await load(id,exact(id,1,p,[c],checkpoint)));
    a('omitted checkpoints retained',(await db.save(id,1,p,[c])).ok&&await load(id,exact(id,2,p,[c],checkpoint)));
    const before=await raw(id),backup=await raw(['backup',id]);
    a('invalid and duplicate checkpoints rejected',resultIs(await db.save(id,2,p,[c],[{...checkpoint[0],state:'bad'}]),'invalid')&&resultIs(await db.save(id,2,p,[c],[checkpoint[0],checkpoint[0]]),'invalid')&&same(await raw(id),before)&&same(await raw(['backup',id]),backup));
  });
}
