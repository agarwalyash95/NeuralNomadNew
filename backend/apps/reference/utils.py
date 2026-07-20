import re
import unicodedata

def normalize_display_name(text):
    """
    Normalizes Unicode representation to NFC and collapses double/multiple
    consecutive spaces. Original casing and punctuation are preserved.
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_search_name(text):
    """
    Normalizes name for search purposes:
    1. Lowercase case-folding.
    2. Unicode normalization to NFC.
    3. Normalizes punctuation (hyphens, slash, comma, periods, single quotes) 
       to spaces to avoid dropping letters or joining words incorrectly.
    4. Collapses double/multiple consecutive spaces.
    
    Example: 
    - "New-Delhi" -> "new delhi"
    - "St. John's" -> "st john s"
    """
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    # Replace punctuation characters with a single space
    text = re.sub(r"[''`\-–—.,/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_code(text):
    """
    Normalizes airport/station codes:
    1. Retains only alphanumeric characters (letters and numbers).
    2. Uppercase.
    3. Never removes alphanumeric characters from official station/airport codes.
    
    Example:
    - "ndls " -> "NDLS"
    - " BOM-1" -> "BOM1"
    """
    if not text:
        return ""
    text = re.sub(r"[^a-zA-Z0-9]", "", text)
    return text.upper().strip()
