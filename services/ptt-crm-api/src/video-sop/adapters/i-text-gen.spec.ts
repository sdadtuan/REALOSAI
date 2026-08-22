import { selectTextGen, STUB_IDEAS } from './i-text-gen';

describe('selectTextGen', () => {
  it('selects stub when OPENAI_API_KEY empty', () => {
    expect(selectTextGen({ OPENAI_API_KEY: '' }).providerName).toBe('stub');
  });

  it('selects openai when OPENAI_API_KEY is nonempty', () => {
    expect(selectTextGen({ OPENAI_API_KEY: 'sk-test' }).providerName).toBe('openai');
  });

  it('stub complete resolves three STUB_IDEAS summaries', async () => {
    const result = await selectTextGen({ OPENAI_API_KEY: '' }).complete({
      system: 'director',
      user: 'ideas',
    });
    expect(result).toEqual({
      ideas: [
        { summary: STUB_IDEAS[0] },
        { summary: STUB_IDEAS[1] },
        { summary: STUB_IDEAS[2] },
      ],
    });
  });
});
