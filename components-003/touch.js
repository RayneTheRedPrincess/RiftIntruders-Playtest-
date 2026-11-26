export function trustedTouch(sequence) {
  if (sequence.length!==3) return false;
  const [down,up,click]=sequence;
  return down.type==='pointerdown' && up.type==='pointerup' && click.type==='click' &&
    sequence.every(event=>event.trusted===true) && down.pointerType==='touch' &&
    up.pointerType==='touch' && Number.isInteger(down.pointerId) && down.pointerId===up.pointerId;
}
