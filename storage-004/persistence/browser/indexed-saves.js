import { ownerKey, readSave, checkReplacement } from '../save.js';
import { readBackup, saveBackup, matchesHead, recoverySnapshot, supportedFormat } from '../backup.js';
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
                const write = (head, previous) => {
                    records.put(saveBackup(head, previous), backupKey);
                    records.put(head, owner);
                    result = { ok: true, value: head };
                };
                req.onsuccess = () => {
                    try {
                        let backup, prior;
                        if (metadata.result) {
                            try {
                                backup = readBackup(metadata.result.value, owner, this.catalog);
                            }
                            catch {
                                result = failed('corrupt');
                                return;
                            }
                        }
                        const present = req.result !== null, raw = req.result?.value;
                        if (present) {
                            if (!supportedFormat(raw)) {
                                result = failed('corrupt');
                                return;
                            }
                            try {
                                prior = readSave(raw, owner, this.catalog);
                            }
                            catch { /* explicit recovery only */ }
                        }
                        const healthy = prior !== undefined && (!backup || matchesHead(prior, backup));
                        if (recover) {
                            if (healthy) {
                                result = failed('conflict');
                                return;
                            }
                            const restored = backup && recoverySnapshot(backup, raw, present, prior);
                            if (!backup || !restored) {
                                result = failed('corrupt');
                                return;
                            }
                            write(restored, backup.previous);
                            return;
                        }
                        if (!healthy && (present || backup)) {
                            result = failed('corrupt');
                            return;
                        }
                        if (!next) {
                            if (!prior) {
                                result = failed('missing');
                                return;
                            }
                            if (!backup || raw.format === 1)
                                write(prior, backup?.previous ?? prior);
                            else
                                result = { ok: true, value: prior };
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
                        write(next, prior ?? next);
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
