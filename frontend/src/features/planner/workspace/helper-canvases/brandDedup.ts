/** Keep one result per explicit provider brand while preserving score order. */
export function dedupeByBrand<T extends { name: string; details?: Record<string, any> }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const explicit = String(item.details?.brand || item.details?.chain_name || '').trim().toLowerCase();
    if (!explicit) return true;
    if (seen.has(explicit)) return false;
    seen.add(explicit);
    return true;
  });
}
