import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;
  return (
    <nav className="ops-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="ops-breadcrumb__segment">
            {index > 0 ? <span className="ops-breadcrumb__sep" aria-hidden="true">›</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="ops-breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'ops-breadcrumb__current' : 'ops-breadcrumb__text'}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
