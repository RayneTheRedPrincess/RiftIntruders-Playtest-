import { integer, invalid, record } from '../data/definitions/contract.js';
import { readSave } from './save.js';
// FNV-1a over canonical UTF-16 code units: accidental damage detection, not authentication.
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
    if (head.profile.id !== previous.profile.id || previous.revision > head.revision)
        invalid('backup.previous');
    const body = { headRevision: head.revision, headDigest: checksum(head), previous };
    return Object.freeze({ ...body, seal: checksum(body) });
}
export function readBackup(raw, owner, catalog) {
    const b = fields(raw, 'backup'), previous = readSave(b.previous, owner, catalog);
    const body = { headRevision: b.headRevision, headDigest: b.headDigest, previous };
    if (previous.revision > b.headRevision || checksum(body) !== b.seal)
        invalid('backup.seal');
    return Object.freeze(body);
}
export function matchesHead(head, backup) {
    return head.revision === backup.headRevision && head.profile.id === backup.previous.profile.id && checksum(head) === backup.headDigest;
}
/** Only known formats may be replaced. Missing primary is handled separately by the caller. */
export function supportedFormat(raw) {
    const format = typeof raw === 'object' && raw !== null ? Object.getOwnPropertyDescriptor(raw, 'format')?.value : undefined;
    return format === 1 || format === 2;
}
export function recoverySnapshot(backup, raw, present, prior) {
    if (present && !supportedFormat(raw))
        return undefined;
    const profile = typeof raw === 'object' && raw !== null ? Object.getOwnPropertyDescriptor(raw, 'profile')?.value : undefined;
    const owner = typeof profile === 'object' && profile !== null ? Object.getOwnPropertyDescriptor(profile, 'id')?.value : undefined;
    if (typeof owner === 'string' && owner !== backup.previous.profile.id)
        return undefined;
    if (prior && matchesHead(prior, backup))
        return undefined;
    const observed = typeof raw === 'object' && raw !== null ? Object.getOwnPropertyDescriptor(raw, 'revision')?.value : undefined;
    const revision = Math.max(backup.headRevision, typeof observed === 'number' && Number.isSafeInteger(observed) && observed > 0 ? observed : 0);
    if (revision >= Number.MAX_SAFE_INTEGER)
        return undefined;
    return Object.freeze({ ...backup.previous, revision: revision + 1 });
}
