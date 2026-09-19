// Minimal RFC 5545 generator. Times are emitted with an explicit TZID plus a
// VTIMEZONE block so calendars in any region resolve them to Waterloo time.

const TZID = 'America/Toronto'

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/** "2026-09-18T15:00:00" -> "20260918T150000" (kept naive, TZID carries the zone). */
const stamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d+$/, '')

/**
 * Adds minutes to a naive local timestamp without letting the browser's own
 * timezone shift it — parse as UTC, do the arithmetic, format straight back.
 */
function addMinutes(iso, minutes) {
  const d = new Date(`${iso}Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString().slice(0, 19)
}

/** Zero-length entries get a 15 minute block so they don't vanish in a calendar. */
const displayEnd = (event) => (event.end === event.start ? addMinutes(event.start, 15) : event.end)

const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const escape = (value) =>
  String(value).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

/** Folds long lines at 75 chars as the spec requires; Outlook rejects unfolded ones. */
function fold(line) {
  if (line.length <= 75) return line
  const out = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    out.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest) out.push(' ' + rest)
  return out.join('\r\n')
}

function toVevent(event, dtstamp) {
  const end = displayEnd(event)
  return [
    'BEGIN:VEVENT',
    `UID:${event.id}@hackthenorth-schedule`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${stamp(event.start)}`,
    `DTEND;TZID=${TZID}:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    event.location ? `LOCATION:${escape(event.location)}` : null,
    `CATEGORIES:${escape(event.category.toUpperCase())}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].filter(Boolean)
}

export function buildIcs(events, calendarName) {
  const dtstamp = utcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hack the North//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
    ...events.flatMap((event) => toVevent(event, dtstamp)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(events, filename, calendarName) {
  const blob = new Blob([buildIcs(events, calendarName)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Google Calendar wants UTC, so shift the naive Waterloo time by its real offset. */
function googleStamp(iso) {
  const offsetMinutes = torontoOffsetMinutes(iso)
  const d = new Date(`${iso}Z`)
  d.setMinutes(d.getMinutes() + offsetMinutes)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Minutes to add to a naive Toronto time to reach UTC (240 during EDT, 300 during EST). */
function torontoOffsetMinutes(iso) {
  const asUtc = new Date(`${iso}Z`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZID,
    timeZoneName: 'shortOffset',
  })
  const part = formatter.formatToParts(asUtc).find((p) => p.type === 'timeZoneName')
  const match = part && part.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 240
  const sign = match[1] === '-' ? 1 : -1
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
}

export function googleCalendarUrl(event) {
  const end = displayEnd(event)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${googleStamp(event.start)}/${googleStamp(end)}`,
    location: event.location || '',
    ctz: TZID,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
