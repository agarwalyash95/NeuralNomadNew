"""
Opening-hours utilities — the single source of truth for parsing the
`opening_hours` JSONField format shared by HotelMaster/RestaurantMaster/
AttractionMaster/ActivityMaster:
  ["Monday: 9:00 AM – 6:00 PM", "Tuesday: Closed", ...]

_parse_hours_line is the canonical parser. is_open_at is the higher-level
helper: True = the place is open at that time on that weekday, False = it is
demonstrably closed, None = data unavailable/unparseable (never blocks —
an unparseable hours line is a gap, not a guess).
"""

import re
from datetime import date as date_cls


def _parse_hours_line(line):
    """
    'Monday: 9:00 AM – 6:00 PM' -> (540, 1080). None if closed/unparseable.
    """
    if not line:
        return None
    text = re.sub(r"^[A-Za-z]+:\s*", "", str(line)).strip()
    if not text or "closed" in text.lower():
        return None
    parts = re.split(r"[–—-]", text)
    if len(parts) != 2:
        return None

    def _clock(token):
        m = re.match(r"(\d{1,2}):(\d{2})\s*([AaPp][Mm])?", token.strip())
        if not m:
            return None
        hour, minute, ampm = int(m.group(1)), int(m.group(2)), m.group(3)
        if ampm:
            ampm = ampm.upper()
            if ampm == "PM" and hour != 12:
                hour += 12
            if ampm == "AM" and hour == 12:
                hour = 0
        return hour * 60 + minute

    open_mins, close_mins = _clock(parts[0]), _clock(parts[1])
    if open_mins is None or close_mins is None:
        return None
    return open_mins, close_mins


def is_open_at(opening_hours, date_str, start_time):
    """
    True  — place is open at start_time on that date (within hours window)
    False — place is demonstrably closed (hours parsed, time is outside)
    None  — data insufficient to determine (missing field, parse fail, overnight)

    opening_hours: list of strings, one per weekday starting Monday (index 0).
    date_str: 'YYYY-MM-DD'
    start_time: 'HH:MM'
    """
    if not opening_hours or not date_str or not start_time:
        return None
    try:
        weekday = date_cls.fromisoformat(date_str).weekday()
    except (ValueError, TypeError):
        return None
    if weekday >= len(opening_hours):
        return None

    parsed = _parse_hours_line(opening_hours[weekday])
    if parsed is None:
        return None
    open_mins, close_mins = parsed
    if open_mins > close_mins:
        return None  # overnight window — outside the common case, skip

    try:
        h, m = str(start_time).split(":")[:2]
        visit_mins = int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None

    return open_mins <= visit_mins <= close_mins
