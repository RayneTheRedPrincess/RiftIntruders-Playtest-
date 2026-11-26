import { choice, integer, label, list, nullable, record, ref, variant } from './contract.js';
const effects = list(ref('effect'), true, 1);
export const boon = record({
    kind: choice('boon'), id: ref('boon'), name: label, achievement: ref('achievement'), renown: integer(1),
    weight: integer(1), mode: choice('passive', 'triggered', 'activated'), effects,
});
const base = { kind: choice('manifestation'), id: ref('manifestation'), name: label, effects };
export const manifestation = variant('category', {
    oath: record({ ...base, category: choice('oath'), sacrifice: ref('effect') }),
    epiphany: record({ ...base, category: choice('epiphany'), skill: ref('skill') }),
    catalyst: record({ ...base, category: choice('catalyst'), trigger: ref('trigger'), internalCooldownMs: integer(1) }),
});
export const profileBoons = list(ref('boon'), true);
export const boonSlots = record({ selected: list(ref('boon'), true), equipment: list(ref('boon'), true) });
export const permanentCategory = nullable(choice('oath', 'epiphany', 'catalyst'));
export function validPlayerLoadout(owned, slots, catalog, capacity = 7) {
    if (!Number.isSafeInteger(capacity) || capacity < 0)
        return false;
    const ownership = new Set(owned);
    let remaining = capacity;
    for (const id of slots.selected) {
        const definition = catalog.get(id);
        if (!ownership.has(id) || !definition || definition.weight > remaining)
            return false;
        remaining -= definition.weight;
    }
    return slots.equipment.every(id => catalog.has(id));
}
export function acceptsManifestation(locked, candidate) {
    return locked === null || locked === candidate.category;
}
