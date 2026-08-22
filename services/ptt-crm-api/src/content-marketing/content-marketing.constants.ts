/** Content Marketing OS — shared constants (spec §8, §12). */

export const CMKT_ITEM_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'approved_internal',
  'pending_client',
  'client_approved',
  'scheduled',
  'published',
  'archived',
] as const;

export const CMKT_IDEA_STATUSES = ['backlog', 'shortlisted', 'converted', 'archived'] as const;

export const CMKT_CHANNELS = [
  'website',
  'facebook',
  'linkedin',
  'short_video',
  'youtube',
  'newsletter',
  'drip',
  'zalo_oa',
  'meta_ads',
  'google_ads',
  'document',
] as const;

export const CMKT_FORMATS = [
  'blog',
  'social_post',
  'carousel',
  'email',
  'video_script',
  'ad_copy',
] as const;

/** P0 default channel hints for empty lifecycle. */
export const CMKT_P0_CHANNEL_DEFAULTS = ['website', 'facebook', 'linkedin'] as const;

/** SLA hours for in_review queue (§22.3). */
export const CMKT_REVIEW_SLA_HOURS = 48;

export const CMKT_PILOT_SLUG_DEFAULT = 'tiep-thi-noi-dung';
