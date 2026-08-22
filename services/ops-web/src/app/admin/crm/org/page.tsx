import { redirect } from 'next/navigation';

export default function AdminOrgIndexPage() {
  redirect('/admin/crm/org/users');
}
