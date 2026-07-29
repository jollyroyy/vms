export type DailyVisitorType = 'maid' | 'worker' | 'vendor';

export type DailyVisitor = {
  id: string;
  full_name: string;
  type: DailyVisitorType;
  department: string;
  phone: string;
  photo_url: string | null;
  last_visit_date: string | null;
  is_active: boolean;
  checked_in_today: boolean;
};

export const TYPE_META: Record<DailyVisitorType, { label: string; color: string; bg: string }> = {
  maid:    { label: 'Maid',    color: 'text-accent-600',  bg: 'bg-accent-50 border-accent-200/60' },
  worker:  { label: 'Worker',  color: 'text-brand-600',   bg: 'bg-brand-50 border-brand-200/60' },
  vendor:  { label: 'Vendor',  color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200/60' },
};

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
