import { buildDiscoveryConsultPrefill } from './intake-discovery-prefill.util';

describe('intake-discovery-prefill.util', () => {
  it('maps discovery responses and red flags to consult prefill lines', () => {
    const out = buildDiscoveryConsultPrefill({
      answers: {
        discovery_responses: {
          q1: { answer: 'KH cần lead chất lượng từ Meta' },
        },
        red_flags: ['Budget không rõ'],
      },
      stakeholdersJson: [{ name: 'An', role: 'CEO' }],
    });
    expect(out.currentStatusLines[0]).toContain('Discovery:');
    expect(out.noteLines.some((line) => line.includes('Red flags'))).toBe(true);
    expect(out.noteLines.some((line) => line.includes('Stakeholders'))).toBe(true);
  });
});
