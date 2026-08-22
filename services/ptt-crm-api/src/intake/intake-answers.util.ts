export function extractDiscoveryResponseSnippets(
  answers: Record<string, unknown> | undefined,
  limit = 6,
): string[] {
  if (!answers || typeof answers !== 'object') return [];

  const responses =
    answers.discovery_responses && typeof answers.discovery_responses === 'object'
      ? (answers.discovery_responses as Record<string, unknown>)
      : {};

  const snippets: string[] = [];
  for (const key of Object.keys(responses).sort()) {
    const raw = responses[key];
    if (!raw || typeof raw !== 'object') continue;
    const answer = String((raw as Record<string, unknown>).answer ?? '').trim();
    if (!answer) continue;
    let plain = answer.replace(/</g, ' ').replace(/>/g, ' ');
    if (plain.length > 160) plain = `${plain.slice(0, 157)}…`;
    snippets.push(plain);
    if (snippets.length >= limit) break;
  }

  if (snippets.length > 0) return snippets;

  const phone =
    answers.phone && typeof answers.phone === 'object'
      ? (answers.phone as Record<string, string>)
      : {};
  for (const key of Object.keys(phone).sort((a, b) => {
    const ai = a.startsWith('p') && /^\d+$/.test(a.slice(1)) ? Number(a.slice(1)) : 999;
    const bi = b.startsWith('p') && /^\d+$/.test(b.slice(1)) ? Number(b.slice(1)) : 999;
    return ai - bi;
  })) {
    const val = String(phone[key] ?? '').trim();
    if (!val) continue;
    let plain = val.replace(/</g, ' ').replace(/>/g, ' ');
    if (plain.length > 160) plain = `${plain.slice(0, 157)}…`;
    snippets.push(plain);
    if (snippets.length >= limit) break;
  }

  return snippets;
}
