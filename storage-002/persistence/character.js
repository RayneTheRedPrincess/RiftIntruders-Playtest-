import { integer, invalid, list, nullable, record, ref } from '../data/definitions/contract.js';
import { acceptsManifestation, permanentCategory, profileBoons, validPlayerLoadout } from '../data/definitions/build-options.js';
const fields = record({
    version: integer(1, 1), id: ref('saved-character'), profileId: ref('profile'),
    template: nullable(ref('character')), race: ref('race'), class: ref('class'), subclass: nullable(ref('subclass')),
    level: integer(1), experience: integer(0), skills: list(ref('skill'), true), selectedBoons: profileBoons,
    category: permanentCategory, manifestation: nullable(ref('manifestation')),
});
function parse(input, path, profile, catalog) {
    const value = fields(input, path);
    if (value.profileId !== profile.id)
        invalid(path + '.profileId');
    if (value.template !== null) {
        const template = catalog.get(value.template);
        if (template?.kind !== 'character' || template.role !== 'player')
            invalid(path + '.template');
    }
    for (const [i, id] of value.skills.entries())
        if (catalog.get(id)?.kind !== 'skill')
            invalid(path + '.skills[' + i + ']');
    const selected = new Map();
    for (const [i, id] of value.selectedBoons.entries()) {
        const def = catalog.get(id);
        if (def?.kind !== 'boon')
            invalid(path + '.selectedBoons[' + i + ']');
        selected.set(id, def);
    }
    if (!validPlayerLoadout(profile.ownedBoons, { selected: value.selectedBoons, equipment: [] }, selected))
        invalid(path + '.selectedBoons');
    if (value.manifestation !== null) {
        const def = catalog.get(value.manifestation);
        if (def?.kind !== 'manifestation' || value.category === null || !acceptsManifestation(value.category, def))
            invalid(path + '.manifestation');
    }
    return value;
}
export function readCharacter(input, profile, catalog) {
    return parse(input, 'character', profile, catalog);
}
export function readCharacters(input, profile, catalog) {
    const seen = new Set();
    return list((row, path) => {
        const character = parse(row, path, profile, catalog);
        if (seen.has(character.id))
            invalid(path + '.id');
        seen.add(character.id);
        return character;
    })(input, 'characters');
}
/** Validate a proposed replacement against the trusted prior character. */
export function reviseCharacter(previous, input, profile, catalog) {
    const next = readCharacter(input, profile, catalog);
    for (const key of ['id', 'profileId', 'template', 'race', 'class'])
        if (previous[key] !== next[key])
            invalid('character.' + key);
    for (const key of ['subclass', 'category'])
        if (previous[key] !== null && previous[key] !== next[key])
            invalid('character.' + key);
    return next;
}
