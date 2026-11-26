import { integer, invalid, record, ref } from '../data/definitions/contract.js';
import { readProfile } from './profile.js';
import { readCharacters, reviseCharacter } from './character.js';
export const ownerKey = ref('profile');
const raw = (value) => value;
const envelope = record({ format: integer(1, 1), revision: integer(1), profile: raw, characters: raw });
export function readSave(input, owner, catalog) {
    const value = envelope(input, 'save');
    const profile = readProfile(value.profile, catalog);
    if (profile.id !== owner)
        invalid('save.profile.id');
    const characters = readCharacters(value.characters, profile, catalog);
    return Object.freeze({ format: 1, revision: value.revision, profile, characters });
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
