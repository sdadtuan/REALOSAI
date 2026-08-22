import { OpenAITextGen } from './openai.text';

export const STUB_IDEAS = [
  'Hook 3s + benefit + CTA',
  'Before/after + social proof',
  'Myth vs fact + offer',
] as const;

export interface ITextGen {
  readonly providerName: 'openai' | 'stub';
  complete(input: {
    system: string;
    user: string;
    mode?: 'ideas' | 'video_script';
  }): Promise<unknown>;
}

export type VdIdeaRow = {
  id: number;
  project_id: number;
  ordinal: number;
  summary: string;
  selected: boolean;
};

class StubTextGen implements ITextGen {
  readonly providerName = 'stub' as const;

  complete(_input: {
    system: string;
    user: string;
    mode?: 'ideas' | 'video_script';
  }): Promise<unknown> {
    return Promise.resolve({
      ideas: [
        { summary: STUB_IDEAS[0] },
        { summary: STUB_IDEAS[1] },
        { summary: STUB_IDEAS[2] },
      ],
    });
  }
}

export function selectTextGen(env: { OPENAI_API_KEY: string }): ITextGen {
  const key = (env.OPENAI_API_KEY ?? '').trim();
  if (key) return new OpenAITextGen(key);
  return new StubTextGen();
}

export function parseIdeaSummaries(result: unknown): string[] {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  const ideas = (result as { ideas?: unknown }).ideas;
  if (!Array.isArray(ideas) || ideas.length !== 3) {
    throw Object.assign(new Error('validation'), { error_class: 'validation' });
  }
  return ideas.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    const summary = (item as { summary?: unknown }).summary;
    if (typeof summary !== 'string' || !summary.trim()) {
      throw Object.assign(new Error('validation'), { error_class: 'validation' });
    }
    return summary;
  });
}
