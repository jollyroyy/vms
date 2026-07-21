export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 4) return '••••';
  return phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0) + '•••';
  return parts[0]!.charAt(0) + '••• ' + parts.slice(1).map((p) => p.charAt(0) + '•••').join(' ');
}
