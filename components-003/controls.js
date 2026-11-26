const labels = { basic: 'Basic Attack', attack: 'Attack Skill', spell: 'Spell Skill', dust: 'Dust' };
let sequence = 0;
function uniqueId(part) { return 'rift-' + part + '-' + ++sequence; }
/** Bind one native click path. Presentation callbacks may dispatch through an app port. */
export function actionButton(role, activate, lifetime) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rift-control';
    button.dataset.actionRole = role;
    const marker = document.createElement('span');
    marker.className = 'rift-marker';
    marker.setAttribute('aria-hidden', 'true');
    const state = document.createElement('span');
    button.append(marker, document.createTextNode(labels[role]), state);
    button.addEventListener('click', () => { if (!button.disabled)
        activate(); }, { signal: lifetime });
    function update(selected, disabled) {
        button.disabled = disabled;
        button.setAttribute('aria-pressed', String(selected));
        state.textContent = [selected ? 'Selected' : '', disabled ? 'Unavailable' : ''].filter(Boolean).map(s => ' · ' + s).join('');
    }
    update(false, false);
    return { button, update };
}
export function namedPanel(title) {
    const region = document.createElement('section'), heading = document.createElement('h2');
    heading.id = uniqueId('heading');
    heading.textContent = title;
    region.className = 'rift-panel';
    region.setAttribute('aria-labelledby', heading.id);
    region.append(heading);
    return region;
}
export function disclosure(label, children, lifetime) {
    const root = document.createElement('div'), trigger = document.createElement('button'), body = document.createElement('div');
    trigger.type = 'button';
    trigger.className = 'rift-control';
    trigger.textContent = label;
    body.id = uniqueId('choices');
    body.className = 'rift-choices';
    trigger.setAttribute('aria-controls', body.id);
    body.append(...children);
    root.append(trigger, body);
    function setOpen(open) {
        body.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    }
    setOpen(false);
    trigger.addEventListener('click', () => setOpen(body.hidden), { signal: lifetime });
    root.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !body.hidden) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            trigger.focus();
        }
    }, { signal: lifetime });
    return { root, trigger, body };
}
