#!/usr/bin/env python3
"""Extract events from the scraped Hack the North calendar HTML into events.json.

The scraped DOM only carries clock times (no dates), but the blocks are emitted
in ascending chronological order starting at the grid's first divider (Fri 3pm).
So we walk the list and roll the date forward whenever a start time wraps past
midnight. End times use the next occurrence of that clock time after the start.
"""
import html
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "schedule.html"
OUT = ROOT / "src" / "data" / "events.json"

# Hack the North 2026: Fri Sep 18 - Sun Sep 20, Waterloo (America/Toronto).
FIRST_DAY = datetime(2026, 9, 18)
GRID_START = FIRST_DAY.replace(hour=15)  # the calendar's first divider: Fri 3pm
TIMEZONE = "America/Toronto"

EVENT_RE = re.compile(r'<div class="sc-gUjEZj [^"]+">(.*?)</div></div>', re.S)
P_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.S)
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$")

# Ordered rules: first matching pattern wins.
CATEGORIES = [
    ("food", r"breakfast|lunch|dinner|snack|ramen|bubble tea|walking tacos|soda lab|dessert|hacky hour"),
    ("ceremony", r"ceremonies|judging"),
    ("workshop", r"workshop|lightning challenge|^mlh:"),
    ("logistics", r"registration|hardware|3d printing|checkout|^hacking$"),
    ("talk", r"panel|meetup|coffee chats|power hour|showcase|:| - "),
]
DEFAULT_CATEGORY = "activity"


def categorize(title: str) -> str:
    low = title.lower()
    for name, pattern in CATEGORIES:
        if re.search(pattern, low):
            return name
    return DEFAULT_CATEGORY


def parse_clock(hour: str, minute: str, meridiem: str) -> timedelta:
    h = int(hour) % 12
    if meridiem == "PM":
        h += 12
    return timedelta(hours=h, minutes=int(minute))


def next_occurrence(after: datetime, clock: timedelta) -> datetime:
    day = after.replace(hour=0, minute=0, second=0, microsecond=0)
    candidate = day + clock
    while candidate < after:
        candidate += timedelta(days=1)
    return candidate


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main() -> None:
    raw = SRC.read_text()
    events = []
    cursor = GRID_START  # earliest possible start for the next event
    seen_ids = set()

    for block in EVENT_RE.findall(raw):
        parts = [html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in P_RE.findall(block)]
        if len(parts) != 3:
            raise SystemExit(f"unexpected event block shape: {parts!r}")
        title, location, times = parts

        m = TIME_RE.match(times)
        if not m:
            raise SystemExit(f"unparsable time range {times!r} for {title!r}")

        start = next_occurrence(cursor, parse_clock(*m.group(1, 2, 3)))
        end = next_occurrence(start, parse_clock(*m.group(4, 5, 6)))
        cursor = start  # blocks are ordered by start time

        base = slugify(f"{title}-{start:%m%d-%H%M}")
        uid = base
        n = 2
        while uid in seen_ids:
            uid, n = f"{base}-{n}", n + 1
        seen_ids.add(uid)

        events.append({
            "id": uid,
            "title": title,
            "location": location,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "category": categorize(title),
        })

    payload = {
        "name": "Hack the North 2026",
        "timezone": TIMEZONE,
        "rangeStart": FIRST_DAY.date().isoformat(),
        "rangeEnd": (FIRST_DAY + timedelta(days=3)).date().isoformat(),
        "generatedFrom": SRC.name,
        "events": events,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {len(events)} events -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
