export class FieldError extends TypeError {
    path;
    constructor(path) {
        super('Invalid catalog field ' + path);
        this.path = path;
    }
}
export function invalid(path) { throw new FieldError(path); }
export function choice(...choices) {
    return (value, path) => choices.find(candidate => candidate === value) ?? invalid(path);
}
export const label = (v, p) => typeof v === 'string' && v.trim().length > 0 ? v : invalid(p);
export function integer(min, max = Number.MAX_SAFE_INTEGER) {
    return (v, p) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : invalid(p);
}
export function ref(kind) {
    return (v, p) => {
        if (typeof v !== 'string' || !v.startsWith(kind + ':'))
            return invalid(p);
        const slug = v.slice(kind.length + 1);
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || /[^a-z0-9-]/.test(slug))
            return invalid(p);
        return v;
    };
}
export function nullable(read) {
    return (v, p) => v === null ? null : read(v, p);
}
export function list(read, unique = false, minimum = 0) {
    return (v, p) => {
        if (!Array.isArray(v) || v.length < minimum || Reflect.ownKeys(v).length !== v.length + 1)
            return invalid(p);
        const result = [];
        const seen = new Set();
        for (let i = 0; i < v.length; i++) {
            const field = Object.getOwnPropertyDescriptor(v, i);
            const path = p + '[' + i + ']';
            if (!field || !Object.hasOwn(field, 'value'))
                return invalid(path);
            const item = read(field.value, path);
            if (unique && seen.has(item))
                return invalid(path);
            seen.add(item);
            result.push(item);
        }
        return Object.freeze(result);
    };
}
export function record(fields) {
    return (v, p) => {
        if (typeof v !== 'object' || v === null || Array.isArray(v) || ![null, Object.prototype].includes(Object.getPrototypeOf(v)))
            return invalid(p);
        const extra = Reflect.ownKeys(v).some(key => typeof key !== 'string' || !Object.hasOwn(fields, key));
        if (extra)
            return invalid(p);
        const output = {};
        for (const [key, read] of Object.entries(fields)) {
            const field = Object.getOwnPropertyDescriptor(v, key);
            if (!field || !Object.hasOwn(field, 'value'))
                return invalid(p + '.' + key);
            output[key] = read(field.value, p + '.' + key);
        }
        // Every key in the closed field table has just passed its own reader.
        return Object.freeze(output);
    };
}
export function where(reader, predicate) {
    return (v, p) => { const result = reader(v, p); return predicate(result) ? result : invalid(p); };
}
export function variant(key, cases) {
    return (v, p) => {
        if (typeof v !== 'object' || v === null)
            return invalid(p);
        const tag = Object.getOwnPropertyDescriptor(v, key)?.value;
        if (typeof tag !== 'string' || !Object.hasOwn(cases, tag))
            return invalid(p + '.' + key);
        return cases[tag](v, p);
    };
}
