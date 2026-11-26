import { profileBoons } from '../data/definitions/build-options.js';
import { integer, invalid, list, record, ref } from '../data/definitions/contract.js';
const fields = record({
    version: integer(1, 1), id: ref('profile'), renown: integer(0),
    achievements: list(ref('achievement'), true), ownedBoons: profileBoons,
});
export function newProfile(id) {
    return fields({ version: 1, id, renown: 0, achievements: [], ownedBoons: [] }, 'profile');
}
export function readProfile(input, catalog) {
    const profile = fields(input, 'profile');
    const earned = new Set(profile.achievements);
    for (const [i, id] of profile.ownedBoons.entries()) {
        const boon = catalog.get(id);
        if (boon?.kind !== 'boon' || !earned.has(boon.achievement))
            invalid('profile.ownedBoons[' + i + ']');
    }
    return profile;
}
