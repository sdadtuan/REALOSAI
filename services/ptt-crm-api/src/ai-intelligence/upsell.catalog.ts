import { UpsellPathDef } from './upsell.types';

export const SERVICE_LABELS: Record<string, string> = {
  'dich-vu-seo-tong-the': 'SEO tổng thể',
  'dich-vu-aeo': 'AEO / AI search',
  'dich-vu-seo-local': 'SEO Local',
  'dich-vu-seo-audit': 'SEO Audit',
  'thiet-ke-website-tron-goi': 'Website trọn gói',
  'thiet-ke-website': 'Thiết kế website',
  'thiet-ke-landing-page': 'Landing page',
  'quang-cao-facebook': 'Facebook Ads',
  'quang-cao-google': 'Google Ads',
  'thue-tai-khoan-quang-cao': 'Thuê TK quảng cáo',
  'tiep-thi-noi-dung': 'Tiếp thị nội dung',
};

export const UPSELL_PATH_CATALOG: Record<string, UpsellPathDef[]> = {
  'quang-cao-facebook': [
    {
      target_slug: 'quang-cao-google',
      target_label: 'Google Ads',
      reason: 'Bổ sung kênh Google để capture intent search song song Meta.',
      priority: 10,
    },
    {
      target_slug: 'thiet-ke-landing-page',
      target_label: 'Landing page CRO',
      reason: 'Tối ưu landing page giúp giảm CPL từ traffic Meta.',
      priority: 8,
    },
    {
      target_slug: 'tiep-thi-noi-dung',
      target_label: 'Content marketing',
      reason: 'Nuôi dưỡng audience sau click ads — tăng conversion.',
      priority: 6,
    },
  ],
  'quang-cao-google': [
    {
      target_slug: 'quang-cao-facebook',
      target_label: 'Facebook Ads',
      reason: 'Retargeting và demand gen trên Meta bổ sung Google intent.',
      priority: 10,
    },
    {
      target_slug: 'thiet-ke-landing-page',
      target_label: 'Landing page',
      reason: 'Landing page chuyên biệt theo campaign Google.',
      priority: 7,
    },
  ],
  'dich-vu-seo-tong-the': [
    {
      target_slug: 'dich-vu-aeo',
      target_label: 'AEO / AI search',
      reason: 'Mở rộng visibility trên AI search sau nền SEO organic.',
      priority: 9,
    },
    {
      target_slug: 'tiep-thi-noi-dung',
      target_label: 'Content marketing',
      reason: 'Content retainer duy trì momentum ranking đã đạt.',
      priority: 8,
    },
    {
      target_slug: 'quang-cao-google',
      target_label: 'Google Ads',
      reason: 'Kết hợp paid + organic cho từ khóa chiến lược.',
      priority: 7,
    },
  ],
  'dich-vu-aeo': [
    {
      target_slug: 'dich-vu-seo-tong-the',
      target_label: 'SEO tổng thể',
      reason: 'Triển khai SEO full-funnel sau baseline AEO.',
      priority: 9,
    },
    {
      target_slug: 'tiep-thi-noi-dung',
      target_label: 'Content marketing',
      reason: 'FAQ/AEO content scale cần retainer content.',
      priority: 7,
    },
  ],
  'dich-vu-seo-local': [
    {
      target_slug: 'dich-vu-seo-tong-the',
      target_label: 'SEO tổng thể',
      reason: 'Mở rộng từ local lên organic toàn site.',
      priority: 8,
    },
    {
      target_slug: 'quang-cao-google',
      target_label: 'Google Ads Local',
      reason: 'Local Ads bổ sung Maps/GBP đã tối ưu.',
      priority: 7,
    },
  ],
  'dich-vu-seo-audit': [
    {
      target_slug: 'dich-vu-seo-tong-the',
      target_label: 'SEO triển khai',
      reason: 'Chuyển findings audit sang gói triển khai SEO.',
      priority: 10,
    },
  ],
  'thiet-ke-website-tron-goi': [
    {
      target_slug: 'dich-vu-seo-tong-the',
      target_label: 'SEO tổng thể',
      reason: 'Website mới cần SEO để có traffic organic.',
      priority: 9,
    },
    {
      target_slug: 'quang-cao-facebook',
      target_label: 'Facebook Ads',
      reason: 'Launch ads sau go-live website.',
      priority: 7,
    },
  ],
  'thiet-ke-landing-page': [
    {
      target_slug: 'quang-cao-facebook',
      target_label: 'Facebook Ads',
      reason: 'Drive traffic chất lượng tới landing page mới.',
      priority: 8,
    },
    {
      target_slug: 'quang-cao-google',
      target_label: 'Google Ads',
      reason: 'Search intent traffic cho landing page offer.',
      priority: 7,
    },
  ],
  'tiep-thi-noi-dung': [
    {
      target_slug: 'dich-vu-aeo',
      target_label: 'AEO',
      reason: 'Scale content sang AI search visibility.',
      priority: 7,
    },
    {
      target_slug: 'quang-cao-facebook',
      target_label: 'Facebook Ads',
      reason: 'Amplify content qua paid social.',
      priority: 6,
    },
  ],
  'thue-tai-khoan-quang-cao': [
    {
      target_slug: 'quang-cao-facebook',
      target_label: 'Quản lý Facebook Ads',
      reason: 'Sau thuê TK — upsell full ads management.',
      priority: 9,
    },
    {
      target_slug: 'quang-cao-google',
      target_label: 'Quản lý Google Ads',
      reason: 'Mở rộng sang Google sau khi BM ổn định.',
      priority: 8,
    },
  ],
};

export function serviceLabel(slug: string): string {
  return SERVICE_LABELS[slug] ?? slug.replace(/-/g, ' ');
}
