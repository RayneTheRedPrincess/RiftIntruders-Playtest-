import { smokeStatus } from './shared/smoke-status.js';
const status = document.querySelector('#status');
const button = document.querySelector('#check');
if (!status || !button)
    throw new Error('Development shell markup missing');
status.value = smokeStatus(false);
button.disabled = false;
button.addEventListener('click', () => { status.value = smokeStatus(true); });
