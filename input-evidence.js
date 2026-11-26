export function classifyActivation(sequence, finalState, errors) {
  if (!Array.isArray(sequence) || sequence.length !== 3) return 'NOT RUN';
  const [down, up, click] = sequence;
  if (!down || !up || !click || down.type !== 'pointerdown' || up.type !== 'pointerup' || click.type !== 'click' || ![down, up, click].every(e => e.trusted === true) || down.pointerType !== 'touch' || up.pointerType !== 'touch' || !Number.isInteger(down.pointerId) || down.pointerId !== up.pointerId) return 'NOT RUN';
  return finalState === 'Development check passed' && Array.isArray(errors) && errors.length === 0 ? 'PASS' : 'FAIL';
}
