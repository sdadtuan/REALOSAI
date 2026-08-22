/** Mockable OpenAI Whisper entry. Tests replace this. Missing OPENAI_* → whisper_disabled. */
export async function transcribeAudio(_path: string): Promise<string> {
  const key = (process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY ?? '').trim();
  if (!key) {
    throw Object.assign(new Error('whisper_disabled'), { code: 'whisper_disabled' });
  }
  throw Object.assign(new Error('whisper_disabled'), { code: 'whisper_disabled' });
}
