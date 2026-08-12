export function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/\s+/g, " ");
}
