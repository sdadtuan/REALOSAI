/** Parse @email mentions from activity text (WIN-4-D). */
export function parseMentionEmails(content: string): string[] {
  const text = String(content ?? '');
  const matches = text.match(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) ?? [];
  const emails = matches.map((m) => m.slice(1).trim().toLowerCase());
  return [...new Set(emails)];
}
