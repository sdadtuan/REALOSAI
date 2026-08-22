import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="portal-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="portal-breadcrumb__segment">
            {index > 0 ? <span className="portal-breadcrumb__sep" aria-hidden="true">›</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="portal-breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'portal-breadcrumb__current' : 'portal-breadcrumb__text'}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
