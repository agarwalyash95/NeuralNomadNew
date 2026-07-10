/**
 * Decimals-safe price parser.
 * Handles exact matching for digits and the decimal dot.
 * E.g., "Rs 3,500.50" -> 3501, "₹120.00" -> 120, "15,000" -> 15000
 */
export function parsePriceToInteger(priceStr?: string | number): number {
  if (priceStr === undefined || priceStr === null) return 0;
  const str = priceStr.toString().trim();
  
  // Keep only digits and decimal dot
  const cleaned = str.replace(/[^0-9.]/g, '');
  
  // Split on decimal dot to prevent decimals from inflating the value (e.g. 120.00 -> 120)
  const dotIndex = cleaned.indexOf('.');
  let finalStr = cleaned;
  let fraction = 0;
  
  if (dotIndex !== -1) {
    finalStr = cleaned.substring(0, dotIndex);
    const fracStr = cleaned.substring(dotIndex + 1);
    const parsedFrac = parseFloat(`0.${fracStr}`);
    if (!isNaN(parsedFrac)) {
      fraction = parsedFrac;
    }
  }
  
  const parsedInt = parseInt(finalStr, 10);
  if (isNaN(parsedInt)) return 0;
  
  return Math.round(parsedInt + fraction);
}
