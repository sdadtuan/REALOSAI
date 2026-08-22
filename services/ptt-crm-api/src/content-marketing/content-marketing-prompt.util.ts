import { createHash } from 'crypto';
import type { CmktItemRow } from './content-marketing.types';

export const CMKT_PROMPT_VERSION = 'cmkt-v1';

export type CmktPromptProfile =
  | 'blog_website'
  | 'social_fb'
  | 'social_fb_carousel'
  | 'social_li'
  | 'social_li_carousel'
  | 'video_short'
  | 'email_broadcast'
  | 'ad_meta'
  | 'ad_google'
  | 'generic';

export type CmktGenerateTone = 'professional_friendly' | 'bold' | 'casual' | 'formal';
export type CmktGenerateLength = 'short' | 'medium' | 'long';

export type CmktGenerateInput = {
  tone?: CmktGenerateTone;
  length?: CmktGenerateLength;
  goal?: string;
  include_outline?: boolean;
  variant_count?: number;
};

export type CmktRegenerateMode = 'rewrite' | 'refresh';

export type CmktRegenerateInput = CmktGenerateInput & {
  mode?: CmktRegenerateMode;
  reason?: string;
};

const PROFILE_RULES: Record<CmktPromptProfile, string> = {
  blog_website: 'Blog SEO-friendly: H1 rõ, intro hook, 3–5 sections, CTA cuối bài.',
  social_fb: 'Facebook social_post: hook ≤125 ký tự; body ≤500; 1 CTA; hashtag ≤5.',
  social_fb_carousel: 'Facebook carousel: 5 slide titles + caption ngắn.',
  social_li: 'LinkedIn social_post: thought leadership, hook chuyên nghiệp, body ≤700.',
  social_li_carousel: 'LinkedIn carousel: 5 slide headlines + caption.',
  video_short: 'Short video script: hook 3s, beats, CTA cuối ≤60s.',
  email_broadcast: 'Newsletter email: subject ≤50, preheader, scannable sections, 1 CTA.',
  ad_meta: 'Meta ad: headline ≤40, primary text ngắn, CTA chuẩn Meta.',
  ad_google: 'Google RSA: headline ≤30×3, description ≤90.',
  generic: 'Content marketing draft theo brand voice và funnel goal.',
};

export function resolvePromptProfile(channel: string, format: string): CmktPromptProfile {
  if (channel === 'website' && format === 'blog') return 'blog_website';
  if (channel === 'facebook' && format === 'social_post') return 'social_fb';
  if (channel === 'facebook' && format === 'carousel') return 'social_fb_carousel';
  if (channel === 'linkedin' && format === 'social_post') return 'social_li';
  if (channel === 'linkedin' && format === 'carousel') return 'social_li_carousel';
  if (channel === 'short_video' && format === 'video_script') return 'video_short';
  if ((channel === 'newsletter' || channel === 'drip') && format === 'email') return 'email_broadcast';
  if (channel === 'meta_ads' && format === 'ad_copy') return 'ad_meta';
  if (channel === 'google_ads' && format === 'ad_copy') return 'ad_google';
  return 'generic';
}

export function hashPrompt(system: string, user: string): string {
  return createHash('sha256').update(`${CMKT_PROMPT_VERSION}\n${system}\n${user}`).digest('hex').slice(0, 32);
}

export function buildDraftSystemPrompt(profile: CmktPromptProfile): string {
  return [
    'You are a senior content marketer for B2B brands in Vietnam.',
    `Profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    'Return JSON: { "markdown": string, "outline"?: string[] }',
  ].join('\n');
}

export function buildVariantsSystemPrompt(profile: CmktPromptProfile): string {
  return [
    'You generate headline/hook/CTA variants for content marketing.',
    `Profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    'Return JSON: { "variants": string[] } with distinct options.',
  ].join('\n');
}

export function buildDraftUserPrompt(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): string {
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  const tone = input.tone ?? 'professional_friendly';
  const length = input.length ?? 'medium';
  const goal = input.goal || item.funnel_goal || 'engagement';
  const hook = String(item.brief_json?.hook ?? '').trim();
  return [
    `Brand: ${brand}`,
    brandContext.objective ? `Objective: ${brandContext.objective}` : '',
    brandContext.usp ? `USP: ${brandContext.usp}` : '',
    brandContext.tone_lock ? `Tone lock: ${brandContext.tone_lock}` : '',
    `Title: ${item.title}`,
    `Channel: ${item.channel} / ${item.format}`,
    `Funnel goal: ${goal}`,
    `Tone: ${tone}, Length: ${length}`,
    hook ? `Seed hook: ${hook}` : '',
    input.include_outline !== false ? 'Include outline sections in markdown.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildVariantsUserPrompt(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): string {
  const count = Math.min(Math.max(Number(input.variant_count ?? 3), 3), 5);
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  return [
    `Brand: ${brand}`,
    `Title: ${item.title}`,
    `Channel: ${item.channel} / ${item.format}`,
    `Goal: ${input.goal || item.funnel_goal || 'engagement'}`,
    `Generate exactly ${count} distinct hook/headline variants (Vietnamese).`,
    item.body_json?.markdown ? `Current body excerpt: ${String(item.body_json.markdown).slice(0, 280)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRegenerateSystemPrompt(
  profile: CmktPromptProfile,
  mode: CmktRegenerateMode,
): string {
  const modeRule =
    mode === 'refresh'
      ? 'Refresh: giữ cấu trúc chính, cập nhật hook/CTA và làm mới wording.'
      : 'Rewrite: viết lại toàn bộ theo brief, tone và reason — có thể đổi cấu trúc.';
  return [
    'You rewrite existing marketing content based on human feedback.',
    `Profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    modeRule,
    'Return JSON: { "markdown": string, "outline"?: string[] }',
  ].join('\n');
}

export function buildRegenerateUserPrompt(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktRegenerateInput,
  existingMarkdown: string,
): string {
  const draftBase = buildDraftUserPrompt(item, brandContext, input);
  const mode = input.mode ?? 'rewrite';
  const reason = String(input.reason ?? '').trim();
  return [
    draftBase,
    `Mode: ${mode}`,
    reason ? `Rewrite reason: ${reason}` : '',
    'Existing draft to improve:',
    existingMarkdown.slice(0, 6000),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDraftStub(
  item: CmktItemRow,
  brandContext: Record<string, unknown>,
  input: CmktGenerateInput,
): Record<string, unknown> {
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  const hook = String(item.brief_json?.hook ?? item.title).trim();
  const goal = input.goal || item.funnel_goal || 'engagement';
  const outline = [
    `Giới thiệu ${brand}`,
    `Vấn đề & insight (${goal})`,
    'Giải pháp / giá trị',
    'CTA',
  ];
  const markdown = [
    `# ${item.title}`,
    '',
    `**${hook || `Khám phá ${brand} — giải pháp cho ${goal}`}**`,
    '',
    `## ${outline[0]}`,
    '',
    `${brand} giúp doanh nghiệp đạt mục tiêu ${goal} với nội dung nhất quán trên ${item.channel}.`,
    '',
    `## ${outline[1]}`,
    '',
    'Insight ngắn gọn cho đối tượng B2B — pain point và cơ hội.',
    '',
    `## ${outline[2]}`,
    '',
    String(brandContext.usp ?? 'USP cốt lõi — lợi ích đo lường được.'),
    '',
    `## ${outline[3]}`,
    '',
    '👉 Liên hệ / đăng ký để nhận tư vấn.',
  ].join('\n');
  return { markdown, outline };
}

export function buildVariantsStub(item: CmktItemRow, input: CmktGenerateInput): Record<string, unknown> {
  const count = Math.min(Math.max(Number(input.variant_count ?? 3), 3), 5);
  const base = String(item.title).slice(0, 80);
  const variants: string[] = [];
  for (let i = 0; i < count; i++) {
    variants.push(`${base} — góc nhìn ${i + 1}: ${item.funnel_goal || 'engagement'}`);
  }
  return { variants };
}

export function normalizeDraftOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
): { markdown: string; outline?: string[] } {
  const markdown = String(parsed.markdown ?? fallback.markdown ?? '').trim();
  const outline = Array.isArray(parsed.outline)
    ? parsed.outline.map((x) => String(x))
    : (fallback.outline as string[] | undefined);
  return { markdown, outline };
}

export function normalizeVariantsOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
  minCount = 3,
): string[] {
  const raw = Array.isArray(parsed.variants) ? parsed.variants : fallback.variants;
  const variants = (raw as unknown[]).map((v) => String(v).trim()).filter(Boolean);
  const fallbackVariants = Array.isArray(fallback.variants) ? (fallback.variants as string[]) : [];
  while (variants.length < minCount) {
    variants.push(`${fallbackVariants[0] ?? 'Variant'} ${variants.length + 1}`);
  }
  return variants.slice(0, 5);
}

export function buildRepurposeSystemPrompt(profile: CmktPromptProfile): string {
  return [
    'You repurpose approved blog content into a new channel/format.',
    `Target profile: ${profile}. Rules: ${PROFILE_RULES[profile]}`,
    'Return JSON: { "markdown": string }',
  ].join('\n');
}

export function buildRepurposeUserPrompt(
  source: CmktItemRow,
  target: { channel: string; format: string; title: string },
  brandContext: Record<string, unknown>,
  optimizeHooks: boolean,
): string {
  const brand = String(brandContext.brand_name ?? 'Thương hiệu').trim();
  const excerpt = String(source.body_json?.markdown ?? '').slice(0, 4000);
  return [
    `Brand: ${brand}`,
    `Source blog title: ${source.title}`,
    `Target: ${target.channel} / ${target.format}`,
    `Derived title: ${target.title}`,
    optimizeHooks ? 'Optimize hook/opening for the target channel.' : '',
    'Source markdown:',
    excerpt,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildRepurposeStub(
  source: CmktItemRow,
  target: { channel: string; format: string; title: string },
): Record<string, unknown> {
  const hook = String(source.brief_json?.hook ?? source.title).trim();
  const excerpt = String(source.body_json?.markdown ?? '').split('\n').slice(0, 3).join('\n');
  const markdown = [`**${hook}**`, '', excerpt, '', `→ ${target.channel} / ${target.format}`].join('\n');
  return { markdown };
}

export function normalizeRepurposeOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
): { markdown: string } {
  return { markdown: String(parsed.markdown ?? fallback.markdown ?? '').trim() };
}

export type CmktBulkIdeaDraft = {
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  pillar_name?: string;
};

export function buildIdeasBulkSystemPrompt(): string {
  return [
    'You are a content marketing strategist.',
    'Generate a monthly backlog of content ideas aligned to brand pillars and funnel goals.',
    'Return JSON: { "ideas": [{ "title", "hook", "target_goal", "channel_hints": string[], "pillar_name"?: string }] }',
    `Prompt version: ${CMKT_PROMPT_VERSION} profile=ideas_monthly`,
  ].join('\n');
}

export function buildIdeasBulkUserPrompt(
  brand: { brand_name: string; audience: string; pillars: Array<{ name: string; goal: string }> },
  input: { idea_count?: number; month_label?: string },
): string {
  const count = Math.min(Math.max(Number(input.idea_count ?? 30), 10), 40);
  const pillars = brand.pillars.map((p) => `${p.name}: ${p.goal}`).join('; ') || 'General brand';
  return [
    `Brand: ${brand.brand_name}`,
    `Audience: ${brand.audience}`,
    `Pillars: ${pillars}`,
    `Month: ${input.month_label ?? 'next month'}`,
    `Generate exactly ${count} distinct ideas.`,
  ].join('\n');
}

export function buildIdeasBulkStub(
  brand: { brand_name: string; pillars: Array<{ name: string; goal: string }> },
  input: { idea_count?: number },
): Record<string, unknown> {
  const count = Math.min(Math.max(Number(input.idea_count ?? 30), 10), 40);
  const pillarNames = brand.pillars.map((p) => p.name);
  const ideas: CmktBulkIdeaDraft[] = [];
  for (let i = 0; i < count; i++) {
    const pillar = pillarNames[i % Math.max(pillarNames.length, 1)] ?? 'Brand';
    ideas.push({
      title: `${brand.brand_name} — ${pillar} idea ${i + 1}`,
      hook: `Hook ${i + 1} for ${pillar}`,
      target_goal: 'engagement',
      channel_hints: i % 2 === 0 ? ['facebook'] : ['linkedin'],
      pillar_name: pillar,
    });
  }
  return { ideas };
}

export function normalizeIdeasBulkOutput(
  parsed: Record<string, unknown>,
  fallback: Record<string, unknown>,
  minCount = 30,
): CmktBulkIdeaDraft[] {
  const raw = (parsed.ideas ?? fallback.ideas) as unknown;
  const list = Array.isArray(raw) ? raw : [];
  const out: CmktBulkIdeaDraft[] = list
    .map((row) => {
      const r = row as Record<string, unknown>;
      const title = String(r.title ?? '').trim();
      if (!title) return null;
      return {
        title,
        hook: String(r.hook ?? '').trim(),
        target_goal: String(r.target_goal ?? 'engagement').trim(),
        channel_hints: Array.isArray(r.channel_hints)
          ? r.channel_hints.map((v) => String(v))
          : [],
        pillar_name: r.pillar_name != null ? String(r.pillar_name) : undefined,
      };
    })
    .filter(Boolean) as CmktBulkIdeaDraft[];
  if (out.length >= minCount) return out.slice(0, minCount);
  const stub = buildIdeasBulkStub(
    { brand_name: 'Brand', pillars: [{ name: 'Core', goal: 'awareness' }] },
    { idea_count: minCount },
  );
  const stubIdeas = (stub.ideas as CmktBulkIdeaDraft[]) ?? [];
  return [...out, ...stubIdeas].slice(0, minCount);
}
