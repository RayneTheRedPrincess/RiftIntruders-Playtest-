import { choice, integer, invalid, list, record, ref, where } from '../data/definitions/contract.js';
import { readProfile } from './profile.js';
import { readCharacters, reviseCharacter } from './character.js';
const checkpoint = record({
    id: ref('stream'), algorithm: choice('splitmix64-high32-v1'),
    state: (v, p) => typeof v === 'string' && v.length === 16 && !/[^0-9a-f]/.test(v) ? v : invalid(p),
});
const checkpoints = where(list(checkpoint), entries => new Set(entries.map(e => e.id)).size === entries.length);
export const ownerKey = ref('profile');
const raw = (value) => value;
const base = { revision: integer(1), profile: raw, characters: raw };
const versionOne = record({ ...base, format: integer(1, 1) });
const versionTwo = record({ ...base, format: integer(2, 2), streams: checkpoints });
export function readSave(input, owner, catalog) {
    const format = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'format')?.value : undefined;
    const value = format === 1 ? { ...versionOne(input, 'save'), streams: Object.freeze([]) } : versionTwo(input, 'save');
    const profile = readProfile(value.profile, catalog);
    if (profile.id !== owner)
        invalid('save.profile.id');
    const characters = readCharacters(value.characters, profile, catalog);
    return Object.freeze({ format: 2, streams: value.streams, revision: value.revision, profile, characters });
}
export function checkReplacement(previous, next, catalog) {
    if (previous.profile.id !== next.profile.id || next.revision !== previous.revision + 1)
        invalid('save.revision');
    const owned = new Set(next.profile.ownedBoons), earned = new Set(next.profile.achievements);
    if (previous.profile.ownedBoons.some(id => !owned.has(id)) || previous.profile.achievements.some(id => !earned.has(id)))
        invalid('save.profile');
    const characters = new Map(next.characters.map(c => [c.id, c]));
    for (const prior of previous.characters)
        reviseCharacter(prior, characters.get(prior.id), next.profile, catalog);
}
