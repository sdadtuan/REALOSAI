'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PerformanceChannel } from '@/lib/api';
import { PORTAL_CHANNEL_LIST } from '@/lib/portal/channels';

type ChannelSwitcherProps = {
  active: PerformanceChannel;
};

export function ChannelSwitcher({ active }: ChannelSwitcherProps) {
  const pathname = usePathname();

  return (
    <nav className="channel-switcher" aria-label="Chọn kênh quảng cáo">
      {PORTAL_CHANNEL_LIST.map((channel) => {
        const isActive = channel.id === active || pathname === channel.href;
        return (
          <Link
            key={channel.id}
            href={channel.href}
            className={`channel-switcher__item${isActive ? ' channel-switcher__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <strong>{channel.label}</strong>
            <span className="muted">{channel.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
