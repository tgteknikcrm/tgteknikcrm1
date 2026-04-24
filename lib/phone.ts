// Phone normalization helpers for Turkish mobile numbers.
// Used to implement phone+password auth via the virtual-email pattern.

export const VIRTUAL_EMAIL_DOMAIN = "tgteknik.local";

export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("5")) return "+90" + digits;
  if (digits.length === 11 && digits.startsWith("05")) return "+90" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("905")) return "+" + digits;
  if (digits.length === 13 && digits.startsWith("9905")) return "+" + digits.slice(1);
  return null;
}

export function phoneToVirtualEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@${VIRTUAL_EMAIL_DOMAIN}`;
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";
  const n = normalizePhone(phone);
  if (!n) return phone;
  // +905426469070 → +90 542 646 90 70
  const d = n.slice(3);
  return `+90 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}
