import { readBackup, saveBackup, matchesHead } from '../backup.js';
import { ownerKey, readSave, checkReplacement } from '../save.js';
const store = 'saves';
const failed = (error) => ({ ok: false, error });
/** The caller owns the connection and must close it when disposing the app. */
export class IndexedSaves {
    db;
    catalog;
    constructor(db, catalog) {
        this.db = db;
        this.catalog = catalog;
    }
    static open(factory, name, catalog) {
        return new Promise((resolve, reject) => {
            const req = factory.open(name, 1);
            let blocked = false;
            req.onupgradeneeded = () => { req.result.createObjectStore(store); };
            req.onblocked = () => { blocked = true; reject(new Error('Database blocked')); };
            req.onerror = () => reject(new Error('Database unavailable'));
            req.onsuccess = () => {
                const db = req.result;
                if (blocked || !db.objectStoreNames.contains(store)) {
                    db.close();
                    reject(new Error('Invalid database'));
                    return;
                }
                db.onversionchange = () => db.close();
                resolve(new IndexedSaves(db, catalog));
            };
        });
    }
    close() { this.db.close(); }
    load(owner) { return this.access(owner); }
    recover(owner) { return this.access(owner, undefined, false, true); }
    save(owner, expected, profile, characters, streams) {
        try {
            if (!Number.isSafeInteger(expected) || expected < 0)
                return Promise.resolve(failed('invalid'));
            const next = readSave({ format: 2, revision: expected + 1, profile, characters, streams: streams === undefined ? [] : streams }, owner, this.catalog);
            return this.access(owner, next, streams === undefined);
        }
        catch {
            return Promise.resolve(failed('invalid'));
        }
    }
    async access(owner, next, preserveStreams = false, recover = false) {
        try {
            ownerKey(owner, 'owner');
        }
        catch {
            return failed('invalid');
        }
        try {
            return await new Promise((resolve) => {
                const tx = this.db.transaction(store, 'readwrite');
                const records = tx.objectStore(store);
                let result = failed('storage');
                tx.onabort = () => resolve(failed('storage'));
                tx.oncomplete = () => resolve(result);
                const backupKey = ['backup', owner];
                const metadata = records.openCursor(IDBKeyRange.only(backupKey));
                const req = records.openCursor(IDBKeyRange.only(owner));
                req.onsuccess = () => {
                    let backup;
                    try {
                        if (metadata.result)
                            backup = readBackup(metadata.result.value, owner, this.catalog);
                    }
                    catch {
                        result = failed('corrupt');
                        return;
                    }
                    let prior;
                    const raw = req.result?.value;
                    if (req.result) {
                        if (typeof raw?.format === 'number' && raw.format > 2) {
                            result = failed('corrupt');
                            return;
                        }
                        try {
                            prior = readSave(raw, owner, this.catalog);
                        }
                        catch { /* Explicit recovery below can use an intact backup. */ }
                    }
                    const healthy = prior !== undefined && (!backup || matchesHead(prior, backup));
                    if (recover) {
                        if (healthy) {
                            result = failed('conflict');
                            return;
                        }
                        if (!backup || backup.headRevision >= Number.MAX_SAFE_INTEGER) {
                            result = failed('corrupt');
                            return;
                        }
                        const restored = Object.freeze({ ...backup.previous, revision: backup.headRevision + 1 });
                        records.put(saveBackup(restored, backup.previous), backupKey);
                        records.put(restored, owner);
                        result = { ok: true, value: restored };
                        return;
                    }
                    if (!healthy && (req.result || backup)) {
                        result = failed('corrupt');
                        return;
                    }
                    if (!next) {
                        if (prior && !backup)
                            records.put(saveBackup(prior, prior), backupKey);
                        if (prior && raw.format === 1)
                            records.put(prior, owner);
                        result = prior ? { ok: true, value: prior } : failed('missing');
                        return;
                    }
                    if (prior && preserveStreams)
                        next = Object.freeze({ ...next, streams: prior.streams });
                    if (next.revision !== (prior?.revision ?? 0) + 1) {
                        result = failed('conflict');
                        return;
                    }
                    try {
                        if (prior)
                            checkReplacement(prior, next, this.catalog);
                    }
                    catch {
                        result = failed('invalid');
                        return;
                    }
                    try {
                        records.put(saveBackup(next, prior ?? next), backupKey);
                        records.put(next, owner);
                        result = { ok: true, value: next };
                    }
                    catch {
                        tx.abort();
                    }
                };
            });
        }
        catch {
            return failed('storage');
        }
    }
}
