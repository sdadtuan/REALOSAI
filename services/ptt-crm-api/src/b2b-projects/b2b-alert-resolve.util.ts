export function shouldResolveArrivalAlert(kind: 'human' | 'ai'): boolean {
  return kind === 'human';
}
