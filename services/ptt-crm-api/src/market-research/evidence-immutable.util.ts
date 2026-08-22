export function assertEvidenceMutable(qcStatus: string): void {
  if (qcStatus === 'verified' || qcStatus === 'superseded' || qcStatus === 'rejected') {
    const err = new Error('evidence_immutable');
    (err as Error & { code: string }).code = 'evidence_immutable';
    throw err;
  }
}

export function piiHint(excerpt: string): boolean {
  return /(\+?84|0)\d{8,10}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(excerpt);
}
