import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import schedule from "./data/events.json";
import { downloadIcs, googleCalendarUrl } from "./lib/ics";
import EventDetails from "./components/EventDetails";
import PickButton from "./components/PickButton";
import SelectionBar from "./components/SelectionBar";

const CATEGORIES = [
  { id: "ceremony", label: "Ceremonies" },
  { id: "workshop", label: "Workshops" },
  { id: "talk", label: "Talks & meetups" },
  { id: "food", label: "Food" },
  { id: "activity", label: "Activities" },
  { id: "logistics", label: "Logistics" },
];

const VIEWS = [
  { id: "timeGridDay", label: "Day" },
  { id: "weekendGrid", label: "Week" },
  { id: "weekendList", label: "List" },
];

const DAYS = (() => {
  const out = [];
  const cursor = new Date(`${schedule.rangeStart}T00:00:00`);
  const end = new Date(`${schedule.rangeEnd}T00:00:00`);
  while (cursor < end) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
})();

const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;

/** Clamp "now" into the event window so the app is useful before and after the weekend. */
function initialDay() {
  const today = isoDay(new Date());
  return DAYS.some((d) => isoDay(d) === today) ? today : isoDay(DAYS[0]);
}

export default function App() {
  const calendarRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 720px)").matches
  );
  const [view, setView] = useState("weekendList");
  const [activeDay, setActiveDay] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [detail, setDetail] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => wallNow(schedule.timezone));

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(wallNow(schedule.timezone)), 60_000);
    return () => clearInterval(id);
  }, []);

  const events = useMemo(
    () =>
      schedule.events
        .filter((e) => selected.size === 0 || selected.has(e.category))
        .filter((e) => !activeDay || eventOverlapsDay(e, activeDay))
        .filter((e) => {
          if (!query.trim()) return true;
          const q = query.trim().toLowerCase();
          return (
            e.title.toLowerCase().includes(q) ||
            e.location.toLowerCase().includes(q)
          );
        })
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end === e.start ? undefined : e.end,
          classNames: [
            `cat-${e.category}`,
            picked.has(e.id) ? "is-picked" : "",
            isPastEvent(e, now) ? "is-past" : "",
          ].filter(Boolean),
          extendedProps: e,
        })),
    [selected, query, picked, activeDay, now]
  );

  const goToView = useCallback(
    (nextView) => {
      setView(nextView);
      const api = calendarRef.current?.getApi();
      if (!api) return;
      // The multi-day views span the whole event, so they always start at day one.
      if (nextView === "timeGridDay")
        api.changeView(nextView, activeDay ?? initialDay());
      else api.changeView(nextView, schedule.rangeStart);
    },
    [activeDay]
  );

  const goToDay = useCallback(
    (day) => {
      const api = calendarRef.current?.getApi();
      if (activeDay === day) {
        setActiveDay(null);
        if (view === "timeGridDay") {
          setView("weekendList");
          api?.changeView("weekendList", schedule.rangeStart);
        }
        return;
      }
      setActiveDay(day);
      if (!api) return;
      if (view !== "timeGridDay") {
        const section = api.el.querySelector(`[data-date="${day}"]`);
        if (!section) return;
        const sticky = document.querySelector(".controls");
        const offset = (sticky?.getBoundingClientRect().height ?? 0) + 8;
        const top =
          section.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      api.gotoDate(day);
    },
    [view, activeDay]
  );

  useEffect(() => {
    if (isMobile && view !== "weekendList") goToView("weekendList");
  }, [isMobile, view, goToView]);

  const togglePick = useCallback((id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Export in schedule order rather than the order they were clicked.
  const exportPicked = () => {
    const chosen = schedule.events.filter((e) => picked.has(e.id));
    downloadIcs(
      chosen,
      `hack-the-north-${chosen.length}-events`,
      `${schedule.name} — selection`
    );
  };

  const renderEvent = useCallback(
    (arg) => {
      const event = arg.event.extendedProps;
      const pick = (
        <PickButton
          picked={picked.has(event.id)}
          onToggle={() => togglePick(event.id)}
          title={event.title}
        />
      );

      if (arg.view.type === "weekendList") {
        return (
          <div className="ev ev--list">
            <span className="ev__text">
              <span className="ev__title">{arg.event.title}</span>
              <span className="ev__loc">{event.location}</span>
            </span>
            {pick}
          </div>
        );
      }

      // How much fits depends on the rendered block height, not the event duration:
      // FullCalendar splits events across midnight. A container query on the block
      // sheds the location, the select box, then collapses to one line, as it shrinks.
      return (
        <div className="ev">
          <span className="ev__time">{arg.timeText}</span>
          <span className="ev__title">{arg.event.title}</span>
          <span className="ev__loc">{event.location}</span>
          {pick}
        </div>
      );
    },
    [picked, togglePick]
  );

  const toggleCategory = (id) =>
    setSelected((prev) => {
      if (prev.size === 0) return new Set([id]);
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next.size === CATEGORIES.length ? new Set() : next;
    });

  const visibleCount = events.length;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__text">
          <p className="eyebrow">Schedule</p>
          <h1>{schedule.name}</h1>
          <p className="subtitle">
            {formatRange(DAYS[0], DAYS[DAYS.length - 1])} · All times{" "}
            {schedule.timezone.split("/")[1].replace("_", " ")} (ET)
          </p>
          <p className="contrib">
            <a
              href="https://github.com/gurkiratz/htn-schedule"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon />
              Wanna improve this? Open a PR!
            </a>
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() =>
            downloadIcs(schedule.events, "hack-the-north-2026", schedule.name)
          }
        >
          <CalendarPlusIcon />
          Add all to calendar
        </button>
      </header>

      <div className="controls">
        <div className="controls__row">
          {!isMobile && (
            <div
              className="segmented"
              role="tablist"
              aria-label="Calendar view"
            >
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  className={view === v.id ? "is-active" : ""}
                  onClick={() => goToView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <div className="daypicker" role="group" aria-label="Jump to day">
            {DAYS.map((d) => {
              const iso = isoDay(d);
              const active = activeDay === iso;
              const today = iso === isoDay(new Date());
              return (
                <button
                  key={iso}
                  className={`${active ? "is-active" : ""}${
                    today ? " is-today" : ""
                  }`}
                  aria-current={today ? "date" : undefined}
                  onClick={() => goToDay(iso)}
                >
                  <span className="daypicker__dow">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className="daypicker__num">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          <label className="search">
            <SearchIcon />
            <input
              id="event-search"
              name="q"
              type="search"
              placeholder="Search events or rooms"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search events"
            />
          </label>
        </div>

        <div className="filters" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip chip--${c.id} ${
                selected.size > 0 && !selected.has(c.id) ? "is-off" : ""
              }`}
              aria-pressed={selected.size === 0 || selected.has(c.id)}
              onClick={() => toggleCategory(c.id)}
            >
              <span className="chip__dot" />
              {c.label}
            </button>
          ))}
          {selected.size > 0 && (
            <button
              className="chip chip--reset"
              onClick={() => setSelected(new Set())}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <main className="calendar-wrap">
        {visibleCount === 0 && (
          <p className="empty">No events match those filters.</p>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          initialDate={
            view === "timeGridDay" ? activeDay ?? initialDay() : schedule.rangeStart
          }
          views={{
            timeGridDay: {
              eventMaxStack: isMobile ? 3 : 8,
            },
            weekendGrid: {
              type: "timeGrid",
              duration: { days: DAYS.length },
              dateAlignment: "day",
              eventMaxStack: isMobile ? 2 : 4,
            },
            weekendList: {
              type: "list",
              duration: { days: DAYS.length },
              listDayFormat: {
                weekday: "long",
                month: "short",
                day: "numeric",
              },
              listDaySideFormat: false,
            },
          }}
          headerToolbar={false}
          height="auto"
          expandRows
          stickyHeaderDates
          nowIndicator
          allDaySlot={false}
          slotEventOverlap={false}
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime={defaultScrollTime()}
          validRange={{ start: schedule.rangeStart, end: schedule.rangeEnd }}
          firstDay={5}
          editable={false}
          selectable={false}
          eventStartEditable={false}
          eventDurationEditable={false}
          dayHeaderFormat={{
            weekday: "short",
            day: "numeric",
            omitCommas: true,
          }}
          slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          noEventsText="No events match those filters."
          events={events}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            setDetail(info.event.extendedProps);
          }}
          eventContent={renderEvent}
          datesSet={(arg) => {
            setView(arg.view.type);
            if (arg.view.type === "timeGridDay")
              setActiveDay(isoDay(arg.start));
          }}
        />
      </main>

      {picked.size > 0 && (
        <SelectionBar
          count={picked.size}
          onExport={exportPicked}
          onClear={() => setPicked(new Set())}
        />
      )}

      <footer className="footer">
        <p className="font-mono">
          {schedule.events.length} events · Times shown in EST · Sourced from the{" "}
          <a href="https://my.hackthenorth.com/schedule">official schedule</a>.
          Built by <a href="https://gurkiratsingh.xyz">Gurkirat</a> at Hack the
          North 2026.
        </p>
      </footer>

      {detail && (
        <EventDetails
          event={detail}
          picked={picked.has(detail.id)}
          onTogglePick={() => togglePick(detail.id)}
          onClose={() => setDetail(null)}
          onDownload={() =>
            downloadIcs([detail], slug(detail.title), detail.title)
          }
          googleUrl={googleCalendarUrl(detail)}
        />
      )}
    </div>
  );
}

function wallNow(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

/** Open-ended / all-day-ish blocks stay coloured — hacking, hardware hub, etc. */
function isOpenWindow(event) {
  const ms = new Date(`${event.end}Z`) - new Date(`${event.start}Z`);
  return ms >= 8 * 60 * 60 * 1000;
}

function isPastEvent(event, now) {
  if (isOpenWindow(event)) return false;
  return now >= event.end;
}

function eventOverlapsDay(event, day) {
  const start = event.start.slice(0, 10);
  const end = event.end.slice(0, 10);
  return start <= day && end >= day;
}

function defaultScrollTime() {
  const now = new Date();
  const today = isoDay(now);
  if (!DAYS.some((d) => isoDay(d) === today)) return "09:00:00";
  const h = Math.max(0, now.getHours() - 1);
  return `${String(h).padStart(2, "0")}:00:00`;
}

function formatRange(start, end) {
  const month = start.toLocaleDateString("en-US", { month: "long" });
  return `${month} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
}

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function CalendarPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.36 6.84 9.72.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
