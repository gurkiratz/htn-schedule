/** Floating bar summarising the multi-select basket and exporting it. */
export default function SelectionBar({ count, onExport, onClear }) {
  return (
    <div className="selbar" role="region" aria-label="Selected events">
      <p className="selbar__count">
        <strong>{count}</strong> {count === 1 ? 'event' : 'events'} selected
      </p>
      <div className="selbar__actions">
        <button className="btn btn--ghost" onClick={onClear}>
          Clear
        </button>
        <button className="btn btn--primary" onClick={onExport}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
          </svg>
          Add to calendar
        </button>
      </div>
    </div>
  )
}
