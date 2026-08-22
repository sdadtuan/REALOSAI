import Link from 'next/link';
import { PORTAL_CHANNEL_LIST } from '@/lib/portal/channels';

export function ChannelQuickLinks() {
  return (
    <nav className="channel-quick-links" aria-label="Kênh quảng cáo">
      {PORTAL_CHANNEL_LIST.map((channel) => (
        <Link key={channel.id} href={channel.href} className="channel-quick-links__item">
          <strong>{channel.label}</strong>
          <span className="muted">{channel.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
