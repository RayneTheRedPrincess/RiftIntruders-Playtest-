import { integer, invalid, record } from '../data/definitions/contract.js';
import { readSave } from './save.js';
// FNV-1a over canonical UTF-16 code units detects accidental damage. Not authentication.
function checksum(value) {
    const text = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++)
        hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
}
const digest = (v, p) => typeof v === 'string' && v.length === 8 && !/[^0-9a-f]/.test(v) ? v : invalid(p);
const fields = record({ headRevision: integer(1), headDigest: digest, previous: (v) => v, seal: digest });
export function saveBackup(head, previous) {
    const body = { headRevision: head.revision, headDigest: checksum(head), previous };
    return { ...body, seal: checksum(body) };
}
export function readBackup(raw, owner, catalog) {
    const b = fields(raw, 'backup'), previous = readSave(b.previous, owner, catalog);
    const body = { headRevision: b.headRevision, headDigest: b.headDigest, previous };
    if (previous.revision > b.headRevision || checksum(body) !== b.seal)
        invalid('backup.seal');
    return body;
}
export function matchesHead(head, backup) {
    return head.revision === backup.headRevision && checksum(head) === backup.headDigest;
}
