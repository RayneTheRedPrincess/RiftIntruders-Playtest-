/** SplitMix64 v1, high 32-bit output. Gameplay randomness only, not cryptography. */
export const RNG_ALGORITHM = 'splitmix64-high32-v1';
const MASK = (1n << 64n) - 1n;
const UINT32_RANGE = 0x1_0000_0000;
const MAX_REJECTION_DRAWS = 128;
function parseState(value) {
    if (typeof value !== 'string' || value.length !== 16 || /[^0-9a-f]/.test(value)) {
        throw new TypeError('RNG seed/state must be 16 lowercase hex digits');
    }
    return BigInt('0x' + value);
}
export class SeededRng {
    #state;
    constructor(seed) { this.#state = parseState(seed); }
    /** Canonical current state; reconstruct with new SeededRng(state). */
    snapshot() { return this.#state.toString(16).padStart(16, '0'); }
    nextUint32() {
        this.#state = (this.#state + 0x9e3779b97f4a7c15n) & MASK;
        let z = this.#state;
        z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
        z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
        z ^= z >> 31n;
        return Number(z >> 32n);
    }
    nextFloat() { return this.nextUint32() / UINT32_RANGE; }
    /** Uniform-range mapping under uniform input; rejects the incomplete residue tail. */
    nextInt(bound) {
        if (!Number.isSafeInteger(bound) || bound < 1 || bound > UINT32_RANGE) {
            throw new RangeError('RNG bound must be an integer from 1 through 2^32');
        }
        const limit = UINT32_RANGE - UINT32_RANGE % bound;
        const before = this.#state;
        for (let attempt = 0; attempt < MAX_REJECTION_DRAWS; attempt++) {
            const value = this.nextUint32();
            if (value < limit)
                return value % bound;
        }
        this.#state = before;
        throw new RangeError('RNG rejection budget exhausted');
    }
}
