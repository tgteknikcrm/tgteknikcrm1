/**
 * Translate raw Postgres / RLS errors into messages an operator can act on.
 * Centralized so every module's actions.ts uses the same Turkish copy.
 */
export function humanizeDeleteError(raw: string, entity: string): string {
  const m = raw.toLowerCase();
  if (m.includes("foreign key") || m.includes("violates")) {
    return `${entity} silinemedi: bağlı kayıtlar var.`;
  }
  if (m.includes("permission") || m.includes("rls") || m.includes("policy")) {
    return `${entity} silme yetkin yok.`;
  }
  if (m.includes("not found") || m.includes("no rows")) {
    return `${entity} bulunamadı (zaten silinmiş olabilir).`;
  }
  return raw;
}
