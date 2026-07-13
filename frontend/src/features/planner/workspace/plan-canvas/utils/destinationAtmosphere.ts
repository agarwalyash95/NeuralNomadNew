export type DestType = 'mountain' | 'beach' | 'city' | 'snow' | 'desert';

const KEYWORDS: Record<Exclude<DestType, 'city'>, string[]> = {
  mountain: ['manali', 'shimla', 'darjeeling', 'ooty', 'munnar', 'sikkim', 'alps', 'himalaya', 'hill'],
  snow: ['ladakh', 'gulmarg', 'auli', 'switzerland', 'zermatt', 'aspen', 'iceland', 'lapland'],
  beach: ['goa', 'bali', 'maldives', 'phuket', 'andaman', 'lakshadweep', 'hawaii', 'cancun', 'seychelles'],
  desert: ['jaisalmer', 'dubai', 'rajasthan', 'sahara', 'jodhpur', 'abu dhabi', 'namib'],
};

/**
 * inferDestType — activates the destination-atmosphere token system
 * (globals.css `[data-dest-type]`) with a simple keyword heuristic. No
 * geo-classification exists in the data model, so this degrades safely to
 * the neutral "city" tint whenever a destination isn't recognized rather
 * than guessing wrong.
 */
export function inferDestType(destinationName: string | undefined | null): DestType {
  if (!destinationName) return 'city';
  const name = destinationName.toLowerCase();
  for (const [type, keywords] of Object.entries(KEYWORDS) as [Exclude<DestType, 'city'>, string[]][]) {
    if (keywords.some((kw) => name.includes(kw))) return type;
  }
  return 'city';
}
