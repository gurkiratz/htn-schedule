import { useEffect, useRef } from 'react'

const CATEGORY_LABELS = {
  ceremony: 'Ceremony',
  workshop: 'Workshop',
  talk: 'Talk / meetup',
  food: 'Food',
  activity: 'Activity',
  logistics: 'Logistics',
}

export default function EventDetails({ event, picked, onTogglePick, onClose, onDownload, googleUrl }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const start = new Date(event.start)
  const end = new Date(event.end)
  const sameDay = start.toDateString() === end.toDateString()
  const timeOpts = { hour: 'numeric', minute: '2-digit' }

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__grip" />
        <span className={`chip chip--${event.category} chip--static`}>
          <span className="chip__dot" />
          {CATEGORY_LABELS[event.category] || event.category}
        </span>
        <h2 id="sheet-title">{event.title}</h2>

        <dl className="meta">
          <div>
            <dt>When</dt>
            <dd>
              {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <br />
              {start.toLocaleTimeString('en-US', timeOpts)}
              {event.end !== event.start && (
                <> – {end.toLocaleTimeString('en-US', timeOpts)}
                  {!sameDay && <span className="meta__next"> (next day)</span>}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{event.location}</dd>
          </div>
        </dl>

        <div className="sheet__actions">
          <button
            className="btn btn--primary"
            onClick={() => {
              onDownload()
              onClose()
            }}
          >
            Download .ics
          </button>
          <a
            className="btn"
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
          >
            Google Calendar
          </a>
        </div>

        <div className="sheet__actions sheet__actions--secondary">
          <button className="btn" aria-pressed={picked} onClick={onTogglePick}>
            {picked ? 'Remove from selection' : 'Add to selection'}
          </button>
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
