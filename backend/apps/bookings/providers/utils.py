"""
Helper functions for location parsing, IATA/station code extraction, and mock result generation.
"""

import re
from typing import Tuple

CITY_TO_IATA = {
    'delhi': ('Delhi', 'DEL'),
    'new delhi': ('New Delhi', 'DEL'),
    'mumbai': ('Mumbai', 'BOM'),
    'kolkata': ('Kolkata', 'CCU'),
    'kochi': ('Kochi', 'COK'),
    'cochin': ('Kochi', 'COK'),
    'bangalore': ('Bengaluru', 'BLR'),
    'bengaluru': ('Bengaluru', 'BLR'),
    'chennai': ('Chennai', 'MAA'),
    'hyderabad': ('Hyderabad', 'HYD'),
    'goa': ('Goa', 'GOI'),
    'jaipur': ('Jaipur', 'JAI'),
    'chandigarh': ('Chandigarh', 'IXC'),
    'manali': ('Manali', 'KUU'),
    'bhuntar': ('Bhuntar', 'KUU'),
    'kullu': ('Kullu', 'KUU'),
    'pune': ('Pune', 'PNQ'),
    'ahmedabad': ('Ahmedabad', 'AMD'),
    'lucknow': ('Lucknow', 'LKO'),
    'guwahati': ('Guwahati', 'GAU'),
    'patna': ('Patna', 'PAT'),
    'srinagar': ('Srinagar', 'SXR'),
    'varanasi': ('Varanasi', 'VNS'),
}

CITY_TO_TRAIN_STATION = {
    'delhi': ('New Delhi', 'NDLS'),
    'new delhi': ('New Delhi', 'NDLS'),
    'mumbai': ('Mumbai Central', 'MMCT'),
    'kolkata': ('Howrah Jn', 'HWH'),
    'kochi': ('Ernakulam Jn', 'ERS'),
    'cochin': ('Ernakulam Jn', 'ERS'),
    'bangalore': ('KSR Bengaluru', 'SBC'),
    'bengaluru': ('KSR Bengaluru', 'SBC'),
    'chennai': ('Chennai Central', 'MAS'),
    'hyderabad': ('Secunderabad', 'SC'),
    'goa': ('Madgaon', 'MAO'),
    'jaipur': ('Jaipur', 'JP'),
    'chandigarh': ('Chandigarh', 'CDG'),
    'pune': ('Pune Jn', 'PUNE'),
    'ahmedabad': ('Ahmedabad Jn', 'ADI'),
}


def parse_location(raw_text: str, default_city: str = 'Delhi', default_code: str = 'DEL') -> Tuple[str, str]:
    """
    Parses a location string like 'Kolkata (CCU)' or 'kochi' or 'New Delhi (NDLS)'.
    Returns (clean_city_name, code).
    """
    if not raw_text or not raw_text.strip():
        return default_city, default_code

    clean = raw_text.strip()

    # Case 1: Format with code in parentheses: "Kolkata (CCU)" or "Chandigarh / CDG"
    match = re.search(r'([^(]+)\s*\(([^)]+)\)', clean)
    if match:
        city = match.group(1).strip()
        code = match.group(2).strip().upper()
        return city, code

    # Case 2: Slash format "Delhi / DEL"
    if '/' in clean:
        parts = clean.split('/')
        return parts[0].strip(), parts[1].strip().upper()

    # Case 3: Lookup in city dictionary
    lower_clean = clean.lower()
    for key, (city_name, code) in CITY_TO_IATA.items():
        if key in lower_clean:
            return city_name, code

    # Case 4: Single word capital code like "CCU" or "COK"
    if len(clean) == 3 and clean.isalpha():
        code = clean.upper()
        # Reverse lookup code
        for c_name, c_code in CITY_TO_IATA.values():
            if c_code == code:
                return c_name, code
        return clean.upper(), code

    # Fallback: Capitalize input as city, derive 3-letter code
    city_name = clean.title()
    code = clean[:3].upper()
    return city_name, code
