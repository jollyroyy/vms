// The HOD console's row labels, in one place. Extracted from HODConsole.tsx when
// the dashboard's KPI board became drillable (2026-08-16) and a second component
// started printing the same visits: a tile's list and the desk it opens must
// name a visitor, an hour and a host identically, or they read as two records.
//
// Times are IST explicitly (`timeZone: 'Asia/Kolkata'`), never the browser's
// zone — this deployment is IST wherever the laptop is.
import type { Visit } from '../types/index';

export const display = (value: string | null | undefined, options: Intl.DateTimeFormatOptions): string => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not set'
    : new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(date);
};

export const visitTime = (visit: Visit): string =>
  display(visit.scheduled_for ?? visit.created_at, { hour: '2-digit', minute: '2-digit', hour12: false });

export const visitDay = (visit: Visit): string =>
  display(visit.scheduled_for ?? visit.created_at, { weekday: 'long', month: 'short', day: 'numeric' });

export const visitorName = (visit: Visit): string => visit.visitor?.full_name || 'Unnamed visitor';
export const visitorCompany = (visit: Visit): string => visit.visitor?.vendor_name || 'Independent visitor';
export const hostName = (visit: Visit): string => visit.host?.full_name || 'Host to be confirmed';
export const purposeLabel = (visit: Visit): string => visit.purpose.replace(/_/g, ' ');
