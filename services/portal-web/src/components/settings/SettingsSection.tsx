import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <section className={['settings-section', className].filter(Boolean).join(' ')}>
      <header className="settings-section__header">
        <h2 className="settings-section__title">{title}</h2>
        {description ? <p className="muted settings-section__desc">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
