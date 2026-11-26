// Used only on the UUID-named synthetic database created by the diagnostic.
export async function rawRecord(name,store,key,...value) {
  if(!/^rift-diagnostic-[0-9a-f-]{36}$/.test(name)) throw Error('Not a fixture');
  const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(store,value.length?'readwrite':'readonly');
    const records=tx.objectStore(store),req=value.length?records.put(value[0],key):records.get(key);
    tx.oncomplete=()=>resolve(req.result);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
