export function emptyBodyJson(): { markdown: string; html: string; variants: string[] } {
  return { markdown: '', html: '', variants: [] };
}

export function bodyHasContent(body: { markdown?: string; html?: string } | null | undefined): boolean {
  const md = String(body?.markdown ?? '').trim();
  const html = String(body?.html ?? '').trim();
  return md.length > 0 || html.length > 0;
}
