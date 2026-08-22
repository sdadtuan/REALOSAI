export async function providerFetch(
  input: Parameters<typeof fetch>[0],
  init: RequestInit | undefined,
  label: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    throw Object.assign(
      new Error(`${label}:${err instanceof Error ? err.message : 'network'}`),
      { error_class: 'transient' },
    );
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('auth');
    if (res.status === 429) {
      throw Object.assign(new Error(`${label}:${res.status}`), { error_class: 'rate_limit' });
    }
    if (res.status >= 500) {
      throw Object.assign(new Error(`${label}:${res.status}`), { error_class: 'transient' });
    }
    throw Object.assign(new Error(`${label}:${res.status}`), { error_class: 'provider' });
  }
  return res;
}
