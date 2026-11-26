window.riftTestErrors = [];
window.addEventListener('error', e => window.riftTestErrors.push(e.message || 'Resource load error'), true);
window.addEventListener('unhandledrejection', e => window.riftTestErrors.push(String(e.reason)));
